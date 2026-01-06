# AWS リソース一覧（pdf-compress / prod）

このドキュメントは、運用・テスト・kill switch 実行時に必要な **AWS リソース名・リージョン・識別情報** を一箇所にまとめたものです。  
Codex/MCP の実行時にコピペしやすいことを優先しています。

## グローバル情報

| 項目 | 値 |
| --- | --- |
| AWS Account ID | `470447451992` |
| 環境 | `prod` |
| 主要リージョン | `ap-northeast-1` |
| CI/CDリージョン | `us-east-1`（CodeBuild） |
| CloudFront | グローバル（ACMは `us-east-1`） |

## 運用リソース（pdf-compress）

### CloudWatch Alarm

| 項目 | 値 |
| --- | --- |
| Alarm Name | `pdf-compress-throttle-kill-switch` |
| Region | `ap-northeast-1` |
| 用途 | kill switch 自動発火（Throttles 監視） |

### Lambda

| Function Name | Region | 用途 | Reserved Concurrency |
| --- | --- | --- | --- |
| `pdf-compress-lambda` | `ap-northeast-1` | 圧縮本体（Ghostscript） | 20 |
| `pdf-sign-upload` | `ap-northeast-1` | presigned POST 発行 | なし |
| `pdf-compress-kill-switch` | `ap-northeast-1` | S3 ダウンロード遮断/解除 | なし |
| `pdf-compress-cleanup-s3-prod` | `ap-northeast-1` | uploads/previews/outputs の1時間超を削除 | なし |

> MCP指定例: `--function-name pdf-compress-lambda`

### API Gateway (HTTP API)

| 項目 | 値 |
| --- | --- |
| API Name | `pdf-compress-api` |
| API ID | `6zzbxx14u6` |
| Stage | `$default` |
| Region | `ap-northeast-1` |
| Routes | `POST /sign-upload`, `POST /compress` |

> MCP指定例: `--api-id 6zzbxx14u6`

### S3

| Bucket | Region | 用途 |
| --- | --- | --- |
| `pdf-compress-uploads-prod` | `ap-northeast-1` | uploads/outputs/previews |
| `20250805-subaru-running-blog-site` | `ap-northeast-1` | 公開サイト（静的配信） |

### CloudFront

| Distribution ID | Domain | 用途 |
| --- | --- | --- |
| `EMED5317DC581` | `subaru-is-running.com` | 公開サイト配信 |

### SNS

| Topic ARN | Region | 用途 |
| --- | --- | --- |
| `arn:aws:sns:ap-northeast-1:470447451992:pdf-compress-kill-switch` | `ap-northeast-1` | kill switch 通知 |

### SSM パラメータ

| Name | Region | 用途 |
| --- | --- | --- |
| `/pdf-compress/kill-switch/enabled` | `ap-northeast-1` | kill switch 有効フラグ |
| `/pdf-compress/kill-switch/lastTriggered` | `ap-northeast-1` | 最終発火時刻 |

### CloudWatch Logs

| Log Group | Region | 対象 |
| --- | --- | --- |
| `/aws/lambda/pdf-compress-lambda` | `ap-northeast-1` | 圧縮本体 |
| `/aws/lambda/pdf-sign-upload` | `ap-northeast-1` | presigned POST 発行 |
| `/aws/lambda/pdf-compress-kill-switch` | `ap-northeast-1` | kill switch |
| `/aws/lambda/pdf-compress-cleanup-s3-prod` | `ap-northeast-1` | cleanup |

### IAM Role

| Role Name | Region | 用途 |
| --- | --- | --- |
| `lambda-pdf-compress-exec` | `ap-northeast-1` | pdf-compress-lambda / pdf-sign-upload |
| `pdf-compress-kill-switch-role` | `ap-northeast-1` | kill switch |
| `pdf-compress-cleanup-s3-prod-role` | `ap-northeast-1` | cleanup |

### EventBridge（スケジュール）

| Rule Name | Region | Schedule | 用途 |
| --- | --- | --- | --- |
| `pdf-compress-cleanup-s3-prod-every-10min` | `ap-northeast-1` | `rate(10 minutes)` | cleanup 起動 |

> cleanup Lambda の環境変数: `BUCKET=pdf-compress-uploads-prod`, `PREFIXES=uploads/,previews/,outputs/`, `TTL_SECONDS=3600`  
> 手動テスト: Lambda を手動実行し、ログの `scanned/deleted` を確認

### ECR

| Repository | Region | 用途 |
| --- | --- | --- |
| `pdf-compress-service` | `ap-northeast-1` | pdf-compress-lambda のイメージ |

## 開発・デプロイリソース

### CodeBuild

| 項目 | 値 |
| --- | --- |
| Project Name | `builddeploy-subaru-is-running-site` |
| Region | `us-east-1` |
| Source | `https://github.com/subaru44k/running_blog_from_scrach` |
| Buildspec | `astro-blog/buildspec.yml` |
| Artifacts | `NO_ARTIFACTS` |
| 環境変数（キーのみ） | `BUCKET`, `DISTRIBUTION_ID`, `PUBLIC_PDF_API_BASE` |
| Service Role | `arn:aws:iam::470447451992:role/service-role/codebuild-builddeploy-subaru-is-running-site-service-role` |
| Logs | `/aws/codebuild/builddeploy-subaru-is-running-site`（us-east-1） |

### CodePipeline

- 該当なし（`ap-northeast-1` の一覧で未検出）

### S3（デプロイ/資材）

| Bucket | Region | 用途 |
| --- | --- | --- |
| `20250805-subaru-running-blog-site` | `ap-northeast-1` | 公開サイトの成果物 |
| `lambda-zip-store-20260105` | `ap-northeast-1` | Lambda ZIP 一時保管 |

### IAM（CI/CD）

| Role Name | Region | 用途 |
| --- | --- | --- |
| `service-role/codebuild-builddeploy-subaru-is-running-site-service-role` | `us-east-1` | CodeBuild 実行 |

## MCP での指定例（コピペ用）

```
# Lambda
--function-name pdf-compress-lambda
--function-name pdf-sign-upload
--function-name pdf-compress-kill-switch
--function-name pdf-compress-cleanup-s3-prod

# API Gateway (HTTP API)
--api-id 6zzbxx14u6

# CloudWatch Alarm
--alarm-names pdf-compress-throttle-kill-switch

# S3
--bucket pdf-compress-uploads-prod

# SNS
--topic-arn arn:aws:sns:ap-northeast-1:470447451992:pdf-compress-kill-switch
```

## prompt 用 変数辞書（コピペ用）

```
ACCOUNT_ID=470447451992
REGION=ap-northeast-1
CI_REGION=us-east-1
ENV=prod
SERVICE=pdf-compress

SITE_BUCKET=20250805-subaru-running-blog-site
UPLOADS_BUCKET=pdf-compress-uploads-prod
LAMBDA_ZIP_BUCKET=lambda-zip-store-20260105

CODEBUILD_PROJECT=builddeploy-subaru-is-running-site
CLOUDFRONT_DIST_ID=EMED5317DC581
APIGW_API_ID=6zzbxx14u6
ECR_REPO=pdf-compress-service
ECR_REGISTRY=470447451992.dkr.ecr.ap-northeast-1.amazonaws.com

CLEANUP_LAMBDA=pdf-compress-cleanup-s3-prod
CLEANUP_RULE=pdf-compress-cleanup-s3-prod-every-10min
```
