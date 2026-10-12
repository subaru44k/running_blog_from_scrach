# Draw: Canvas WebP品質90の公開引き継ぎ

## 状態・承認範囲

ユーザー承認：元解像度の非可逆WebP・品質90を実装し、commit/pushする。本セッションではdeployは実施しない。前の即時遷移変更（`75f16bf`）も未公開なので、この変更と併せて公開する。

今回の新規依存はバックエンドの `@jsquash/webp` 1.5.0 と推移依存 `wasm-feature-detect`。ブラウザ側に新規依存はない。LambdaはWASMデコーダーをバンドルし、外部からWASMを取得しない。ネイティブバイナリ・Layerは不要。

## 最終動作

- Canvas `toBlob(..., 'image/webp', 0.9)` で元解像度の画像を圧縮。非対応・失敗・容量増加時は元PNGに戻す。
- upload-urlに実際のMIMEを渡し、署名Content-Typeとキー拡張子を一致させる。旧クライアントは省略時PNGのまま。
- S3 PUT後に結果画面へ遷移し、アップロードした画像を表示して同じIDで採点する。
- submitと講評workerはWebPをPNGにデコードして白紙判定・AI入力を行う。非可逆圧縮の劣化はそのまま反映される。
- 既存PNG投稿・旧3軸の表示・ランキング・非同期講評と再送対応を維持する。

比較実験のSharp品質90とCanvas品質0.9は同じ出力とは限らない。Sol lowでの検証は1作品の反復であり、本番Decisions APIの同点を保証しない。

## ローカル検証

```sh
npm ci --prefix astro-blog
npm ci --prefix backend/draw
npm run typecheck --prefix backend/draw
npm run test:scoring --prefix backend/draw
npm run test:images --prefix backend/draw
npm run build --prefix backend/draw
```

フロントは `PUBLIC_DRAW_API_BASE` を対象APIに設定して完全ビルドし、`node astro-blog/scripts/sanity-check.mjs astro-blog/dist` を実行する。preview起動後、既存Python Playwright/Chromium環境で `python astro-blog/scripts/draw-flow-smoke.py http://127.0.0.1:4321` を実行する。スモークはAPIとPUTをモックし、実際のCanvas画像のMIME・バイト形式・キー・保存プレビューの一致も確認する。

## 本番公開順序（重要）

AWS認証済み環境で `docs/aws-resources.md` のリソースを使用する。Lambdaはap-northeast-1、CodeBuildはus-east-1。対象はpush済みの本変更コミットを固定する。

1. 対象コミットを取得し、上記検証とbackend buildを実行する。既存Lambda3関数のコード・設定と公開HTMLを、秘密値を記録せず退避する。別担当が同時公開していないことも確認する。
2. **worker**：`backend/draw/artifacts/draw-secondary-worker.zip` を `draw-secondary-worker-prod` へ反映。既存Handler・runtime・メモリ・secret・queue mapping設定を維持し、LastUpdateStatusがSuccessfulになるまで待つ。
3. **submit**：`backend/draw/artifacts/draw-submit.zip` を `draw-submit-prod` へ反映。同様に更新完了を確認。
4. **upload-url**：`backend/draw/artifacts/draw-upload-url.zip` を `draw-upload-url-prod` へ反映。同様に更新完了を確認。PNG省略指定とWebP指定で返るMIME/キー拡張子を確認。
5. **frontend**：既存CodeBuild `builddeploy-subaru-is-running-site` を対象コミットで起動。成功、CloudFront無効化完了、DrawPlay/DrawResultの新asset参照とHTTP 200を確認する。
6. 過去月の練習モードでブラウザから描画し、WebPまたはPNGの実MIMEでPUT成功→即時結果遷移→採点→講評doneを確認。点数が講評前後で変わらず、再読み込み/再試行で同じIDを使うことを確認する。当月ランキングにテスト投稿を作らない。
7. 既存PNGの作品詳細/アーカイブを確認。検証で作成した投稿ID/画像キーだけを記録し、その練習データのみ削除する。既存作品・ランキングを一括変更しない。

**フロントだけ先に公開しない。** 旧upload-urlはPNGで署名するため、新フロントのWebP PUTは失敗し得る。また、新しいWebPを旧submit/workerで処理するとPNG解析に失敗する。

S3/CloudFrontのキーやIAM権限の変更は不要。Content-Typeヘッダーを許可する既存CORS設定を維持し、本番ブラウザでPUTを確認する。デコーダーWASMはLambdaのZIP内に埋め込むため、フロントからWASMファイルを配信する必要はない。

## ロールバック・運用注意

フロントを旧版へ戻すと新規投稿がPNGに戻る。**WebP投稿が一度でも保存された場合、WebP対応submit/workerは残す。** 旧PNG専用のバックエンドへ戻すと、未採点・講評待ちのWebP投稿を処理できなくなる。既存WebPを一括変換・再採点しない。

過去の評価・再採点・エクスポート用スクリプトにはPNG固定の画像入力が残っている（例：`tools/draw-evaluation/export.mjs`、`backend/draw/scripts/model-compare.mjs`）。新しいWebP投稿に使用する場合は、先にWebP→PNGのデコードを追加するか、PNG投稿だけを対象にする。今回の本番API・月次cleanup・作品表示は両形式に対応している。

本セッションの環境にはAWS CLI/認証がなく、本番公開と本番スモークは未実施。ローカルテストの成功だけではdeploy完了と扱わない。

## このセッションでの検証結果

- backend型チェック、採点/署名URL/再送の10テスト、オフライン画像デコードの2テストが成功。
- backend buildで3関数の配布ZIPを生成。デコーダーはネットワーク取得なしで実行でき、PNG画素はそのまま、WebP画素は独立したSharpデコード結果と一致。白紙/線ありの判定も確認。
- frontend完全ビルド3,240ページとsanityが成功。ブラウザスモーク6項目で署名MIME・PUTバイト・保存プレビューの一致と即時結果遷移を確認。
- 提供画像720×720・92,324バイトはChromium Canvas品質0.9で21,406バイト（約76.8%削減）。解像度維持、変換失敗/非対応/容量増加でPNGへのフォールバックを確認。これは1画像・1ブラウザの実測であり全投稿の削減率保証ではない。
- AWS認証がないため本番deploy、本番練習スモークは未実施。

## 引き継ぎ実施結果（2026-10-11）

上記の未公開状態は解消済み。対象コミット `37cb3d4fd0ab0dca07fac7a2989a86b98c758b91` を本番公開した。

- backend型チェック、採点関連10テスト、画像デコード2テスト、backend buildが成功。frontend完全ビルド3,240ページ、sanity、ブラウザスモーク6項目も成功。
- 既存Lambdaコード・設定と公開play/result/archive HTMLを退避し、worker→submit→upload-urlの順に更新。3関数のLastUpdateStatus、配布ZIPのSHA-256一致、既存runtime/Handler/メモリ/環境変数等の維持を確認。
- PNG省略指定とWebP指定の署名MIME・拡張子を確認。既存PNG作品の詳細・画像取得も成功。
- CodeBuild `builddeploy-subaru-is-running-site:a7ddeaa5-13ca-4096-acf0-9fd614eda086` が指定コミットで成功。S3 syncは87秒、CloudFront無効化完了は22秒。公開DrawPlay/DrawResultの新asset参照とHTTP 200を確認。
- 2026年9月の練習モードで実Canvas描画をWebPとしてPUTし、PUT完了後約0.54秒で結果ページへ遷移。採点77点、講評done、講評前後の同点、再読み込み時の投稿ID維持、保存画像のWebPバイト形式とContent-Typeを確認。当月ランキングにはテスト投稿を作成していない。
- 検証投稿は `01M4N97AM4X5EV1N98D3D1RGS5`、画像キーは `draw/practice/prompt-2026-09/01M4N97AM4X5EV1N98D3D1RGS5.webp`。検証スクリプトの計測エラーで中断した投稿は `01M4N960HWB2QV6TAPA6YCMK6K`、画像キーは `draw/practice/prompt-2026-09/01M4N960HWB2QV6TAPA6YCMK6K.webp`。検証後、この2件だけをDynamoDB/S3から削除し、既存9月ランキングのID・順位・点数・名前の一致を確認済み。
- 作業開始前のローカルZIP変更は一度復元した後、内容を比較して不要と判断し、ユーザーの指示で破棄。4個のZIPは対象コミットの状態へ戻し、対応するGit stashも削除済み。未追跡dataは保持。公開時バックアップと検証記録はローカル `/tmp/subaru-webp-deploy-20261011/` に保存（秘密値を含み得る設定バックアップはリポジトリへ追加しない）。

既存設計に沿った公開と検証のため、設計判断の変更はない。
