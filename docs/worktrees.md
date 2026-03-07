# Worktree メモ

このリポジトリでは、機能ごとに独立して改善しやすいように Git worktree を分けている。
基準コミットは `main` の `fff4218` から作成している。

## 一覧

| Worktree | Branch | 主用途 |
| --- | --- | --- |
| `/Users/yamadashinya/work/subaru-misc-blog` | `main` | 基準ワークツリー。統合作業や全体確認向け |
| `/Users/yamadashinya/work/wt-site-core` | `feature/site-core` | サイト全体の導線、ブログ、共通レイアウト、SEO |
| `/Users/yamadashinya/work/wt-draw` | `feature/draw` | 30秒お絵かきゲームのフロントとバックエンド |
| `/Users/yamadashinya/work/wt-pdf-compress` | `feature/pdf-compress` | PDF圧縮UI、署名アップロード、圧縮サービス |
| `/Users/yamadashinya/work/wt-fitbit-admin` | `feature/fitbit-admin` | Fitbit連携、管理スクリプト、記事生成支援 |
| `/Users/yamadashinya/work/wt-ops-docs` | `chore/ops-docs` | 運用ドキュメント、AWSメモ、runbook 整備 |

## 担当範囲

### `wt-site-core`

- 主に触る:
  - `astro-blog/src/pages/`
  - `astro-blog/src/layouts/`
  - `astro-blog/src/content/`
  - `astro-blog/public/`
- 向いている作業:
  - トップページ、ブログ、about/contact/privacy、404、ナビ、SEO
- できれば避ける:
  - `backend/draw/`
  - `pdf-compress-service/`
  - `lambdas/sign-upload-v3/`

### `wt-draw`

- 主に触る:
  - `astro-blog/src/pages/draw/`
  - `astro-blog/src/components/draw/`
  - `astro-blog/src/lib/draw/`
  - `backend/draw/`
  - `docs/draw-backend.md`
- 向いている作業:
  - お絵かきゲームの UI、採点、ランキング、月次お題、API 契約
- できれば避ける:
  - PDF圧縮関連
  - Fitbit関連

### `wt-pdf-compress`

- 主に触る:
  - `astro-blog/src/pages/pdf-compress.astro`
  - `pdf-compress-service/`
  - `lambdas/sign-upload-v3/`
  - `lambdas/pdf-compress-cleanup/`
  - `lambdas/pdf-compress-kill-switch/`
- 向いている作業:
  - PDF圧縮 UI、署名アップロード、Lambda、ECR、cleanup/kill-switch
- できれば避ける:
  - draw 関連
  - Fitbit 関連

### `wt-fitbit-admin`

- 主に触る:
  - `admin-app/`
  - `lambdas/fitbit-callback/`
  - Fitbit 関連の docs
- 向いている作業:
  - Fitbit OAuth、ワークアウト取得、記事ドラフト生成、月次集計
- できれば避ける:
  - draw / PDF圧縮の機能変更

### `wt-ops-docs`

- 主に触る:
  - `docs/`
  - `README.md`
- 向いている作業:
  - AWSリソース整理、運用メモ、runbook、設計ドキュメントの整合
- できれば避ける:
  - 実装コードの大きな変更

## 運用メモ

- 1機能の変更は、まず対応する worktree で行う
- 複数機能をまたぐ変更は、どこを主軸にするか先に決める
- `main` は統合・確認用に残し、日常の実装は各 worktree で進める
- 生成物や ZIP 更新が多い機能は、専用 worktree 側でまとめて扱う
