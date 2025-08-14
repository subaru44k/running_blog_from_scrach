# Subaru Misc Blog Monorepo

This repo hosts the public website and supporting services for “Subaru is Running”.
It includes an Astro blog, a PDF compression microservice, and small Lambdas that
support direct uploads and deployment.

## Repo Layout

- `astro-blog/`
  - Astro v5 website (blog + tools pages)
  - Pages: Blog, PDF Compressor (`/pdf-compress/`), About, Contact, Privacy
  - Async calendar data at `GET /cal-map.json` reduces page weight
  - Google Analytics (gtag) with IP anonymization and AdSense snippet
  - CodeBuild buildspec (`astro-blog/buildspec.yml`) for S3 + CloudFront deploy
- `pdf-compress-service/`
  - Lambda container image with Ghostscript to compress PDFs
  - Supports S3-based inputs/outputs and deletes source uploads on success
- `lambdas/sign-upload-v3/`
  - Node.js 20 Lambda that issues pre‑signed PUT URLs for direct browser upload
  - Uses AWS SDK v3; deployed as a zip
- `admin-app/`
  - Internal scripts used by the blog (e.g., monthly summary generator)
- `old_blog_data/`
  - Legacy content/data used to bootstrap the current blog

## Frontend (Astro Blog)

- Dev
  - `cd astro-blog`
  - `npm ci`
  - Create `.env` with: `PUBLIC_PDF_API_BASE=https://<your-api-id>.execute-api.<region>.amazonaws.com`
  - `npm run dev`

- Build locally
  - `npm run build`
  - Sanity check built output: `node scripts/sanity-check.mjs astro-blog/dist`

- Key env vars (build-time)
  - `PUBLIC_PDF_API_BASE` (required): API Gateway base for the PDF endpoints

- PDF Compressor flow
  - Browser POSTs `PUBLIC_PDF_API_BASE/sign-upload` → gets `{ uploadUrl, objectKey, bucket }`
  - Browser PUTs the PDF to `uploadUrl`
  - Browser POSTs `PUBLIC_PDF_API_BASE/compress` with `{ bucket, key, level, removeMetadata, grayscale }`
  - Service returns `{ downloadUrl }` for the compressed PDF
  - Frontend auto-downloads via blob; Start button includes exponential backoff for 429/5xx

- Calendar performance
  - Initial month grid is server-rendered for instant UX
  - Full calendar map loads async from `/cal-map.json` and is cached in `localStorage`

- Analytics & Ads
  - GA (gtag) is included with `anonymize_ip: true` (see `src/layouts/Layout.astro`)
  - AdSense script is included in the page head

## Deploy (CodeBuild → S3 + CloudFront)

- Buildspec: `astro-blog/buildspec.yml`
- Required project environment variables (CodeBuild console):
  - `BUCKET` (S3 static hosting bucket)
  - `DISTRIBUTION_ID` (CloudFront distribution ID)
  - `PUBLIC_PDF_API_BASE` (e.g., `https://xxxx.execute-api.ap-northeast-1.amazonaws.com/`)
- The buildspec:
  - Ensures Node 20, installs deps
  - Runs summary generator (admin-app)
  - Builds Astro site and runs sanity tests
  - Syncs `dist/` to S3 and invalidates CloudFront

## Services: PDF Compression

### Lambda Container Image (pdf-compress-service)

- What it does
  - Reads a PDF (from S3 or base64 payload), compresses via Ghostscript, and returns a link
  - S3 mode (recommended): `{ bucket, key, level, removeMetadata, grayscale }`
    - Upload object is deleted automatically on success
    - Returns `{ downloadUrl }` (short‑lived pre‑signed GET)
  - Base64 mode (for local testing): `{ fileBase64, filename? ... }` → returns base64 PDF

- Build & push (ECR)
  - `export AWS_ACCOUNT_ID=... AWS_REGION=ap-northeast-1 ECR_REPO=pdf-compress-service IMAGE_TAG=v0.3.0`
  - `export PLATFORM=linux/amd64` (or `linux/arm64` for Graviton)
  - `aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com`
  - `docker buildx build --platform "$PLATFORM" -t "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG" -t "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest" ./pdf-compress-service`
  - `docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"`

- Update Lambda to new image
  - `aws lambda update-function-code --function-name pdf-compress-lambda --image-uri "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG" --region $AWS_REGION`

- Lambda configuration
  - Memory: 2048MB+ (adjust as needed), Timeout: 120s+, `/tmp` storage: 1024MB+
  - Optional env: `DOWNLOAD_URL_TTL=600`
  - IAM permissions on your bucket: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`

### Sign-Upload Lambda (lambdas/sign-upload-v3)

- Purpose
  - Issues pre‑signed PUT URLs so the browser can upload PDFs directly to S3

- Deploy (zip)
  - `cd lambdas/sign-upload-v3 && npm install --production && zip -r function.zip .`
  - Create Lambda (Node.js 20), upload `function.zip` in the console
  - Env vars:
    - `BUCKET_NAME=<uploads bucket>`
    - `UPLOAD_URL_TTL=600` (optional)
  - IAM: `s3:PutObject` on `arn:aws:s3:::<bucket>/*`

- API Gateway (HTTP API)
- Route: `POST /sign-upload` → integrate with this Lambda (payload v2.0)
  - CORS: configure in API Gateway (allowed origins, method POST, header content-type)

## S3 Setup

- Bucket CORS (example)
  ```json
  [
    {
      "AllowedOrigins": ["https://subaru-is-running.com", "http://localhost:4321"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
- Lifecycle policies
  - Expire uploads/ and outputs/ after a short time (e.g., 1 day) to control storage
  - The compression Lambda deletes the uploaded source file after successful compression

## Rate Limiting & Resilience

- API Gateway throttling protects the backend
- Frontend uses exponential backoff with jitter for `POST /sign-upload` and `POST /compress`

## Sanity Tests (CI)

- Script: `astro-blog/scripts/sanity-check.mjs`
  - Verifies key built pages exist and contain expected markers
- Run locally: `node astro-blog/scripts/sanity-check.mjs astro-blog/dist`
- CodeBuild runs this automatically before deploying

## Notes & Future Improvements

- GA measurement ID and AdSense client are hardcoded in `Layout.astro` today
  - We can switch to env-driven values (e.g., `PUBLIC_GA_MEASUREMENT_ID`) with a build guard
- Calendar map could be further split per month if the archive grows very large
- For heavy usage, consider S3 multipart uploads from the browser and tighter Lambda memory tuning

