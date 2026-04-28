# Codex 起動時メモ

このファイルは、Codex がこのリポジトリで作業を始めるときに最初に確認する入口です。詳細な設計や実リソースは各専用ドキュメントを正とします。

## 最初に読むもの
- `AGENTS.md`: 全タスク共通の必須ルール。設計判断に影響する変更では `docs/architecture.yaml` と関連 docs を同時更新する。
- `docs/architecture.yaml`: 設計 SSOT。ルート、SEO、外部連携、データフロー、AWS 境界、ビルド/実行前提の正とする。
- `docs/architecture.md`: 人間向けの全体設計と主要データフロー。
- `docs/README.md`: docs ディレクトリ全体の索引。

必要に応じて以下も参照する。
- `docs/aws-resources.md`: 本番 AWS リソース名、リージョン、API ID、Lambda 名、S3 バケット名。
- `docs/ops-parameters.md`: PDF 圧縮の TTL、サイズ上限、cleanup、kill switch などの運用値。
- `docs/runbooks/*.md`: 検証・デプロイ・運用手順。
- `docs/prompts/*.md`: Codex CLI に貼り付ける用途別プロンプト。

## 主要サブシステム
- `astro-blog/`: Astro v5 の公開静的サイト。ブログ、`/pdf-compress/`、`/draw/`、`/games/`、`/running-pace/` などを提供する。
- `backend/draw/`: 30秒お絵描き採点ゲームの API Gateway + Lambda バックエンド。S3、DynamoDB、CloudFront 署名 URL、Secrets Manager、OpenAI と連携する。
- `admin-app/`: Express/EJS のローカル管理 UI と、月次サマリー生成・Fitbit 取込スクリプト。
- `pdf-compress-service/`: Ghostscript 入り Lambda コンテナ。S3 の `uploads/` から PDF を読み、`outputs/` と `previews/` に書く。
- `lambdas/sign-upload-v3/`: PDF 用の S3 presigned POST を発行する Lambda。
- `lambdas/fitbit-callback/`: Fitbit OAuth callback を受け、token payload を S3 に保存する Lambda。
- `lambdas/pdf-compress-cleanup/`, `lambdas/pdf-compress-kill-switch/`: PDF 圧縮の一時ファイル削除と緊急遮断用 Lambda。

## よく使う確認コマンド
- Astro 通常ビルド: `npm run build --prefix astro-blog`
- Astro クイックビルド: `npm run build:quick --prefix astro-blog`
- Astro 出力比較: `npm run compare:dist --prefix astro-blog`
- Astro sanity check: `node astro-blog/scripts/sanity-check.mjs astro-blog/dist`
- Draw backend build: `npm run build --prefix backend/draw`
- Draw backend typecheck: `npm run typecheck --prefix backend/draw`

## AWS と秘密情報
- AWS CLI の標準プロファイルは `codex-prod`。実リソース名とリージョンは `docs/aws-resources.md` を参照する。
- 秘密値そのものはリポジトリに書かない。Secrets Manager、S3 token、`.env` の値は名前や保管場所だけを docs に残す。
- AWS / 外部 API / デプロイ境界を変える場合は設計判断として扱い、`docs/architecture.yaml` と関連 docs を同時更新する。

## 作業終了時の必須確認
- 変更が設計判断に影響するかを判断する。
- 最終回答に `Design decision affected: YES/NO` を明記する。
- YES の場合は、更新した設計 docs を列挙する。
