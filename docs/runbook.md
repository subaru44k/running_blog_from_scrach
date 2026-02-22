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
- Draw画像（S3）: `draw-monthly-cleanup-prod` が毎月1日に前月データを整理し、Top20以外を削除

## 月次クリーンアップ運用
- EventBridge `draw-monthly-cleanup-prod-monthly` が `draw-monthly-cleanup-prod` を起動
- 削除対象は `draw/prompt-YYYY-MM/` 配下のみ（prefixガードあり）
- 同率の順位は投稿時刻優先（既存 scoreSortKey ルール）
- 手動再実行が必要な場合は Lambda テストイベントで `{"month":"YYYY-MM"}` を指定する
- 実行後は CloudWatch Logs の `draw_monthly_cleanup_summary` で `scanned/deleted/keepCount` を確認する

## 障害時
- /secondary が 404 を返す: secondaryStatus が failed/未生成の可能性
- /leaderboard が 5xx: CloudFront署名鍵/Secrets Manager を確認
