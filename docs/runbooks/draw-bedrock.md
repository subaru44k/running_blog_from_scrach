# Draw AI採点メモ

## モデル
- 一次採点: OpenAI GPT-5.6 Luna（`PRIMARY_MODEL_ID=gpt-5.6-luna`, `OPENAI_REASONING_EFFORT=none`）
- 二次講評: 廃止

## 必要IAM
- `secretsmanager:GetSecretValue`（OpenAI key secret）

## 失敗時の挙動
- 一次: 通常講評とこども向け講評を含むスタブ採点へフォールバック（サービス継続）
- こども向け講評に漢字が含まれるなど出力条件を満たさない場合は、サーバー定義のひらがな講評へフォールバックする

## 運用メモ
- モデルIDとreasoning設定は環境変数で明示する。Lunaでは `minimal` を使用しない。
- OpenAI の利用量は `DrawSubmissions.primaryInputTokens / primaryCachedInputTokens / primaryCacheWriteTokens / primaryOutputTokens / primaryEstimatedCostUsd` を集計して確認する
- 本番切替後は `primaryModelId=gpt-5.6-luna` と `aiFallbackUsed=false` の実投稿を確認する
- `childOneLiner` と `childTips` は通常講評とは別に保存するが、rubric、score、breakdown、rank は共有する
- 導入前のアーカイブTop20はバックフィル用スクリプトで一度だけ更新し、公開APIの読み取りではAIを呼び出さない
