# デプロイ手順（分かる範囲）

## Astroサイト
1. 確認済み変更をGitへpushし、対象コミットを指定して既存CodeBuildプロジェクトを実行する
2. ビルド後、ハッシュ付きasset、その他の成果物の順でS3に同期され、CloudFrontが無効化される
3. CloudWatch Logs で `[timing]` 行を確認し、`S3 sync` が通常更新で突出していないことを確認する

### 前提
- CodeBuildの環境変数に `BUCKET` と `DISTRIBUTION_ID` が設定されている
- `PUBLIC_PDF_API_BASE` が設定されている
- `PUBLIC_DRAW_API_BASE` が設定されている
- CodeBuild service roleに対象distribution限定の `cloudfront:CreateInvalidation` と `cloudfront:GetInvalidation` が許可されている

### デプロイ実装
- CodeBuild は Node.js 20 runtime と npm cache を使う。
- 月次サマリーは安定slug（`{YYYY-MM}-summary.md`）で生成し、legacy のランダムhash summaryは force 実行時に削除される。
- `dist/_astro` はHTMLより先に同期し、キャッシュ済みHTMLとの互換性のため旧ハッシュ付きassetを削除しない。
- その他の成果物は `_astro/*` を除外し、`--delete` で同期する。同一サイズの変更済みHTMLを取りこぼすため `--size-only` は使わない。
- CloudFrontの全パス無効化は完了まで待機し、作成または完了確認に失敗した場合はデプロイを失敗させる。その後、本番結果ページが今回生成したDrawResult assetを参照して、そのassetがHTTP 200であることを自動確認する。

### 注意
- 既存CodeBuildプロジェクトはAWSコンソール、AWS MCP、または認証済みAWS CLI（`codex-prod` プロファイル）から起動する
- AWS CLIコマンドは本ドキュメントでは記載しない

## PDF圧縮サービス
TODO: コンテナのビルド/デプロイ手順（ECR/Lambda）を確定後に追記。

## Fitbitコールバック
TODO: CloudFormationによる更新フローの確定後に追記。

### Draw限定の手元成果物デプロイ

作業ツリーに別機能の変更がある場合、承認済みDraw変更は完全ビルド・sanity確認後に手元の成果物から限定反映できる。`_astro`のhash assetsを先に追加し、draw/play・draw/result・draw/archiveのHTMLのみ更新する。サイト全体の削除syncは行わない。旧HTML・Lambdaコード/設定を退避し、worker/detail→frontend→submitの順で反映、対象パスのCloudFront無効化と実URL参照assetの200を確認する。手順はdraw-game-score-v1.md。通常の全サイト公開は上記CodeBuild手順。
