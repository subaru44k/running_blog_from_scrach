# 30秒お絵描き採点ゲーム（Phase 1 バックエンド）

## アーキテクチャ概要
- API Gateway（/api/draw/*）
- Lambda（prompt / upload-url / submit / secondary worker / leaderboard / secondary status）
- DynamoDB（DrawSubmissions / DrawRateLimit）
- S3（画像保管: draw/{promptId}/{submissionId}.png）
- CloudFront（S3非公開 + 署名URL 15分）
- SQS（二次レビューの非同期実行）
- Secrets Manager（CloudFront署名の秘密鍵）

### 実リソース（prod）
- S3: `draw-uploads-20260124-58904f87`
- CloudFront: `d1ih441smws3tt.cloudfront.net`（Distribution ID: `E2CQHMEVDKG7MU`）
- Key Group: `f2034b56-9310-4e45-add9-14ec838a2a86` / Public Key ID: `K1LW2OJ3ER8YUH`
- Secrets Manager: `draw/cf-private-key`
- DynamoDB: `DrawSubmissions`, `DrawRateLimit`
- SQS: `draw-secondary-queue-prod`
- Lambda:
 - `draw-upload-url-prod`
  - `draw-prompt-prod`
  - `draw-submit-prod`
  - `draw-secondary-status-prod`
  - `draw-secondary-worker-prod`
  - `draw-leaderboard-prod`
  - `draw-monthly-cleanup-prod`
- API Gateway: `draw-api`（API ID: `2vzy10yq0e`, Endpoint: `https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com`）

## データフロー
1. **prompt**: `GET /api/draw/prompt?month=YYYY-MM`（month省略時はJST今月）
   - サーバーが月次ルールで `promptId`/`promptText` を返す
   - 月次切替は JST ベース、`2026-02` を index 0（熊）として36題を順送り
2. **upload-url**: `POST /api/draw/upload-url`
   - submissionId(ULID) 生成（promptId はサーバー決定）
   - S3 PUT 署名URL発行
3. **画像PUT**: ブラウザから S3 へ直接PUT
4. **submit**: `POST /api/draw/submit`（`promptText` は任意）
   - 画像取得 → inkRatio gate → 一次採点（Bedrock/Haiku、失敗時はスタブ）
   - `imageKey` 内の promptId を優先し、サーバー側でお題テキストを確定
   - DynamoDB保存
   - ランクイン候補のみ SQS へ二次投入
5. **secondary**: SQSワーカーが二次レビュー（Bedrock/Haiku 4.5、失敗時はfailed）実行
6. **secondary status**: `GET /api/draw/secondary?promptId=...&submissionId=...`
   - 202 pending / 200 done / 404 not_found
7. **leaderboard**: `GET /api/draw/leaderboard?promptId=...` または `?month=YYYY-MM`
   - CloudFront署名URLを付与して返却
8. **monthly cleanup**: EventBridge（月1回）→ `draw-monthly-cleanup-prod`
   - 対象は「前月の prompt」
   - S3 `draw/prompt-YYYY-MM/` 配下から Top20 以外を削除

## DynamoDB スキーマ
### DrawSubmissions
- PK: `promptId` (string)
- SK: `submissionId` (ULID)
- attrs: createdAt, expiresAt, nickname, imageKey, score, breakdown, oneLiner, tips, isRanked, rank, secondaryStatus, enrichedComment, secondaryAttempts
- AI usage attrs:
  - primaryModelId, primaryInputTokens, primaryOutputTokens, primaryTotalTokens, primaryLatencyMs
  - secondaryModelId, secondaryInputTokens, secondaryOutputTokens, secondaryTotalTokens, secondaryLatencyMs
  - tokenRecordedAt, aiFallbackUsed
- TTL: expiresAt
- GSI1 (Leaderboard):
  - GSI1PK: promptId
  - GSI1SK: scoreSortKey = `${(100-score).padStart(3,'0')}#${createdAt}#${submissionId}`

### DrawRateLimit
- PK: key (string) 例: `ip#route#windowStart`
- attrs: count, expiresAt
- TTL: expiresAt

## レート制限
- `/api/draw/submit`: 5回 / 5分 / IP
- `/api/draw/upload-url`: 10回 / 5分 / IP
- fixed window (DynamoDB UpdateItem ADD)

## Gate（inkRatio）
- PNGからインク割合を算出
- `inkRatio < 0.001` は即スキップ（score=0）

## CloudFront署名URL
- KeyGroup + Secrets Manager の秘密鍵で署名
- 有効期限 15分（900秒）

## 主要環境変数
- DRAW_BUCKET
- DRAW_TABLE
- RATE_LIMIT_TABLE
- SECONDARY_QUEUE_URL
- CLOUDFRONT_DOMAIN
- CF_KEY_PAIR_ID
- CF_PRIVATE_KEY_SECRET_ID
- PRIMARY_MODEL_ID（一次採点: Claude 3 Haiku）
- SECONDARY_MODEL_ID（二次講評: Claude Haiku 4.5）
- IMAGE_TTL_SECONDS=900
- SUBMISSION_TTL_DAYS=7
- LEADERBOARD_KEEP_LIMIT=20（cleanupがS3に残す件数）

## フロント環境変数
- `PUBLIC_DRAW_API_BASE`: `/api/draw/*` のベースURL（HTTP APIのエンドポイント）

## デプロイ手順（概要）
- Lambdaコードを **CJS (.cjs)** でビルドしてzip化してアップロード
- API Gateway に Lambda を統合
- SQS トリガーを secondary worker に設定
- Secrets Manager に CloudFront 秘密鍵を保存
- EventBridge `cron` で `draw-monthly-cleanup-prod` を毎月実行（前月を自動整理）

> 注意: S3 CORS は手動設定済み（GET/PUT/HEAD）。必要に応じて更新すること。

## 前月Top20保持（S3削除）ルール
- 実行タイミング: 毎月1回（JST基準、実行時刻はEventBridge側）
- 判定:
  - DynamoDB `DrawSubmissions` の GSI1（scoreSortKey）で前月Top20を取得
  - tie-breakは既存どおり `createdAt` 昇順（早い投稿優先）
- 削除対象:
  - `draw/prompt-YYYY-MM/` 配下のうち、Top20の `imageKey` 以外
- 監査ログ:
  - `targetMonth / scanned / keepCount / deleteCandidates / deleted` をCloudWatch Logsへ出力
- 安全策:
  - prefixガード（`draw/prompt-YYYY-MM/` 以外は削除しない）

## curl検証例
```bash
curl "https://<api>/api/draw/prompt?month=2026-02"
curl -X POST https://<api>/api/draw/upload-url -H 'Content-Type: application/json' -d '{"month":"2026-02"}'
curl -X POST https://<api>/api/draw/submit -H 'Content-Type: application/json' -d '{"submissionId":"...","imageKey":"draw/prompt-2026-02/...png","promptText":"30秒で熊を描いて"}'
curl "https://<api>/api/draw/leaderboard?month=2026-02&limit=20"
curl "https://<api>/api/draw/secondary?promptId=prompt-2026-02&submissionId=<ulid>"
```

## フロントの手動確認（/draw）
1) `/draw/` でお題を取得し、`/draw/play/` に遷移する  
2) 30秒描画 → 自動送信で `upload-url → PUT → submit` が行われる  
3) `/draw/result/` でスコアが表示される（一次結果）  
4) ランクイン時は `/api/draw/secondary` をポーリングしてコメント更新  

## Bedrock差し替えポイント（TODO）
- `backend/draw/src/handlers/submit.ts` の一次採点部分
- `backend/draw/src/handlers/secondaryWorker.ts` の二次レビュー生成

## コスト計算用メモ
- 各投稿で一次/二次の `input/output/total tokens` を `DrawSubmissions` に保存する。
- 推定コストはモデルごとの単価を掛けて計算する（`inputTokens * inputUnitPrice + outputTokens * outputUnitPrice`）。
