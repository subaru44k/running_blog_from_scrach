# Subaru Misc Blog Monorepo

This repo hosts the public website and supporting services for “Subaru is Running”.
It includes an Astro blog, a PDF compression microservice, and small Lambdas that
support direct uploads and deployment.
AWS リソース名・Region・識別情報は `docs/aws-resources.md` を参照してください。
一時ファイルの cleanup（uploads/previews/outputs の削除）も `docs/aws-resources.md` を参照してください。

## Repo Layout

- `astro-blog/`
  - Astro v5 website (tools hub + blog + tools pages)
  - Pages: Hub (`/`), Blog (`/blog/`), Draw Mock (`/draw/`), Running Pace (`/running-pace/`), PDF Compressor (`/pdf-compress/`), About, Contact, Privacy, 404
  - Async calendar data at `GET /cal-map/{YYYY}/{MM}.json` reduces page weight
  - Google Analytics (gtag) with IP anonymization and AdSense snippet
  - CodeBuild buildspec (`astro-blog/buildspec.yml`) for S3 + CloudFront deploy
- `pdf-compress-service/`
  - Lambda container image with Ghostscript to compress PDFs
  - Supports S3-based inputs/outputs and deletes source uploads on success
- `lambdas/sign-upload-v3/`
  - Node.js 20 Lambda that issues pre‑signed PUT URLs for direct browser upload
  - Uses AWS SDK v3; deployed as a zip
- `lambdas/fitbit-callback/`
  - Node.js 20 Lambda that handles the Fitbit OAuth callback and stores refreshed tokens in S3
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
  - 記事生成を省略したクイック確認: `npm run build:quick`（`ASTRO_BUILD_NO_POSTS=1`）
  - Sanity check built output: `node scripts/sanity-check.mjs astro-blog/dist`

- Key env vars (build-time)
  - `PUBLIC_PDF_API_BASE` (required): API Gateway base for the PDF endpoints

- PDF Compressor flow
  - Browser POSTs `PUBLIC_PDF_API_BASE/sign-upload` → gets `{ uploadUrl, objectKey, bucket }`
  - Browser PUTs the PDF to `uploadUrl`
  - Browser POSTs `PUBLIC_PDF_API_BASE/compress` in parallel for levels 1/2/3
  - Service returns `{ downloadUrl, outputSizeBytes, previewUrl }` per level
  - Frontend shows 3 variants and lets the user download a chosen result

- Calendar performance
  - Initial month grid is server-rendered for instant UX
  - Calendar map loads async per month from `/cal-map/{YYYY}/{MM}.json` and is cached in `localStorage`

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
  - S3 mode (recommended): `{ bucket, key, level, removeMetadata, grayscale, keepSource }`
    - Output keys are level-specific (`hq`, `balanced`, `small`)
    - Returns `{ downloadUrl, outputSizeBytes, previewUrl }` (short‑lived pre‑signed GET)
    - Source deletion is best‑effort when `keepSource=false`
    - PDFアップロードは最大50MBまで（sign-upload-v3でチェック）
    - downloadUrl/previewUrl の有効期限はデフォルト10分（`DOWNLOAD_URL_TTL`）
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
  - Issues presigned POST (url + fields) so the browser can upload PDFs directly to S3

- Deploy (zip)
  - `cd lambdas/sign-upload-v3 && npm install --production && zip -r function.zip .`
  - Create Lambda (Node.js 20), upload `function.zip` in the console
- Env vars:
    - `BUCKET_NAME=<uploads bucket>`
    - `UPLOAD_URL_TTL=600` (optional, デフォルト10分)
  - IAM: `s3:PutObject` on `arn:aws:s3:::<bucket>/*`

- API Gateway (HTTP API)
- Route: `POST /sign-upload` → integrate with this Lambda (payload v2.0)
  - CORS: configure in API Gateway (allowed origins, method POST, header content-type)
  - Lambda: `pdf-sign-upload` (ap-northeast-1)

## S3 Setup

- Bucket CORS (example)
  ```json
  [
    {
      "AllowedOrigins": ["https://subaru-is-running.com", "http://localhost:4321"],
      "AllowedMethods": ["POST", "PUT", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
- Lifecycle policies
  - Expire uploads/, outputs/, previews/ after a short time (e.g., 1 day) to control storage
  - Source deletion is best‑effort and can be skipped with `keepSource=true`

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


## Services: Fitbit Workout Import

### Fitbit OAuth Callback (`lambdas/fitbit-callback`)

- Handles Fitbit OAuth 2.0 redirect, exchanges the authorization code for access/refresh tokens
- Stores the token payload in S3 (`TOKEN_S3_BUCKET`/`TOKEN_S3_KEY`) so offline tooling can refresh later
- Optional `EXPECTED_STATE` and `SUCCESS_REDIRECT_URL` env vars protect the flow and improve UX
- Deploy via `lambdas/fitbit-callback/cloudformation.yaml` to provision Lambda, IAM role, and API Gateway in one stack

### Admin Import Script (`admin-app/scripts/import-fitbit-workouts.js`)

- Fetches daily activities via Fitbit Web API and writes Markdown drafts into `astro-blog/src/content/blog/`
- Requires AWS credentials + Fitbit client secrets to refresh tokens
- CLI usage:
  - `node scripts/import-fitbit-workouts.js` imports yesterday by default
  - `--date YYYY-MM-DD` or `--days N` customise the range
  - `FITBIT_IMPORT_DRY_RUN=true` to preview without writing files
- Frontmatter defaults can be tuned with `FITBIT_DEFAULT_*` env vars; timezone offset defaults to JST (`540` minutes)
