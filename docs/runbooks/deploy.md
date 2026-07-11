# デプロイ手順（分かる範囲）

## Astroサイト
1. CodeBuild プロジェクトを実行する
2. ビルド後、ハッシュ付きasset、その他の成果物の順でS3に同期され、CloudFrontが無効化される
3. CloudWatch Logs で `[timing]` 行を確認し、`S3 sync` が通常更新で突出していないことを確認する

### 前提
- CodeBuildの環境変数に `BUCKET` と `DISTRIBUTION_ID` が設定されている
- `PUBLIC_PDF_API_BASE` が設定されている
- `PUBLIC_DRAW_API_BASE` が設定されている

### デプロイ実装
- CodeBuild は Node.js 20 runtime と npm cache を使う。
- 月次サマリーは安定slug（`{YYYY-MM}-summary.md`）で生成し、legacy のランダムhash summaryは force 実行時に削除される。
- `dist/_astro` はHTMLより先に同期し、キャッシュ済みHTMLとの互換性のため旧ハッシュ付きassetを削除しない。
- その他の成果物は `_astro/*` を除外し、`--delete --size-only` で同期する。
- CloudFrontの全パス無効化は完了まで待機し、完了後に各ページが参照するJS/CSSがHTTP 200であることを確認する。

### 注意
- デプロイ実行はAWSコンソールまたはAWS MCP経由で行う
- AWS CLIコマンドは本ドキュメントでは記載しない

## PDF圧縮サービス
TODO: コンテナのビルド/デプロイ手順（ECR/Lambda）を確定後に追記。

## Fitbitコールバック
TODO: CloudFormationによる更新フローの確定後に追記。
