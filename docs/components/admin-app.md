# admin-app

## 役割
ブログ記事の管理UIと、Fitbitからの取り込み・月次集計などの運用スクリプトを提供する。

## 主要ファイル
- `admin-app/server.js`: EJS/Express ベースの管理UI
- `admin-app/views/*.ejs`: 管理画面テンプレート
- `admin-app/scripts/import-fitbit-workouts.js`: Fitbit → Markdown生成
- `admin-app/scripts/generate-monthly-summary.js`: 月次サマリ生成。CodeBuild では `--force` で実行し、`{YYYY-MM}-summary.md` の安定ファイル名で出力する

## 入出力
- 入力: `.env` の設定値、Fitbit API、S3 上の token.json
- 出力: `astro-blog/src/content/blog/*.md`
- 通常記事の `date` は管理UIで入力したJST日時を `+09:00` 付きISO 8601で保存する。編集保存時も元の時刻を保持する。
- Fitbit記事の `date` は対象ランの最も早い `startTime` を使う。有効な開始時刻がない日は記事を生成しない。
- FitbitのActivity ID `91060` は、活動名が `Workout` の場合もランとして取り込む既定対象とする。
- 日付範囲の取込は対象Activityが5日連続で見つからない場合に停止する。
- Fitbit APIのレート制限（HTTP 429）に到達した場合も、その日付で範囲取込を停止する。
- Fitbit tokenのrefresh結果は、Markdownを書き出さないdry-run時もS3へ保存する。
- 月次サマリーは走行時刻を持たないため、公開記事では日付だけを表示する。

## ローカル実行（分かる範囲）
- 依存インストール: `npm ci --prefix admin-app`
- 起動: `node admin-app/server.js`
- Fitbit取り込み: `node admin-app/scripts/import-fitbit-workouts.js --date YYYY-MM-DD` など

## 変更時の注意点
- 生成先は `astro-blog/src/content/blog` 固定。
- FitbitトークンのS3保存と連携するため、環境変数の整合に注意。
- カテゴリやタイトルのデフォルトは UI とスクリプトで一致させる。
