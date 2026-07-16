# astro-blog

## 役割
Astroで生成する静的サイト本体。ブログ、PDF圧縮、ペース計算、問い合わせ、プライバシー、404ページなどの公開UIを提供する。

## 主要ファイル
- `astro-blog/src/pages/*.astro`
  - `index.astro`: トップページ（ツールへのハブ）
  - `blog.astro`: ブログUI（最新記事＋サイドバー機能）
  - `archive.astro`: 公開済み記事の年月別一覧。カテゴリ表示と `category` クエリによる絞り込みを提供し、古いカテゴリ記事を辿る導線を担う
  - `running-pace.astro`: ペース計算ツール（#calculator / #table のアンカーで計算と表を同一ページ内に配置）
  - `pdf-compress.astro`: PDF圧縮UI（署名→圧縮API）
  - `draw/index.astro`, `draw/play.astro`, `draw/result.astro`: 30秒お絵描き採点ゲーム（`/api/draw/*` と連携）
  - `draw/archive.astro`: 2026-02以降の月別ランキングTop20一覧（`/api/draw/prompt` + `/api/draw/leaderboard` + 詳細モーダル用 `/api/draw/submission`）
  - `games/dressup-next.astro`: PNG レイヤー版おしゃれゲームの公開ルート。プレイヤーとチャットさんで共有するベースモデル選択、モデル共通補正と必要なパーツだけの個別補正による既存衣装アセット再利用、各部位約20種類の画像プレビュー付きアイテム選択、部位内ページ送り、チャットさんの選択演出、完成後の編集UI非表示を提供し、sitemap と games Service Worker キャッシュ対象に含める
  - `contact.astro`, `privacy.astro`, `about.astro`, `404.astro`
  - `sitemap.xml.ts`: サイトマップ生成
- `astro-blog/src/layouts/Layout.astro`: 共通レイアウト/SEO。AdSense script と `google-adsense-account` メタタグを共通 `<head>` に出す
- `astro-blog/src/components/games/RelatedGames.astro`: 個別ミニゲームページの「ほかのゲーム」共通サイドバー。公開済みミニゲームと `/draw/` を統一表示し、現在ページはリンクではなく選択状態で表示する
- `astro-blog/src/content/config.ts`: ブログコンテンツ設定
- `astro-blog/buildspec.yml`: CodeBuild用ビルド/デプロイ

## 入出力
- 入力: Markdown（`astro-blog/src/content/blog/*.md`）
- 出力: 静的HTML/CSS/JS（`astro-blog/dist`）
- 外部API:
  - `PUBLIC_PDF_API_BASE` の `/sign-upload` と `/compress`
  - `PUBLIC_DRAW_API_BASE` の `/api/draw/*`（prompt/upload-url/submit/leaderboard/submission）
- CodeBuild:
  - Node.js 20 runtime を buildspec の `runtime-versions` で指定する
  - npm cache は `/root/.npm/**/*`
  - 月次サマリーは `admin-app/scripts/generate-monthly-summary.js --force` で `{YYYY-MM}-summary.md` に安定生成する
  - `dist/_astro` を先に同期して旧ハッシュ付きassetを保持し、その後に `_astro/*` を除外した残りを `--delete` で同期する（HTMLには `--size-only` を使わない）
  - CloudFront全パス無効化は完了まで待機する
  - 本番結果ページが今回生成したDrawResult assetを参照し、そのassetがHTTP 200になることをデプロイ後に確認する
  - buildspec は npm install、summary、Astro build、sanity、S3 sync、CloudFront invalidation完了の所要秒数をログ出力する

## 404/SEOポリシー
- 404ページは `/404.html` を返す（CloudFrontのカスタムエラー応答によりHTTP 404）。
- 404は `canonical` を出さず、`noindex,follow`。
- 月次サマリー記事は `*-summary-*` と `*-summary` の両方を noindex / sitemap 除外対象として扱う。

## ローカル実行（分かる範囲）
- 依存インストール: `npm ci --prefix astro-blog`
- 開発サーバ: `npm run dev --prefix astro-blog`
- ビルド: `npm run build --prefix astro-blog`

## 変更時の注意点
- Layout で canonical / robots の出力条件を崩さない。
- AdSense の publisher ID、所有確認メタタグ、`ads.txt` の値を変更する場合は `docs/architecture.yaml` と ADR も更新する。
- `/blog` などの非正規URLは 404 方針に合わせる。
- `sitemap.xml.ts` のルートは正規URLに合わせて更新する。
