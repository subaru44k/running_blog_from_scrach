# lambdas/sign-upload-v3

## 役割
S3への presigned POST を発行するLambda。PDF圧縮フローの最初に呼ばれる。

## 主要ファイル
- `lambdas/sign-upload-v3/index.mjs`: presigned POST 発行ロジック

## 入出力
- 入力: JSON `{ filename, contentType, contentLength }`
- 出力: JSON `{ url, fields, objectKey, bucket, expiresIn }`

## ローカル実行（分かる範囲）
- Lambda/API Gateway 経由で呼び出す。実リソース名は `docs/aws-resources.md` を参照。

## 変更時の注意点
- `uploads/` 配下にアップロードされる前提に依存している。
- `UPLOAD_URL_TTL` などの環境変数は運用側で調整。
