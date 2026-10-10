# game-score-v1 / Decisions採点・非同期講評の公開手順

2026-10-09ユーザー承認：元のDecisions指示を本番採用、新規投稿からF採点。過去の点数は書き換えない。旧新点数の当月混在は既存SSOTの許容を維持する。

## 構成

Decisions gpt-6-lunaの4軸MAP段階→F→整数scoreを即時返却。指示は検証用decisions.mjsと完全一致をテストする。根拠文章を捏造しない。別SQS workerがGPT-6 Luna noneで通常/子ども向け講評を生成し、結果画面が詳細APIを2秒間隔・最大2分で再取得する。講評失敗でも点数保持。採点失敗時は503、ランダムfallback点なし。

## 検証・反映

1. npm run test:scoring / typecheck / build --prefix backend/draw。全2401rubricのF、採用指示の完全一致、再送、ゲート、失敗、非同期講評の独立更新とリトライを検証。
2. 本番secretで既存画像のDecisions採点・Responses講評を読み取り専用のローカルpreflightで実測する。
3. 既存Lambdaコード・環境設定、queue設定、mapping設定をローカルに退避する（secret値なし）。
4. workerへOpenAI secret / model=gpt-6-luna / effort=noneを設定しtimeout30秒、queue visibility180秒、batch size1・partial failureにする。worker/submissionを先に反映。
5. frontend完全ビルド・sanity確認。_astroのhash assetsを先にupload、変更対象draw/playとdraw/resultとdraw/archiveのHTMLだけ反映（サイト全体の削除syncを行わない）。CloudFront対象パスをinvalidate。
6. 最後にsubmitのqueue URLとDecisions model/provider設定・新コードを反映。
7. 過去月の練習投稿でAPI→保存→queue→reviewStatus=doneを検証し、テスト投稿/画像を削除。当月ランキングにはテストを入れない。

## ロールバック

退避したsubmitコード・環境へ戻す。必要ならworker/submission・queue/mappingと変更HTMLも戻す。旧hash assetsは保持する。既に保存されたF点数を再計算しない。公開画面はreviewStatus省略の旧APIと旧3軸に対応する。

## 2026-10-09 実施記録

本番反映完了。typecheck・8テスト・backend build・frontend完全ビルド3240ページ・sanityが成功。採用元指示と本番payload/hashは完全一致。実API事前確認で採点2.36秒、講評7.32秒。本番練習スモークの採点返却0.80秒、講評doneを7.08秒後に確認（ポーリング観測値、速度保証ではない）。点数89と各rubricが不変、同一投稿の再送でも同じ講評、両モデルgpt-6-luna、worker1試行を確認。ブラウザの描画・71点結果・非同期講評表示を確認。テスト練習データと画像は削除済み。queue残件0、mapping Enabled/Batch1/ReportBatchItemFailures、Lambda LastUpdateStatus Successful、CloudFront invalidation Completed。本番結果HTMLの新しいDrawResult asset参照とHTTP200を確認。退避先はdata/draw-decisions-deploy-20261009。
