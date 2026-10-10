# Draw AI採点・講評の運用

- 一次採点：OpenAI Decisions `gpt-6-luna`、decisions-original-v1。reasoning設定なし。MAP整数rubricとF点数。
- 講評：既存SQS→draw-secondary-worker-prod→OpenAI Responses `gpt-6-luna` / none。通常とひらがな子ども向けの4文、tipsを生成。点数は変更しない。
- 必要IAM：OpenAI secretのGetSecretValue、投稿Get/Put/Update、S3 Get、既存キューSend/Receive/Delete/GetAttributes。既存ロールに付与済み。
- 採点失敗：503、点数保存なし。講評投入失敗：reviewStatus=failed、点数保持。講評生成はリース45秒、最大3試行。一時失敗はSQS partial batch responseで再試行。
- worker timeout30秒、queue visibility180秒、batch size1。GET詳細はAIを呼ばずreviewStatusとコメントを返す。
- 成功投稿のprimaryProvider=openai-decisions、primaryModelId=gpt-6-luna、scoringVersion=game-score-v1、reviewStatus=done、secondaryModelId=gpt-6-lunaを確認する。
- 講評の子ども用表記が不正ならひらがな既定文を使う。旧投稿は旧講評を表示し、自動再採点・バックフィルはしない。
