# 保存画像のWebP品質90への移行

2026-10-12、ユーザーが試算後に推奨案の実施とcommit/pushを承認した。PNG109枚を元解像度のChromium Canvas WebP品質0.9へ変換し、既存WebP3枚は再圧縮しない。小さくならない場合はPNGを維持する。画像は非可逆圧縮で画素が変化するが、採点・講評は再生成しない。

## 試算

- 全112画像: 10,159,141→2,876,120 bytes、71.69%削減。
- 過去月99画像: 9,546,587→2,662,184 bytes、72.11%削減。
- アーカイブ初期取得の同じ画像集合: PC48枚 4,301,727→1,123,740 bytes、スマホ21枚 1,643,007→481,264 bytes。lazy読み込みと月次APIの完了順により取得枚数は変動する。
- 東京S3 Standard $0.025/GB月で保存料の削減は約$0.00017/月。画像CloudFrontはPriceClass_100、$0.085/GBの従量帯を仮定するとアーカイブ全閲覧1000回で転送料約$0.545削減。無料枠内なら請求削減は0になり得る。閲覧リクエスト数、HTML/JS/API通信量は変わらない。
- 元解像度は全109枚で一致。代表画像と白背景合成PSNR最低作品を目視確認し、一覧表示で目立つ差は見られなかった。圧縮後の採点結果一致を保証する検証ではない。

## 実施手順

試算・原画像・変換済み画像は `/Users/yamadashinya/.local/share/subaru-draw/compression-assessment-20261011/`。`report.md`、`manifest.json`、`comparison.csv`、`originals/`、`compressed/` を保存している。準備画像は現在の `prepareUpload` と同じCanvas画像デコード→元解像度描画→`toBlob('image/webp', 0.9)` を使用した。ブラウザごとの出力バイト一致は保証しない。

1. 試験変換を準備する場合は、Python PlaywrightとChromiumを用意し、`python backend/draw/scripts/prepare-webp-migration.py <保存先の絶対パス> --chromium <実行ファイルの絶対パス>` を実行する。既存WebPは再圧縮しない。生成manifestと全画像の保存を確認後、`node backend/draw/scripts/migrate-saved-images.mjs apply <同じ保存先>` を実行。AWS標準プロファイルcodex-prod、ap-northeast-1の既存Drawリソースを使用。
2. 全投稿データを退避し、対象PNGが一意の投稿に対応することを確認。元S3画像とローカル原画像のSHA-256一致を確認。
3. 先に新しい`.webp`キーへContent-Type image/webpで保存し、全画像を読み戻してSHA-256一致を検証。既存の同名オブジェクトを上書きしない。
4. DynamoDBのimageKeyだけを旧キー条件付きで更新。点数・順位・講評・投稿日時・保存期限を含む他の全フィールドは読み戻して一致を確認。
5. 対象全109件の公開詳細とCloudFront署名画像を取得し、点数・講評・Content-Type・画像SHA-256を検証。SQSやAI APIは呼ばない。
6. 参照切替完了から署名URL TTLの900秒以上を待つ。閲覧中の古いURLのため元PNGをこの間保持する。
7. `node backend/draw/scripts/migrate-saved-images.mjs purge <同じ保存先>` を実行。検証成功・待機完了・元PNG未参照・新画像一致・ローカル原画像バックアップ一致を確認したうえで、旧ETag条件付きで元PNGだけを削除する。
8. 公開アーカイブと画像保存容量を再確認する。既存署名が期限切れ後もタブに残るケースは元の署名URL運用と同様に再取得が必要。

Lambda・フロント・CloudFront設定は変更しない。新キーで配信するためCloudFront無効化は不要。キャッシュ済み旧画像は通常の期限まで残る。

## 復旧と注意

元レコードは `migration-snapshot.json`、対応表とhashは `migration-plan.json`、切替時刻は `references-switched.json`、検証成功は `migration-verified.json`、削除完了は `migration-cleanup.json`。画像バックアップや投稿データはGitに含めない。

復旧する場合はバックアップPNGを元キーへ先に戻して検証し、当該新imageKeyと一致する投稿だけを旧キーへ条件付きで戻す。点数や講評は書き換えない。現在のsubmit/workerはWebP対応を維持する。過去のPNG固定評価ツールはWebP対応またはバックアップ原画像を使用する。月次cleanupを移行用途で呼ばない。

## 2026-10-12 反映結果

PNG109枚の新キーを検証しimageKeyを更新済み。退避した全112投稿についてimageKey以外の全フィールドの維持を確認し、移行109件の公開詳細・画像でもContent-TypeとSHA-256の一致を確認した。本番アーカイブを最後までスクロールして99枚と詳細モーダルの表示を確認し、画像本文の取得量は2,662,184bytes、ブラウザエラー0件。採点テスト10件・画像テスト2件・スクリプト構文チェックが成功。

参照切替は2026-10-12 21:26:28 JST。元PNGは900秒以上の猶予と全画像の公開検証後、2026-10-12 21:41 JST以降に109枚を削除済み。最終S3一覧は112枚すべてWebP、2,876,120bytes（10,159,141bytesから7,283,021bytes・71.69%削減）でPNG残存0枚。最終の全投稿読み戻しでもimageKey以外の全フィールドの一致を確認した。原画像112枚と全投稿バックアップはローカルに保持。
