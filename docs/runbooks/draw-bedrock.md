# Draw AI採点メモ

## モデル
- 一次採点: OpenAI GPT-4.1 mini（PRIMARY_MODEL_ID）
- 二次講評: 廃止

## 必要IAM
- `secretsmanager:GetSecretValue`（OpenAI key secret）

## 失敗時の挙動
- 一次: スタブ採点へフォールバック（サービス継続）

## 運用メモ
- モデルIDを変更した場合は環境変数で切替
- OpenAI の利用量は `DrawSubmissions.primaryInputTokens / primaryOutputTokens / primaryEstimatedCostUsd` を集計して確認する
