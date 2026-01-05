# astro-blog

## 役割
Astroで生成する静的サイト本体。ブログ、PDF圧縮、ペース計算、問い合わせ、プライバシー、404ページなどの公開UIを提供する。

## 主要ファイル
- `astro-blog/src/pages/*.astro`
  - `index.astro`: トップページ（ツールへのハブ）
  - `blog.astro`: ブログUI（最新記事＋サイドバー機能）
  - `running-pace.astro`: ペース計算ツール
  - `pdf-compress.astro`: PDF圧縮UI（署名→圧縮API）
  - `contact.astro`, `privacy.astro`, `about.astro`, `404.astro`
  - `sitemap.xml.ts`: サイトマップ生成
- `astro-blog/src/layouts/Layout.astro`: 共通レイアウト/SEO
- `astro-blog/src/content/config.ts`: ブログコンテンツ設定
- `astro-blog/buildspec.yml`: CodeBuild用ビルド/デプロイ

## 入出力
- 入力: Markdown（`astro-blog/src/content/blog/*.md`）
- 出力: 静的HTML/CSS/JS（`astro-blog/dist`）
- 外部API: `PUBLIC_PDF_API_BASE` の `/sign-upload` と `/compress`

## 404/SEOポリシー
- 404ページは `/404.html` を返す（CloudFrontのカスタムエラー応答によりHTTP 404）。
- 404は `canonical` を出さず、`noindex,follow`。

## ローカル実行（分かる範囲）
- 依存インストール: `npm ci --prefix astro-blog`
- 開発サーバ: `npm run dev --prefix astro-blog`
- ビルド: `npm run build --prefix astro-blog`

## 変更時の注意点
- Layout で canonical / robots の出力条件を崩さない。
- `/blog` などの非正規URLは 404 方針に合わせる。
- `sitemap.xml.ts` のルートは正規URLに合わせて更新する。
