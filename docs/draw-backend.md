# 30秒お絵描き採点ゲーム（Phase 1 バックエンド）

## アーキテクチャ概要
- API Gateway（/api/draw/*）
- Lambda（prompt / upload-url / submit / leaderboard / monthly cleanup）
- DynamoDB（DrawSubmissions / DrawRateLimit）
- S3（画像保管: draw/{promptId}/{submissionId}.png）
- CloudFront（S3非公開 + 署名URL 15分）
- Secrets Manager（CloudFront署名の秘密鍵 / OpenAI API key）

### 実リソース（prod）
- S3: `draw-uploads-20260124-58904f87`
- CloudFront: `d1ih441smws3tt.cloudfront.net`（Distribution ID: `E2CQHMEVDKG7MU`）
- Key Group: `f2034b56-9310-4e45-add9-14ec838a2a86` / Public Key ID: `K1LW2OJ3ER8YUH`
- Secrets Manager: `draw/cf-private-key`
- DynamoDB: `DrawSubmissions`, `DrawRateLimit`
- Lambda:
 - `draw-upload-url-prod`
  - `draw-prompt-prod`
  - `draw-submit-prod`
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
   - 画像取得 → inkRatio gate → 一次採点（OpenAI GPT-4.1 mini、失敗時はスタブ）
   - 一次採点はAIに6項目rubric（0-10）を生成させ、最終scoreはサーバー側で算出
   - AI には `review.praise / review.improve / review.closing` の3フィールドを返させ、サーバー側で `oneLiner` に結合する
   - `oneLiner` は旧二次講評に近い役割を持つ3文の講評として返す
   - rubric の採点アンカーは `0-2 成立していない / 3-4 かなり弱い / 5-6 平均的 / 7 やや良い / 8 明確に良い / 9 かなり良い / 10 例外的`
   - スコア式は weighted average ベース
     - `score = round(max(20, weighted * 14 - 10))`
     - `weighted = promptMatch*0.30 + shapeClarity*0.22 + completeness*0.16 + composition*0.14 + creativity*0.10 + lineStability*0.08`
   - モデルが出した rubric をそのまま重視し、可視スコアだけを 20〜100 に広げる
   - 既存フロント互換のため breakdown(likeness/composition/originality) はrubricから集約して返却
   - `imageKey` 内の promptId を優先し、サーバー側でお題テキストを確定
   - DynamoDB保存（provider/model/tokens/推定コストも保存）
5. **leaderboard**: `GET /api/draw/leaderboard?promptId=...` または `?month=YYYY-MM`
   - CloudFront署名URLを付与して返却
6. **submission detail**: `GET /api/draw/submission?promptId=...&submissionId=...`
   - archive 詳細モーダル用
   - 画像, 点数, breakdown, 一次講評, tips, お題, 投稿日時を返却
   - nickname や usage 情報のような内部項目は返さない
7. **monthly cleanup**: EventBridge（月1回）→ `draw-monthly-cleanup-prod`
   - 対象は「前月の prompt」
   - S3 `draw/prompt-YYYY-MM/` 配下から Top20 以外を削除

### フロント表示（履歴ページ）
- `/draw/archive/` は 2026-02 以降の各月について `prompt` と `leaderboard` を順次取得し、月別Top20を表示する。
- 各順位カードはクリックで詳細モーダルを開き、必要になった時だけ `submission detail` API を取得する。

## DynamoDB スキーマ
### DrawSubmissions
- PK: `promptId` (string)
- SK: `submissionId` (ULID)
- attrs: createdAt, expiresAt, nickname, imageKey, score, breakdown, oneLiner, tips, isRanked, rank, primaryRubric
- `oneLiner` は OpenAI の `review.summary / goodPoint / improvement / nextStep` をサーバ側で結合した 4 文講評を保存する
- 互換用に `secondaryStatus=skipped`, `enrichedComment=null`, `secondaryAttempts=0` を保持することがある
- AI usage attrs:
  - primaryProvider, primaryModelId, primaryInputTokens, primaryOutputTokens, primaryTotalTokens, primaryLatencyMs, primaryEstimatedCostUsd
  - tokenRecordedAt, aiFallbackUsed
- TTL: expiresAt
- 通常投稿は `SUBMISSION_TTL_DAYS`（既定45日）保持し、月次cleanupで確定Top20のみ `ARCHIVE_TTL_DAYS`（既定3650日）へ延長する
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
- CLOUDFRONT_DOMAIN
- CF_KEY_PAIR_ID
- CF_PRIVATE_KEY_SECRET_ID
- PRIMARY_PROVIDER=openai
- PRIMARY_MODEL_ID（一次採点: GPT-4.1 mini）
- OPENAI_API_KEY_SECRET_ID（OpenAI key を入れた Secrets Manager secret）
- IMAGE_TTL_SECONDS=900
- SUBMISSION_TTL_DAYS=45
- ARCHIVE_TTL_DAYS=3650
- LEADERBOARD_KEEP_LIMIT=20（cleanupがS3に残す件数）

## フロント環境変数
- `PUBLIC_DRAW_API_BASE`: `/api/draw/*` のベースURL（HTTP APIのエンドポイント）

## デプロイ手順（概要）
- `npm run build --prefix backend/draw` で Lambdaコードを **CJS (.cjs)** にビルドし、`backend/draw/artifacts/*.zip` まで再生成する
- API Gateway に Lambda を統合
- Secrets Manager に CloudFront 秘密鍵と OpenAI API key を保存
- EventBridge `cron` で `draw-monthly-cleanup-prod` を毎月実行（前月を自動整理）

> 注意: S3 CORS は手動設定済み（GET/PUT/HEAD）。必要に応じて更新すること。

## 前月Top20保持（S3削除）ルール
- 実行タイミング: 毎月1回（JST基準、実行時刻はEventBridge側）
- 判定:
  - DynamoDB `DrawSubmissions` の GSI1（scoreSortKey）で前月Top20を取得
  - tie-breakは既存どおり `createdAt` 昇順（早い投稿優先）
- DDB保持:
  - 当月投稿は最低45日残し、月次cleanup時点で前月ぶんの順位確定ができるようにする
  - cleanup実行時にTop20行の `expiresAt` を長期保持へ更新し、archiveページ用の順位・メタデータを維持する
- 削除対象:
  - `draw/prompt-YYYY-MM/` 配下のうち、Top20の `imageKey` 以外
- 監査ログ:
  - `targetMonth / scanned / keepCount / deleteCandidates / deleted` をCloudWatch Logsへ出力
- 安全策:
  - prefixガード（`draw/prompt-YYYY-MM/` 以外は削除しない）
  - 旧形式キー（例: `prompt-YYYY-MM-DD`）は復旧時に月次キーへ移してから管理する

## curl検証例
```bash
curl "https://<api>/api/draw/prompt?month=2026-02"
curl -X POST https://<api>/api/draw/upload-url -H 'Content-Type: application/json' -d '{"month":"2026-02"}'
curl -X POST https://<api>/api/draw/submit -H 'Content-Type: application/json' -d '{"submissionId":"...","imageKey":"draw/prompt-2026-02/...png","promptText":"30秒で熊を描いて"}'
curl "https://<api>/api/draw/leaderboard?month=2026-02&limit=20"
```

## フロントの手動確認（/draw）
1) `/draw/` でお題を取得し、`/draw/play/` に遷移する  
2) 30秒描画 → 自動送信で `upload-url → PUT → submit` が行われる  
3) `/draw/result/` でスコアが表示される（一次結果）  
4) ランキングと共有導線がそのまま表示される  

## OpenAI差し替えポイント
- `backend/draw/src/handlers/submit.ts` の一次採点部分
- OpenAI key は Secrets Manager から取得する
- 既存データの再計算は `backend/draw/scripts/rewrite-month-scores.mjs` を使う

## コスト計算用メモ
- 各投稿で一次の `input/output/total tokens` と `primaryEstimatedCostUsd` を `DrawSubmissions` に保存する。
- OpenAI の利用分は AWS Cost Explorer では直接見えないため、DynamoDB 側の usage 集計を一次ソースにする。

## 一次採点モデル比較メモ（2026-03-13）
- 比較対象:
  - Claude 3 Haiku（現行）
  - GPT-4.1 mini
  - Gemini 2.5 Flash
- 比較方法:
  - 2026-02 の既存画像 20 件を同じ rubric / 同じスコア式で再採点
  - 画像付き比較レポートをローカル生成し、順位・短評・rubric を目視比較
  - 直前ランとの差分から rubric の再現性と順位変動も確認
- 判断メモ:
  - Claude 3 Haiku はお題不一致の画像に対しても rubric が中庸に寄りやすく、例として「花の絵」が `promptMatch=5` 付近になることがあった
  - GPT-4.1 mini はお題不一致に対して `promptMatch` を 1 付近まで下げるケースがあり、花を花として指摘する短評も出せた
  - Gemini 2.5 Flash は納得感のある高得点が出ることがあるが、遅延（約7〜22秒）とコストが大きく、ランごとの揺れも目立った
  - GPT-4.1 mini は score 自体は低めに寄るが、rubric の弁別力と順位安定性は今回の3候補で最も良かった
- 暫定結論:
  - 将来の一次採点置き換え候補としては GPT-4.1 mini が最有力
  - 置き換える場合は、モデル自体より score 式の再調整で点数レンジを整える前提にする
  - Gemini 2.5 Flash は精度比較の参考としては有用だが、一次採点本番用途としては速度とコストが重い

## OpenAI 5系モデル比較メモ（2026-03-17）
- 比較対象:
  - GPT-4.1 mini
  - GPT-5 mini
  - GPT-5 nano
  - GPT-5 mini (`reasoning.effort = minimal / low`)
  - GPT-5 nano (`reasoning.effort = minimal / low`)
- 比較方法:
  - 2026-02 の画像 20 件を同じ prompt / rubric / score 式で再採点
  - `backend/draw/scripts/model-compare.mjs` で HTML / JSON / raw JSON を生成
  - avg/min/max latency、usage token、推定価格を比較
- 実測サマリー:
  - `gpt-4.1-mini`
    - `3879 / 2741 / 5410 ms`
    - 入力 `44,601`, 出力 `3,775`
    - 推定 `$0.023880`（約 `3.58円`）
  - `gpt-5-mini`
    - `14037 / 8498 / 21095 ms`
    - 入力 `37,019`, 出力 `23,783`, reasoning `18,944`
    - 推定 `$0.056821`（約 `8.52円`）
  - `gpt-5-mini (minimal)`
    - `4512 / 3581 / 6039 ms`
    - 入力 `37,019`, 出力 `4,311`
    - 推定 `$0.017877`（約 `2.68円`）
  - `gpt-5-mini (low)`
    - `7002 / 5170 / 9522 ms`
    - 入力 `37,019`, 出力 `8,175`, reasoning `3,648`
    - 推定 `$0.025605`（約 `3.84円`）
  - `gpt-5-nano`
    - `15738 / 9831 / 23853 ms`
    - 入力 `42,398`, 出力 `41,365`, reasoning `36,160`
    - 推定 `$0.018666`（約 `2.80円`）
  - `gpt-5-nano (minimal)`
    - `3093 / 2046 / 4741 ms`
    - 入力 `42,398`, 出力 `4,872`
    - 推定 `$0.004069`（約 `0.61円`）
  - `gpt-5-nano (low)`
    - `4466 / 2825 / 6900 ms`
    - 入力 `42,398`, 出力 `10,207`, reasoning `4,928`
    - 推定 `$0.006203`（約 `0.93円`）
- 判断メモ:
  - GPT-5 系はデフォルト reasoning のままだと遅かった
  - `reasoning.effort = minimal` にすると速度・コストが大きく改善した
  - 特に `gpt-5-nano (minimal)` は `gpt-4.1-mini` より速く、かなり安い
  - 一方で、実際の rubric 品質や講評の納得感は別途レポートを見て判断する必要がある
- 運用メモ:
  - 比較用 raw response は `artifacts/model-compare-*.raw.json` に保存する
  - 講評欠落や parser 取りこぼしの疑いがある場合は raw JSON から `output_text` と `usage.reasoning_tokens` を確認する
