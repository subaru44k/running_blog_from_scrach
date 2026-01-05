# admin-app

## 役割
ブログ記事の管理UIと、Fitbitからの取り込み・月次集計などの運用スクリプトを提供する。

## 主要ファイル
- `admin-app/server.js`: EJS/Express ベースの管理UI
- `admin-app/views/*.ejs`: 管理画面テンプレート
- `admin-app/scripts/import-fitbit-workouts.js`: Fitbit → Markdown生成
- `admin-app/scripts/generate-monthly-summary.js`: 月次サマリ生成

## 入出力
- 入力: `.env` の設定値、Fitbit API、S3 上の token.json
- 出力: `astro-blog/src/content/blog/*.md`

## ローカル実行（分かる範囲）
- 依存インストール: `npm ci --prefix admin-app`
- 起動: `node admin-app/server.js`
- Fitbit取り込み: `node admin-app/scripts/import-fitbit-workouts.js --date YYYY-MM-DD` など

## 変更時の注意点
- 生成先は `astro-blog/src/content/blog` 固定。
- FitbitトークンのS3保存と連携するため、環境変数の整合に注意。
- カテゴリやタイトルのデフォルトは UI とスクリプトで一致させる。
