# 30秒お絵描き採点ゲーム（Phase 1 バックエンド）

## アーキテクチャ概要
- API Gateway（/api/draw/*）
- Lambda（upload-url / submit / secondary worker / leaderboard / secondary status）
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
  - `draw-submit-prod`
  - `draw-secondary-status-prod`
  - `draw-secondary-worker-prod`
  - `draw-leaderboard-prod`
- API Gateway: `draw-api`（API ID: `2vzy10yq0e`, Endpoint: `https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com`）

## データフロー
1. **upload-url**: `POST /api/draw/upload-url`
   - submissionId(ULID) 生成
   - S3 PUT 署名URL発行
2. **画像PUT**: ブラウザから S3 へ直接PUT
3. **submit**: `POST /api/draw/submit`
   - 画像取得 → inkRatio gate → 一次採点（スタブ）
   - DynamoDB保存
   - ランクイン候補のみ SQS へ二次投入
4. **secondary**: SQSワーカーが二次レビュー（スタブ）実行
5. **secondary status**: `GET /api/draw/secondary?submissionId=...`
   - 202 pending / 200 done / 404 not_found
6. **leaderboard**: `GET /api/draw/leaderboard?promptId=...`
   - CloudFront署名URLを付与して返却

## DynamoDB スキーマ
### DrawSubmissions
- PK: `promptId` (string)
- SK: `submissionId` (ULID)
- attrs: createdAt, expiresAt, nickname, imageKey, score, breakdown, oneLiner, tips, isRanked, rank, secondaryStatus, enrichedComment, secondaryAttempts
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
- IMAGE_TTL_SECONDS=900
- SUBMISSION_TTL_DAYS=7

## デプロイ手順（概要）
- Lambdaコードをzip化してアップロード
- API Gateway に Lambda を統合
- SQS トリガーを secondary worker に設定
- Secrets Manager に CloudFront 秘密鍵を保存

> 注意: S3 CORS は手動設定済み（GET/PUT/HEAD）。必要に応じて更新すること。

## curl検証例
```bash
curl -X POST https://<api>/api/draw/upload-url -H 'Content-Type: application/json' -d '{"promptId":"prompt-2026-01-19"}'
curl -X POST https://<api>/api/draw/submit -H 'Content-Type: application/json' -d '{"promptId":"prompt-2026-01-19","submissionId":"...","imageKey":"draw/...png"}'
curl "https://<api>/api/draw/leaderboard?promptId=prompt-2026-01-19&limit=20"
curl "https://<api>/api/draw/secondary?submissionId=<ulid>"
```

## Bedrock差し替えポイント（TODO）
- `backend/draw/src/handlers/submit.ts` の一次採点部分
- `backend/draw/src/handlers/secondaryWorker.ts` の二次レビュー生成
