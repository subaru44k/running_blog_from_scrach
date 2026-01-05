# lambdas/sign-upload-v3

## 役割
S3への署名付きPUT URLを発行するLambda。PDF圧縮フローの最初に呼ばれる。

## 主要ファイル
- `lambdas/sign-upload-v3/index.mjs`: 署名URL発行ロジック

## 入出力
- 入力: JSON `{ filename, contentType }`
- 出力: JSON `{ uploadUrl, objectKey, bucket, expiresIn }`

## ローカル実行（分かる範囲）
- Lambda/API Gateway 経由で呼び出す想定（TODO: 実デプロイ名）

## 変更時の注意点
- `uploads/` 配下にアップロードされる前提に依存している。
- `UPLOAD_URL_TTL` などの環境変数は運用側で調整。
