# Runbook（draw backend）

## 429増加時の対処
- CloudWatch Logs で `Rate limit exceeded` を確認
- DrawRateLimit の閾値を調整
- 一時的にフロント側でリトライ間隔を伸ばす

## Draw AIコスト増加時の対処
- inkRatio gate の閾値を上げる
- DrawSubmissions の `primaryInputTokens` / `primaryOutputTokens` / `primaryEstimatedCostUsd` を集計し、増加区間を特定する
- `primaryProvider=openai` と `primaryModelId=gpt-5.6-luna` が意図通り保存されているか確認する

## 期限切れ/削除（TTL）
- DrawSubmissions: expiresAt により自動削除
- DrawRateLimit: expiresAt により自動削除
- Draw画像（S3）: `draw-monthly-cleanup-prod` がJSTの毎月1日に前月データを確定し、通常投稿のTop20以外と期限切れの練習画像を削除

## 月次クリーンアップ運用
- EventBridge `draw-monthly-cleanup-prod-monthly` が日次で `draw-monthly-cleanup-prod` を起動し、JSTの1日のみランキングを確定する（その他の日は練習画像を整理）
- 通常画像の削除対象は `draw/prompt-YYYY-MM/` 配下、練習画像の削除対象は `draw/practice/` 配下のみ（prefixガードあり）
- 同率の順位は投稿時刻優先（既存 scoreSortKey ルール）
- 確定後はTop20以外の通常投稿から `GSI1PK/scoreSortKey` が外れ、過去月のランキングに再浮上しない
- 過去月のお題での投稿は練習扱いで、ランキング対象外・短期保持となる
- 手動再実行が必要な場合は Lambda テストイベントで `{"month":"YYYY-MM"}` を指定する
- 実行後は CloudWatch Logs の `draw_monthly_cleanup_summary` で `scanned/deleted/keepCount/practiceDeleted` を確認する

## 障害時
- /submit が 5xx: OpenAI key secret / Lambda env / rate limit を確認
- /leaderboard が 5xx: CloudFront署名鍵/Secrets Manager を確認
