# Runbook（draw backend）

## 429増加時の対処
- CloudWatch Logs で `Rate limit exceeded` を確認
- DrawRateLimit の閾値を調整
- 一時的にフロント側でリトライ間隔を伸ばす

## Bedrockコスト増加時の対処
- inkRatio gate の閾値を上げる
- 二次レビュー条件（rank上位のみ）を厳しくする
- 二次レビューのリトライ回数を減らす
- DrawSubmissions の `primaryInputTokens` / `secondaryInputTokens` / `...OutputTokens` を集計し、増加区間を特定する
- `primaryModelId` / `secondaryModelId` を確認し、意図しないモデル切替がないか確認する

## 期限切れ/削除（TTL）
- DrawSubmissions: expiresAt により自動削除
- DrawRateLimit: expiresAt により自動削除

## 障害時
- /secondary が 404 を返す: secondaryStatus が failed/未生成の可能性
- /leaderboard が 5xx: CloudFront署名鍵/Secrets Manager を確認
