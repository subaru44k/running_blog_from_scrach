# デプロイ手順（分かる範囲）

## Astroサイト
1. CodeBuild プロジェクトを実行する
2. ビルド後、S3に同期され CloudFront が無効化される

### 前提
- CodeBuildの環境変数に `BUCKET` と `DISTRIBUTION_ID` が設定されている
- `PUBLIC_PDF_API_BASE` が設定されている

### 注意
- デプロイ実行はAWSコンソールまたはAWS MCP経由で行う
- AWS CLIコマンドは本ドキュメントでは記載しない

## PDF圧縮サービス
TODO: コンテナのビルド/デプロイ手順（ECR/Lambda）を確定後に追記。

## Fitbitコールバック
TODO: CloudFormationによる更新フローの確定後に追記。
