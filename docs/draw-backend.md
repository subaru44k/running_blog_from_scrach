# 30秒お絵描き採点ゲーム（Phase 1 バックエンド）

## アーキテクチャ概要
- API Gateway（/api/draw/*）
- Lambda（prompt / upload-url / submit / leaderboard / submission / secondary worker / monthly cleanup）
- SQS（draw-secondary-queue-prod、非同期講評、可視性180秒、worker timeout30秒・batch size1・partial batch failure）
- DynamoDB（DrawSubmissions / DrawRateLimit）
- S3（ランキング対象画像: `draw/{promptId}/{submissionId}.png`、練習画像: `draw/practice/{promptId}/{submissionId}.png`）
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
  - `draw-submission-prod`
  - `draw-monthly-cleanup-prod`
- API Gateway: `draw-api`（API ID: `2vzy10yq0e`, Endpoint: `https://2vzy10yq0e.execute-api.ap-northeast-1.amazonaws.com`）

## データフロー
1. **prompt**: `GET /api/draw/prompt?month=YYYY-MM`（month省略時はJST今月）
   - サーバーが月次ルールで `promptId`/`promptText` を返す
   - 月次切替は JST ベース、`2026-02` を index 0（熊）として36題を順送り
   - `rankingEligible` はJSTの当月だけ `true`。過去月のお題は練習として遊べるが `false` を返す
2. **upload-url**: `POST /api/draw/upload-url`
   - submissionId(ULID) 生成（promptId はサーバー決定）
   - S3 PUT 署名URL発行
   - 過去月のお題では `draw/practice/` prefixを使い、ランキング用GSIに入らない投稿として扱う
3. **画像PUT**: ブラウザから S3 へ直接PUT
   - AWS SDK のリクエストチェックサム計算とレスポンスチェックサム検証は `WHEN_REQUIRED`（必須時のみ）
4. **submit**: `POST /api/draw/submit`（`promptText` は任意）
   - 画像取得 → inkRatio gate → Decisions API（gpt-6-luna、元の評価済み指示 decisions-original-v1）。4質問の7段階確率を検証し、最頻段階MAPを整数rubricへ変換（同確率は低い段階）。平均段階は点数換算に使わず別保存する
   - AIは最終得点や文章の根拠を生成しない。API失敗・拒否・不正回答はHTTP 503で再試行可能とし、スタブ点をランキングへ入れない
   - 採点を条件付きで保存後、SQSの講評ジョブを送る。再送は保存済みの点数・講評を返して上書きしない
   - 講評は別LambdaでGPT-6 Luna none Responsesから通常/子ども向けの4文とtipsを生成する。点数・rubric・ランキングは更新しない。キュー/講評失敗でも採点結果を保持する
   - 基礎点score-v2は換算 `[0,10,25,45,65,82,100]` ×重み40/25/20/15、お題段階0/1/2の上限15/35/55を適用し小数2桁
   - game-score-v1（採用F）は基礎点を0→0、15→35、35→60、45→70、65→79、82→95、100→100の区分線形で補正し小数2桁に丸める
   - baseScore / gameScore / promptVersion / rubricVersion / scoringVersion / primaryRubric / primaryAxisEvidenceを保存。公開scoreはgameScoreを整数に丸め、ランキングのキー形式・同点の日時/ID順は維持
   - 投稿・詳細APIは新方式のprimaryRubricを任意フィールドで返し、新UIは4軸を6段階として表示。過去投稿は旧3軸表示。legacy breakdownのoriginalityは新方式では未測定の互換用0
   - インクゲートは維持。ゲートには測定版を付けず講評生成をスキップする
   - 既存投稿の自動再採点は行わない。新規投稿から新方式を適用する
   - `imageKey` 内の promptId を優先し、サーバー側でお題テキストを確定
   - DynamoDB保存（provider/model/tokens/推定コストも保存）
5. **leaderboard**: `GET /api/draw/leaderboard?promptId=...` または `?month=YYYY-MM`
   - CloudFront署名URLを付与して返却
   - 開催中の順位は GSI1 の `scoreSortKey` 順から都度算出する
6. **submission detail**: `GET /api/draw/submission?promptId=...&submissionId=...`
   - archive 詳細モーダル用
   - 画像, 点数, rubric, breakdown, 講評, tips, reviewStatus, お題, 投稿日時を返却。AIは呼ばない。結果画面がpendingの間2秒ごと・最大2分再取得する
   - 順位は保存済みの暫定値を使わず、ランキング対象投稿であれば GSI1 の現在の並びから算出する
   - nickname や usage 情報のような内部項目は返さない
7. **monthly cleanup**: EventBridge（日次起動、月次確定はJST 1日のみ）→ `draw-monthly-cleanup-prod`
   - 対象は「前月の prompt」
   - Top20の順位・長期TTLを確定し、Top20以外の通常投稿をGSI1から除外する
   - S3 `draw/prompt-YYYY-MM/` 配下から Top20 以外を削除
   - S3 `draw/practice/` 配下の短期保持期限を過ぎた画像を削除

### フロント表示（履歴ページ）
- `/draw/archive/` は 2026-02 から前月までの確定済み各月について `prompt` と `leaderboard` を順次取得し、月別Top20を表示する。当月は表示しない。
- 各順位カードはクリックで詳細モーダルを開き、必要になった時だけ `submission detail` API を取得する。

## DynamoDB スキーマ
### DrawSubmissions
- PK: `promptId` (string)
- SK: `submissionId` (ULID)
- attrs: createdAt, expiresAt, nickname, imageKey, score, breakdown, oneLiner, tips, isRanked, rank, primaryRubric
- `oneLiner` は OpenAI の `review.summary / goodPoint / improvement / nextStep` をサーバ側で結合した 4 文講評を保存する
- 互換用に `secondaryStatus=skipped`, `enrichedComment=null`, `secondaryAttempts=0` を保持することがある
- AI usage attrs:
  - primaryProvider, primaryModelId, primaryInputTokens, primaryCachedInputTokens, primaryCacheWriteTokens, primaryOutputTokens, primaryTotalTokens, primaryLatencyMs, primaryEstimatedCostUsd
  - tokenRecordedAt, aiFallbackUsed
- TTL: expiresAt
- 当月のランキング対象投稿は `SUBMISSION_TTL_DAYS`（既定45日）保持し、月次cleanupで確定Top20のみ `ARCHIVE_TTL_DAYS`（既定3650日）へ延長する
- 過去月の練習投稿は `PRACTICE_SUBMISSION_TTL_DAYS`（既定7日）で短期保持し、ランキングGSI属性を持たない
- GSI1 (Leaderboard):
  - GSI1PK: promptId
  - GSI1のRange Key: `scoreSortKey = ${(100-score).padStart(3,'0')}#${createdAt}#${submissionId}`

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
- PRIMARY_PROVIDER=openai-decisions
- PRIMARY_MODEL_ID（採点モデル記録用: `gpt-6-luna`、Decisions呼び出しは評価済みモデルに固定）
- SECONDARY_QUEUE_URL（既存の非同期講評キュー）
- SECONDARY_MODEL_ID（講評: `gpt-6-luna`）
- OPENAI_REASONING_EFFORT（既定: `none`。Lunaでは `minimal` 非対応）
- OPENAI_API_KEY_SECRET_ID（OpenAI key を入れた Secrets Manager secret）
- IMAGE_TTL_SECONDS=900
- SUBMISSION_TTL_DAYS=45
- ARCHIVE_TTL_DAYS=3650
- LEADERBOARD_KEEP_LIMIT=20（cleanupがS3に残す件数）
- PRACTICE_SUBMISSION_TTL_DAYS=7（過去月の練習投稿を保持する日数）
- PRACTICE_IMAGE_RETENTION_DAYS=7（過去月の練習画像を保持する日数）

## フロント環境変数
- `PUBLIC_DRAW_API_BASE`: `/api/draw/*` のベースURL（HTTP APIのエンドポイント）

## デプロイ手順（概要）
- `npm run build --prefix backend/draw` で Lambdaコードを **CJS (.cjs)** にビルドし、`backend/draw/artifacts/*.zip` まで再生成する
- API Gateway に Lambda を統合
- Secrets Manager に CloudFront 秘密鍵と OpenAI API key を保存
- EventBridge `cron(15 18 * * ? *)` で `draw-monthly-cleanup-prod` を日次実行し、LambdaがJSTの1日のみ前月を確定し、それ以外の日は期限切れの練習画像だけを整理する
- 一次採点モデルを変更する場合は、先に `npm run snapshot-month-scores --prefix backend/draw -- YYYY-MM ...` でDynamoDBの対象月をバックアップし、再採点後に必要なら `npm run restore-month-scores --prefix backend/draw -- <snapshot.json>` で復元する
- game-score-v1導入時の既存投稿再採点は未実施。`rewrite-month-scores.mjs`等は旧6軸方式のため新方式の移行には使わない。移行をする場合は採用仕様に対応した専用手順と明示的な実施判断が必要

> 注意: S3 CORS は手動設定済み（GET/PUT/HEAD）。必要に応じて更新すること。

## 前月Top20保持（S3削除）ルール
- 実行タイミング: EventBridge日次起動、月次確定はJSTの1日のみ（UTC 18:15起動ならJST 03:15）。練習画像の期限切れ整理は毎日起動時に行う。
- 判定:
  - DynamoDB `DrawSubmissions` の GSI1（scoreSortKey）で前月Top20を取得し、順位を確定
  - tie-breakは既存どおり `createdAt` 昇順（早い投稿優先）
- DDB保持:
  - 当月投稿は最低45日残し、月次cleanup時点で前月ぶんの順位確定ができるようにする
  - cleanup実行時にTop20行の `expiresAt` を長期保持へ更新し、`rankingFinalizedAt` と順位を保存する
  - Top20以外の通常投稿は `GSI1PK/scoreSortKey` を削除して確定後のランキングから除外する
  - 練習投稿はランキング確定処理の対象外とする
- 削除対象:
  - `draw/prompt-YYYY-MM/` 配下のうち、Top20の `imageKey` 以外
- 監査ログ:
  - `targetMonth / scanned / keepCount / deleteCandidates / deleted / practiceDeleted` をCloudWatch Logsへ出力
- 安全策:
  - prefixガード（通常画像は `draw/prompt-YYYY-MM/`、練習画像は `draw/practice/` の配下だけを削除する）
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
- 旧方式の再計算スクリプトはgame-score-v1に未対応。新方式への再計算は別途実装・承認する

## コスト計算用メモ
- 各投稿で一次の `input/cached-input/cache-write/output/total tokens` と `primaryEstimatedCostUsd` を `DrawSubmissions` に保存する。Decisionsは入力 `$0.10` / 1M tokens、キャッシュ・出力料金なし。非同期講評のGPT-6 Luna Responsesは入力 `$0.10`、キャッシュ入力 `$0.01`、書き込み `$0.125`、出力 `$0.50` / 1M tokens。講評usageとsecondaryEstimatedCostUsdも保存する。
- OpenAI の利用分は AWS Cost Explorer では直接見えないため、DynamoDB 側の usage 集計を一次ソースにする。

## 2026-07-31 GPT-5.6 Luna切替
- 2026-02の既存投稿20件を同じrubricで比較し、`gpt-5.6-luna` / `reasoning.effort=none` を一次採点の本番候補として選定した。
- Luna / none は GPT-5 mini / minimal と比べ、比較実行では平均レイテンシ約2.86秒、推定費用約$0.01944/20件だった。
- 本番切替では `PRIMARY_MODEL_ID=gpt-5.6-luna` と `OPENAI_REASONING_EFFORT=none` を同時に設定する。Lunaは `minimal` 非対応。
- 比較レポート: `backend/draw/artifacts/model-compare-2026-02-2026-07-31-report.md`

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
- 2026-03-18 の追加考察:
  - `gpt-5.4-nano` は速度とコストの面ではかなり優秀だった
  - ただし、花・ボール・正体不明のモンスターのような「熊ではない」画像にも `promptMatch` を高く付ける傾向があり、お題一致の厳しさは不足気味だった
  - そのため、現時点では `gpt-5.4-nano` を一次採点の本命にするには不安が残る
  - 一方で `gpt-5-mini + reasoning.effort=minimal` は、速度とコストを現実的な範囲に抑えつつ、`gpt-4.1-mini` より高い弁別力を期待できる候補として最有力
  - 今後の候補優先順位は、現時点では `gpt-5-mini (minimal)` → `gpt-4.1-mini` → `gpt-5.4-nano` の順で考える
- 運用メモ:
  - 比較用 raw response は `artifacts/model-compare-*.raw.json` に保存する
  - 講評欠落や parser 取りこぼしの疑いがある場合は raw JSON から `output_text` と `usage.reasoning_tokens` を確認する

## ローカルのモデル比較ツール
- `backend/draw/scripts/model-compare.mjs` は、対象月の投稿をDynamoDBから、画像をS3から読み、設定したAIモデルで採点して比較する実験用CLI。通常のLambdaビルドには含まれない。
- `backend/draw/` で `npm run compare-models -- YYYY-MM 件数` を実行する。AWS認証と対象プロバイダーのAPI認証が必要で、実行時にAI APIの利用料が発生する。
- `OPENAI_MODELS`、`OPENAI_REASONING_EFFORT`、`MODEL_COMPARE_ONLY` で比較対象を指定する。GPT-5.6 LunaとGPT-6 Lunaの表示名・料金設定を持つが、本番モデルの設定は変更しない。
- OpenAIへの要求はstrict JSON Schemaを使い、通常・子ども向け講評を含む。本番に合わせた6軸のスコア式で、点数・講評・時間・token数・推定費用をHTML / JSON / raw JSON / TXTへ出力する。
- rubricの0点は0点として保持し、欠損・数値に変換できない値は5点へ補完する。
- 本番投稿・ランキングの更新処理は行わない。保存済みの比較レポートは実行時点の参考記録であり、今回の修正では再生成しない。

## 2026-10-09 本番反映

元のDecisions指示のgpt-6-luna採点と、gpt-6-luna / noneの非同期講評を本番反映済み。3 Lambda・既存SQS mapping/visibility・Draw対象HTMLを更新。練習モード実APIで採点89点が講評後も不変、pending→done（1試行）、再送で同一コメントを確認。ブラウザ描画でも71点・4軸・講評を確認。テスト練習投稿/画像は削除、既存投稿/ランキングは再採点していない。
