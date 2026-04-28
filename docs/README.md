# Docs Overview

このディレクトリは、本リポジトリの設計・運用・変更ガイドをまとめたものです。人間にもAI（Codex CLI）にも読みやすい構成を意識しています。

## 目次
- `docs/architecture.md`: 全体設計とデータフロー
- `docs/architecture.yaml`: AI向けの構造化設計
- `docs/codex-startup.md`: Codex起動時に最初に読むプロジェクト概要
- `docs/components/*.md`: コンポーネント別の詳細
- `docs/runbooks/*.md`: 検証・デプロイ手順
- `docs/prompts/*.md`: Codex CLI 用のプロンプト集
- `docs/adr/*.md`: 設計判断（ADR）

## TODO / Assumptions
以下は未確定または環境依存のため、確定後に更新してください。

- AWS実リソース名・リージョン・API ID・Lambda名は `docs/aws-resources.md` を参照
- PDF圧縮のTTL・サイズ上限・cleanup・S3削除ポリシーは `docs/ops-parameters.md` を参照
- TODO: Fitbitトークン保管のS3バケット名と暗号化方式の正式な運用ルール
- TODO: 管理アプリの本番利用有無（ローカル専用か、社内用か）
- 未確定: CloudFront Functions / OAC の更新ポリシーと権限境界
