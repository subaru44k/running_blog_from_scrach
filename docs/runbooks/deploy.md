# デプロイ手順（分かる範囲）

## Astroサイト
1. CodeBuild プロジェクトを実行する
2. ビルド後、S3に同期され CloudFront が無効化される
3. CloudWatch Logs で `[timing]` 行を確認し、`S3 sync` が通常更新で突出していないことを確認する

### 前提
- CodeBuildの環境変数に `BUCKET` と `DISTRIBUTION_ID` が設定されている
- `PUBLIC_PDF_API_BASE` が設定されている

### デプロイ実装
- CodeBuild は Node.js 20 runtime と npm cache を使う。
- 月次サマリーは安定slug（`{YYYY-MM}-summary.md`）で生成し、legacy のランダムhash summaryは force 実行時に削除される。
- S3同期は `--size-only --only-show-errors --no-progress` で実行し、静的生成時のmtime差だけによる全量再アップロードを避ける。

### 注意
- デプロイ実行はAWSコンソールまたはAWS MCP経由で行う
- AWS CLIコマンドは本ドキュメントでは記載しない

## PDF圧縮サービス
TODO: コンテナのビルド/デプロイ手順（ECR/Lambda）を確定後に追記。

## Fitbitコールバック
TODO: CloudFormationによる更新フローの確定後に追記。
