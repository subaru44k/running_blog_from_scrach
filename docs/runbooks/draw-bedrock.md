# Draw AI採点メモ

## モデル
- 一次採点: OpenAI GPT-5.6 Luna（`PRIMARY_MODEL_ID=gpt-5.6-luna`, `OPENAI_REASONING_EFFORT=none`）
- 二次講評: 廃止

## 必要IAM
- `secretsmanager:GetSecretValue`（OpenAI key secret）

## 失敗時の挙動
- 一次: スタブ採点へフォールバック（サービス継続）

## 運用メモ
- モデルIDとreasoning設定は環境変数で明示する。Lunaでは `minimal` を使用しない。
- OpenAI の利用量は `DrawSubmissions.primaryInputTokens / primaryCachedInputTokens / primaryCacheWriteTokens / primaryOutputTokens / primaryEstimatedCostUsd` を集計して確認する
- 本番切替後は `primaryModelId=gpt-5.6-luna` と `aiFallbackUsed=false` の実投稿を確認する
