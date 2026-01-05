# Fitbit連携変更プロンプト

## 目的
- Fitbit OAuth とデータ取得フローを維持しつつ、記事生成ロジックを安全に改善

## 前提
- トークン保存: `lambdas/fitbit-callback`
- 取り込み: `admin-app/scripts/import-fitbit-workouts.js`
- AWS CLI は使わない

## 変更範囲
- Fitbit取り込みスクリプト
- 必要に応じてCallback Lambda

## 実行手順
1) 既存のFitbit API呼び出しとスコープを確認
2) 目的のフィルタ/整形を追加
3) 既存の出力フォーマットを壊さない
4) diff と検証手順を提示

## 検証
- 特定日の取り込みが成功する
- 出力Markdownのフロントマターが期待通り

## 想定リスク
- APIレート制限
- GPS/TCXが取得できないケース

## ロールバック
- 変更箇所を元に戻す
