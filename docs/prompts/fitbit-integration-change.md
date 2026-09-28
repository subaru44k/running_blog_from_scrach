# Garmin / Fitbit連携変更プロンプト

## 目的
- Garmin優先の日単位選択とFitbit OAuthを維持しつつ、記事生成ロジックを安全に改善

## 前提
- トークン保存: `lambdas/fitbit-callback`
- 取り込み: `admin-app/scripts/import-workouts.js`（旧 `import-fitbit-workouts.js` は互換入口）
- Garmin取得: `admin-app/scripts/garmin.py import-data`。ローカル保存tokenを使用
- AWS CLI は使わない

## 変更範囲
- 両対応取り込みスクリプトとGarmin CLI
- 必要に応じてCallback Lambda

## 実行手順
1) 設計SSOTを確認し、Garmin優先・正常な対象ラン0件の日だけFitbit取得という選択を維持
2) 目的のフィルタ/整形を追加
3) 既存の出力フォーマットを壊さない
4) diff と検証手順を提示

## 検証
- 特定日の取り込みが成功する
- 出力Markdownのフロントマターが期待通り
- Garminがある日はFitbit APIを呼ばない。取得エラーを空データと扱わない
- 期間指定・再実行で同日記事が重複せず、編集済み記事が上書きされない

## 想定リスク
- APIレート制限
- GPS/TCXが取得できないケース

## ロールバック
- 変更箇所を元に戻す
