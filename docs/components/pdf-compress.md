# pdf-compress-service / PDF圧縮

## 役割
ブラウザからアップロードしたPDFを圧縮し、複数候補（高画質/標準/高圧縮）を返すサービス。Ghostscriptを使用。

## 主要ファイル
- `pdf-compress-service/lambda.js`: 圧縮ロジック本体（S3入出力）
- `pdf-compress-service/Dockerfile`: Lambda用コンテナ（Ghostscript同梱）
- `pdf-compress-service/push-ecr.sh`: イメージビルド/Push用スクリプト
- `astro-blog/src/pages/pdf-compress.astro`: フロントUI（署名発行→圧縮API）

## 入出力
- 入力: S3の `uploads/` に置かれたPDF（署名URLでアップロード）
- 出力: `outputs/` に圧縮PDF、`previews/` に1ページ目PNG（best-effort）
- API: `/sign-upload` と `/compress`

## ローカル実行（分かる範囲）
- フロント: `npm run dev --prefix astro-blog` で UI を確認
- バックエンド: コンテナ/Lambda の実行は環境依存（TODO）

## 変更時の注意点
- 3並列 `/compress` を前提に `keepSource=true` を使う。
- 単体 `/compress` でも `previewUrl` を返す（best-effort）。
- 出力キーはレベルで衝突しない命名（hq/balanced/small）。
- S3ライフサイクルによる自動削除を前提（詳細は運用側設定）。
