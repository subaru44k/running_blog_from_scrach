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
    - 描画UIは初期ペンに加えて色選択、白消しゴム、1手戻す操作を持ち、白背景PNGを送る
  - `draw/archive.astro`: 2026-02から前月までの確定済み月別ランキングTop20一覧（`/api/draw/prompt` + `/api/draw/leaderboard` + 詳細モーダル用 `/api/draw/submission`）。当月は表示しない
    - Top20画像をレスポンシブなギャラリーで表示し、作品詳細は選択時だけ取得する
  - `games/dressup-next.astro`: PNG レイヤー版おしゃれゲームの公開ルート。プレイヤーとチャットさんで共有するベースモデル選択、独立した `src/lib/games/dressup-next-models.json` による位置補正管理（頭・首元・腰・左右の足首を変形原点にし、部位共通補正とアイテムの部分補正を合成）と既存衣装アセット再利用、各部位約20種類の画像プレビュー付きアイテム選択、部位内ページ送り、チャットさんの選択演出、完成後の編集UI非表示を提供し、sitemap と games Service Worker キャッシュ対象に含める
    - 位置補正の `x` / `y` / `originX` / `originY` は共通の 1024×1536 キャンバスに対する百分率。原点まわりで `scaleX` / `scaleY` を適用してから平行移動する。`fit.layers` を部位の既定値、`fit.items[slot][itemId]` を部分上書きとし、靴は `leftShoe` / `rightShoe` を個別指定できる
    - アセット作成スクリプトはアイテムカタログだけを再構築し、モデル選択・位置補正の manifest を上書きしない。補正変更時は全5部位のアイテムを3モデルで目視確認し、`node --test backend/draw/scripts/dressup-next-fit.test.mjs` で共通キャンバス・部分上書き・全60足のつま先被覆を検証する。ゲームの HTML / script 変更時は cache-first の `public/games-sw.js` のバージョンも更新する
  - `games/tv-catch.astro`: 30秒で犬を左右に動かし、わるいひとが棚から跳ね落とすテレビを自動キャッチする静的ミニゲーム。3難易度、タッチ・キーボード・ゲームパッド操作、「大きくあそぶ」に対応する
  - `games/reversi.astro`: チャットさん対戦／2人対戦の静的リバーシ。合法手がない側は自動パス、両者の連続パスで終了し、パス後のAI手番でも遅延予約を失わない
  - `games/music.astro`: 4モードの音楽ミニゲーム。共通 React UI、SVG 譜面、Web Audio 合成音、UI から独立した音楽・判定ロジックを利用する
    - SMuFL Bravura の音部記号と四分休符の SVG 輪郭を使い、ト音記号の G4 線とヘ音記号の F3 線を合わせる。単独音符の符幹は第3線以上で左側から下向き、第3線より下で右側から上向きにする（両音部記号共通）。リズムは開始ボタン、4拍の初回カウント、最初の小節の2拍分の休符、各小節の冒頭1拍の休符、各小節間2拍の譜面プレビューを持つ。小節の組み合わせは毎回生成し、開始後は固定する
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
  - AWSコンソール、AWS MCP、または認証済みAWS CLI（`codex-prod`）から既存プロジェクトを起動し、確認したGitコミットを指定する
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
