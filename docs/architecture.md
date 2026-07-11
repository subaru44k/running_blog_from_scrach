# アーキテクチャ概要

このリポジトリは、Astro 静的サイト（公開サイト）、管理用ツール群、Fitbit連携のLambda群、PDF圧縮サービス（Docker/Lambda）で構成されます。公開サイトは静的配信、ツールはAPIと外部サービス連携を前提としています。
運用上のガードレール（同時実行・TTL・サイズ上限・CORSなど）は `docs/ops-parameters.md` に集約しています。
フロントの検証用には、ブログ記事生成を省略する `ASTRO_BUILD_NO_POSTS=1` のクイックビルドを利用できます。ブログ記事一覧は `astro-blog/src/lib/blog-index.ts` に集約し、ビルド中に同じ content collection を何度も組み立てないようにしています。出力互換性の確認には `.dist-baseline` と `dist` を `npm run compare:dist --prefix astro-blog` で比較します。
Astroサイトの本番デプロイは CodeBuild から S3 + CloudFront へ行います。CodeBuild は Node.js 20 runtime と npm cache を使い、月次サマリーは `{YYYY-MM}-summary.md` の安定slugで生成します。HTMLとハッシュ付きJS/CSSの世代ずれを防ぐため、`dist/_astro` を先にアップロードして旧世代も保持し、その後に `_astro/*` を除外した残りの成果物を `--delete --size-only` で同期します。CloudFrontの全パス無効化は完了まで待機します。

## 全体像

```mermaid
flowchart LR
  subgraph Public[公開サイト]
    Astro["astro-blog<br/>静的サイト"]
    CF[CloudFront]
    S3Site[S3 静的ホスティング]
  end

  subgraph Admin[運用・作成]
    AdminApp["admin-app<br/>EJS/Express"]
    Scripts[管理スクリプト]
  end

  subgraph Fitbit[Fitbit連携]
    FitbitAPI[Fitbit API]
    Callback[fitbit-callback Lambda]
    TokenS3[Token S3]
  end

  subgraph PDF[PDF圧縮]
    Sign[sign-upload-v3 Lambda]
    Compress["pdf-compress-service<br/>Lambda/Docker + Ghostscript"]
    UploadS3[S3 uploads/outputs/previews]
  end

  User[Browser] --> CF --> S3Site --> Astro
  AdminApp --> Scripts --> Astro
  User --> Sign --> UploadS3
  User --> Compress --> UploadS3
  Callback --> TokenS3
  Scripts --> TokenS3
  Scripts --> FitbitAPI
```

## URL設計と404方針
- `/` は PDF圧縮、ペース計算、お絵かきゲーム、ミニゲーム、ブログへのハブページ。
- `/` はWebP化した生成画像を含むビジュアルハブとして、主要コンテンツへの導線をファーストビューと直下に配置する。生成画像は補助的な視覚要素であり、意味のあるラベルやCTAはHTMLテキストで提供する。
- ブログUIは `/blog/` に集約（記事URLは `/<slug>/` のまま）。
- `/draw/` は「30秒お絵描き採点ゲーム」のフロントページ。`/draw/archive/`（月別Top20）・`/draw/play/`・`/draw/result/` を含む。
- `/games/` は軽量なミニゲーム集のハブ。`/games/balloon-catch/`、`/games/dressup/`、`/games/dressup-next/`、`/games/match-quiz/`、`/games/janken/`、`/games/clock/`、`/games/snake/`、`/games/maze/`、`/games/tic-tac-toe/`、`/games/reversi/` を含む。
- `/games/balloon-catch/` は「ふうせんゲーム」。30秒で、犬を左右に動かしてCPUキャラクターが投げる風船をキャッチする。`おそい / ふつう / はやい` の難易度で投げる間隔・速度・同時数・横揺れを変え、犬は生成済みスプライトシートのみを使って描画する。スマートフォン横向きでも遊びやすいように「大きくあそぶ」表示を持ち、Fullscreen API が使える環境では全画面、使えない環境では CSS オーバーレイでゲーム画面を広く表示する。
- `/games/match-quiz/` は「えあわせクイズ」。画像を見て答えを4択で選ぶローカル保存型のクイズで、サンプルセットから即開始できる。開始導線は本文内の主ボタンに集約し、管理画面では読み取り専用のサンプルセットと、自作のローカルセット作成・削除、および自作セット内の問題追加・削除を扱う。カード保存は repository 層経由、出題生成は UI から分離したロジックで行う。
- `/games/dressup/` は「おしゃれゲーム」。テーマに合わせてコーデを作り、各部位に `なし` を含む選択肢から着せ替える。チャットさんは髪飾りから順に各部位を約2秒ずつかけて選び、最後は点数ではなく「どっちがすき？」を選んで遊ぶ。
- `/games/dressup-next/` は PNG レイヤー版おしゃれゲームの公開ルート。既存 `/games/dressup/` は置き換えず、各部位に画像プレビュー付きの約20種類の選択肢と部位内の前後ページ送りを持ち、完成後は編集用ホットスポットを隠し、チャットさんが部位ごとに選ぶ様子を表示してから「どっちがすき？」を選んで遊ぶ。sitemap と games Service Worker のナビゲーション/画像キャッシュ対象に含める。
- `/games/janken/` は `チャットさん` 対戦と `1対1` モードを持つ。`チャットさん` 対戦は約1秒の思考演出のあとに1回勝負を公開し、`1対1` は順番に手を選んでから同時公開する。
- `/games/clock/` はお題の時こくに合わせてアナログ時計の長針・短針を直接ドラッグして合わせる。長針が12をまたぐと短針側の時間も進退し、`やさしい / ふつう / むずかしい` で、ちょうどの時間 / 30分まで / 5分刻みへ出題範囲を広げる。正誤判定は `こたえる` ボタン押下時に行い、正解後は `つぎの もんだい` で進む。
- `/games/snake/` は `おそい / ふつう / はやい` の3速度モードを持ち、選んだ速度は次に「開始 / 再スタート」を押したときに反映される。
- `/games/balloon-catch/`、`/games/maze/`、`/games/snake/` は、キーボード・タッチに加えて Gamepad API 入力も受け付ける。想定環境は Android の Chrome 系ブラウザで、D-pad と左スティックで移動し、主要ボタンで開始/再開系の操作を行う。
- 同3ページでは方向入力を常にゲーム優先として扱い、矢印キー相当のコントローラ入力でブラウザ画面がスクロールしたり、フォーカス移動が起きたりしないよう抑止する。
- `/games/` 系は専用の Service Worker により静かにオフライン対応する。訪問後に `/games/` と各ゲームページ、および必要な静的アセットをキャッシュし、他のルートや API には作用させない。
- 正規ルート（例）: `/`, `/blog/`, `/running-pace/`, `/pdf-compress/`, `/contact/`, `/privacy/`。
- `/running-pace/` は同一ページ内に `#calculator`（計算）と `#table`（表）のアンカーを持つ。
- `/blog` や `/pace` は正規ルートではなく 404 が正しい挙動。
- CloudFront配下の存在しないURLは **HTTP 404** を返す（soft 404回避）。
- 404ページは Astro が生成する `/404.html` 相当の内容を返す。
- 404ページは **canonical を出さない**、`robots` は **noindex,follow**。

## SEO / AdSense 方針
- HTML の言語指定は日本語サイトとして `ja` に統一する。
- canonical は正規URLに対してのみ出力。
- 404ページは noindex,follow。
- sitemap は Astro 側で生成（`sitemap.xml.ts`）。
- AdSense 用 `ads.txt` は `astro-blog/public/ads.txt` から `/ads.txt` として静的配信する。
- AdSense 審査向けに、トップページと About で PDF圧縮、ペース計算、お絵かきゲーム、ミニゲーム、ブログを主要コンテンツとして明示する。
- AdSense 審査向けに、Privacy では Google と第三者配信事業者の広告 Cookie、パーソナライズ広告、オプトアウト導線、お絵かきゲームの画像/ランキングデータの扱いを明示する。
- `/draw/` と `/games/match-quiz/` は、インタラクティブ UI だけでなく、遊び方・データの扱い・向いている場面などの本文を持つ。
- Contact は X を唯一の公開連絡先とし、不具合報告、削除依頼、プライバシー、広告 Cookie 関連問い合わせを受け付けることを明示する。
- UI文言は日本語に統一し、信頼性/透明性の説明（about/contact/privacy）を明示。
- ランニング記事のうち `練習(弱)` `練習(中)` `練習(デフォルト)` は、個別記事ページを `noindex,follow` にする。
- 月次サマリー記事（slug に `-summary-` を含むもの、または `-summary` で終わるもの）も個別記事ページを `noindex,follow` にする。
- 上記3カテゴリの記事は sitemap から除外する。
- 月次サマリー記事も sitemap から除外する。
- ただし `/blog/` や `/archive/` などの一覧ページには残し、人向けの導線は維持する。
- `/archive/` は公開済み記事を年月別に表示し、各記事のカテゴリ表示と `category` クエリによるカテゴリ絞り込みを提供する。
- サイドバーのカテゴリ別一覧は直近記事に制限し、古いカテゴリ記事は `/archive/?category=...` へ誘導する。

## 30秒お絵描き採点ゲーム（フロント + API）
- `/draw/` → `/draw/play/` → `/draw/result/` の3ページ構成。
- 画像アップロード・採点・ランキングは **API Gateway + Lambda** のバックエンドで提供。
- フロントは `PUBLIC_DRAW_API_BASE` を用いて `/api/draw/*` を呼び出す。
- フロントのAPI通信にはタイムアウトを設け、結果画面は保存済み採点結果をお題・ランキングの取得成否から独立して表示する。部分的な取得失敗は無期限の読み込み表示にせず、エラーと再試行導線を表示する。
- お題は `GET /api/draw/prompt` でサーバーが月次決定（JST、`2026-02` を基準月として36題を順送り）。
- 画像は S3 にアップロードし、閲覧は CloudFront 署名URL（900秒）で返す。
- 一次審査の表示は「点数 + 4文の講評 + tips + breakdown」で完結する。
- 共有カード画像はブラウザ内の Canvas で生成してPNG保存する。
- `/draw/archive/` は 2026-02 以降の各月Top20をクライアント側で取得して表示する。
- `/draw/archive/` の各ランキングカードはクリックで詳細モーダルを開き、`GET /api/draw/submission?promptId=...&submissionId=...` から画像・点数・breakdown・講評・tips・お題・投稿日を取得して表示する。
- `/draw/` 系は sitemap に含める。グローバルナビから「お絵かきゲーム」として導線を提供する。
- `/games/` 系も sitemap に含める。グローバルナビには「ミニゲーム」を追加し、`/draw/` は独立導線のまま維持する。
- オフライン対応は install 訴求や専用案内を出さず、通常の閲覧体験のまま有効化する。
- 一次採点は OpenAI GPT-5 mini（`reasoning.effort=minimal`、JSON出力）を使用、失敗時はスタブにフォールバック。
- 一次の最終 score は server-side で rubric の weighted average を主軸に、軽い structural bonus / penalty を加えて 20〜100 に収める。
- token usage と推定コストは DrawSubmissions に保存し、AWS外モデルでも後から集計できるようにする。
- 画像保管は当月は全件保持し、毎月1日の月次ジョブで「前月Top20以外」を削除する。

## PDF圧縮のデータフロー
- PDFアップロードは最大50MBまで（S3のpresigned POSTポリシーで強制）。
- downloadUrl / previewUrl の有効期限はデフォルト10分（DOWNLOAD_URL_TTLで変更可）、Upload URLもデフォルト10分（UPLOAD_URL_TTL）。

```mermaid
sequenceDiagram
  participant User as Browser
  participant Sign as sign-upload-v3
  participant S3 as S3 (uploads/outputs/previews)
  participant Compress as pdf-compress-service

  User->>Sign: POST /sign-upload (filename, contentType, contentLength)
  Sign-->>User: url + fields, objectKey, bucket
  User->>S3: POST url + fields + file
  User->>Compress: POST /compress (bucket, key, level, options, keepSource)
  Compress->>S3: GET uploads/{objectKey}
  Compress->>Compress: Ghostscript で圧縮
  Compress->>S3: PUT outputs/*.pdf
  Compress->>S3: PUT previews/*.png (best-effort)
  Compress-->>User: downloadUrl, previewUrl, sizes
```

## Fitbit連携のデータフロー

```mermaid
sequenceDiagram
  participant User as Browser
  participant Fitbit as Fitbit API
  participant CB as fitbit-callback Lambda
  participant S3 as Token S3
  participant Admin as admin-app scripts

  User->>Fitbit: OAuth 認可
  Fitbit-->>CB: redirect (code)
  CB->>Fitbit: token exchange
  CB->>S3: 保存（token.json）
  Admin->>S3: token 読み込み
  Admin->>Fitbit: 活動データ取得
  Admin->>Admin: Markdown生成（Astro content）
```
