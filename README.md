# Subaru Misc Blog Monorepo

This repo hosts the public website and supporting services for “Subaru is Running”.
It includes an Astro blog, a PDF compression microservice, and small Lambdas that
support direct uploads and deployment.
AWS リソース名・Region・識別情報は `docs/aws-resources.md` を参照してください。
AWS CLI の標準プロファイル（`codex-prod`）と実行主体も `docs/aws-resources.md` を参照してください。
一時ファイルの cleanup（uploads/previews/outputs の削除）も `docs/aws-resources.md` を参照してください。

## Experimental Branches

- 作りかけの PNG 素材版 `おしゃれゲーム` 試作は `feature/dressup-next-png-spike` に退避しています。
- `main` にはまだ適用していません。必要になったらそのブランチを参照してください。

## Repo Layout

- `astro-blog/`
  - Astro v5 website (tools hub + blog + tools pages)
  - Pages: Hub (`/`), Blog (`/blog/`), Archive (`/archive/`), Draw (`/draw/`), Mini Games (`/games/` incl. balloon-catch/cushion-catch/tv-catch/window-catch/dressup/match-quiz/janken/clock/snake/maze/tic-tac-toe/reversi), Running Pace (`/running-pace/`), PDF Compressor (`/pdf-compress/`), About, Contact, Privacy, 404
  - Async calendar data at `GET /cal-map/{YYYY}/{MM}.json` reduces page weight
  - Google Analytics (gtag) with IP anonymization and AdSense snippet
  - AdSense `ads.txt` is served from `/ads.txt`
  - CodeBuild buildspec (`astro-blog/buildspec.yml`) for S3 + CloudFront deploy
- `pdf-compress-service/`
  - Lambda container image with Ghostscript to compress PDFs
  - Supports S3-based inputs/outputs and deletes source uploads on success
- `lambdas/sign-upload-v3/`
  - Node.js 20 Lambda that issues S3 presigned POST data for direct browser upload
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
  - 出力互換性の基準を作る: `npm run build:baseline`
  - 変更後の `dist` と基準を比較: `npm run compare:dist`
  - 記事生成を省略したクイック確認: `npm run build:quick`（`ASTRO_BUILD_NO_POSTS=1`）
  - Sanity check built output: `node scripts/sanity-check.mjs astro-blog/dist`

- Key env vars (build-time)
  - `PUBLIC_PDF_API_BASE` (required): API Gateway base for the PDF endpoints

- PDF Compressor flow
  - Browser POSTs `PUBLIC_PDF_API_BASE/sign-upload` → gets `{ url, fields, objectKey, bucket, expiresIn }`
  - Browser POSTs the PDF to S3 with `url` + `fields` as multipart form data
  - Browser POSTs `PUBLIC_PDF_API_BASE/compress` in parallel for levels 1/2/3
  - Service returns `{ downloadUrl, outputSizeBytes, previewUrl }` per level
  - Frontend shows 3 variants and lets the user download a chosen result

- Calendar performance
  - Blog post metadata is shared through `src/lib/blog-index.ts` during builds so repeated page generation does not rebuild the same collection-derived lists.
  - Initial month grid is server-rendered for instant UX
  - Calendar map loads async per month from `/cal-map/{YYYY}/{MM}.json` and is cached in `localStorage`

- Analytics & Ads
  - GA (gtag) is included with `anonymize_ip: true` (see `src/layouts/Layout.astro`)
  - AdSense script is included in the page head
  - AdSense `ads.txt` is published from `public/ads.txt`

## Deploy (CodeBuild → S3 + CloudFront)

- Buildspec: `astro-blog/buildspec.yml`
- Start the existing CodeBuild project from the AWS console, AWS MCP, or an authenticated AWS CLI using `codex-prod`, with the reviewed Git commit as its source version.
- Required project environment variables (CodeBuild console):
  - `BUCKET` (S3 static hosting bucket)
  - `DISTRIBUTION_ID` (CloudFront distribution ID)
  - `PUBLIC_PDF_API_BASE` (e.g., `https://xxxx.execute-api.ap-northeast-1.amazonaws.com/`)
  - `PUBLIC_DRAW_API_BASE`
- The buildspec:
  - Uses the CodeBuild Node 20 runtime and npm cache, then installs deps
  - Runs summary generator (admin-app) with stable `{YYYY-MM}-summary.md` slugs
  - Builds Astro site and runs sanity tests
  - Uploads `dist/_astro` first and retains older hashed assets, then syncs the remaining files with `--delete` while excluding `_astro/*` and comparing content/mtime
  - Waits for CloudFront invalidation completion and checks that the production result page references the current DrawResult asset and that the asset returns HTTP 200
  - Logs `[timing]` lines for install, summary, build, sanity, S3 sync, and invalidation completion

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
    - Upload URL の有効期限はデフォルト10分（`UPLOAD_URL_TTL`）
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


## Services: Garmin / Fitbit Workout Import

Garminのランニング詳細は `admin-app/scripts/garmin.sh` のローカルCLIで取得を検証できます。
初回認証をユーザーのターミナルで行い、token・取得物は `~/.garminconnect/` に保存します。
元のFITを含むZIP、TCX、summary・splits・details JSONを取得し、ブログ記事は生成しません。
Python 3.12以上と固定依存を使う準備手順は [Garmin local runbook](docs/runbooks/garmin-local.md) を参照。

### Fitbit OAuth Callback (`lambdas/fitbit-callback`)

- Handles Fitbit OAuth 2.0 redirect, exchanges the authorization code for access/refresh tokens
- Stores the token payload in S3 (`TOKEN_S3_BUCKET`/`TOKEN_S3_KEY`) so offline tooling can refresh later
- Optional `EXPECTED_STATE` and `SUCCESS_REDIRECT_URL` env vars protect the flow and improve UX
- Deploy via `lambdas/fitbit-callback/cloudformation.yaml` to provision Lambda, IAM role, and API Gateway in one stack

### Admin Import Script (`admin-app/scripts/import-workouts.js`)

- Imports Garmin running activities first, using Fitbit only on successfully queried days without a Garmin run.
- `--source auto|garmin|fitbit` selects the source policy; `auto` is the default.
- The existing `import-fitbit-workouts.js` command delegates to this same importer.
- Garmin uses local tokens and Python 3.12+; Fitbit S3 tokens and AWS credentials are loaded only when Fitbit is needed.
- Preserves frontmatter, `31分ジョグ(7.20km)`, arrow-separated splits, and `YYYY-MM-DD-fitbit-workout.md` URLs.
- Skips existing daily imported posts, including legacy numbered files, before calling either API; does not overwrite edited posts or generate duplicates.
- Uses the earliest valid start time; Garmin UTC start times are converted to the configured offset (default JST).
- Stops on provider errors or five consecutive days without a matching run, with a nonzero exit status.
- CLI usage from the repository root:
  - `AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --date 2026-09-28 --dry-run`
  - `--from YYYY-MM-DD --to YYYY-MM-DD` selects an inclusive range.
  - `--days N` selects today and the preceding N-1 days; the default is today.
  - `--dry-run` or `FITBIT_IMPORT_DRY_RUN=true` prints Markdown without writing posts; token refresh still persists.
- Existing `FITBIT_DEFAULT_*` and `FITBIT_IMPORT_TZ_OFFSET` settings apply to both sources.
- See [admin import documentation](admin-app/README.md) and [Garmin local runbook](docs/runbooks/garmin-local.md).

- Local drawing reference evaluation and human review: [tools/draw-evaluation/README.md](tools/draw-evaluation/README.md) (subscription Codex evaluation; no AI API calls).

Draw新規採点はDecisions gpt-6-lunaの元の評価指示と4軸MAP/F方式を採用。講評はSQS経由のGPT-6 Luna noneで非同期生成し、結果画面で追記する。実装・公開手順はdocs/runbooks/draw-game-score-v1.md。
