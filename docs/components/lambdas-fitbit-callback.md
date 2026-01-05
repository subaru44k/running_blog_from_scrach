# lambdas/fitbit-callback

## 役割
Fitbit OAuth のコールバックを受け取り、トークンをS3に保存するLambda + API Gateway。

## 主要ファイル
- `lambdas/fitbit-callback/index.mjs`: OAuth code交換とS3保存
- `lambdas/fitbit-callback/cloudformation.yaml`: Lambda/API Gateway/ロール

## 入出力
- 入力: Fitbit OAuth の `code`（query string）
- 出力: S3に `fitbit/token.json` を保存

## ローカル実行（分かる範囲）
- CloudFormationでデプロイ（詳細は `cloudformation.yaml`）
- ローカルでの単体実行は未整理（TODO）

## 変更時の注意点
- `EXPECTED_STATE` を使う場合は管理側と一致させる。
- トークン保存先S3は既存バケット前提。
