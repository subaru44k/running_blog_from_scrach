# ADR 0004: Fitbit連携アーキテクチャ

- Status: Accepted
- Date: 2026-01-05

## Context
Fitbitの運動ログをブログ記事の下書きとして自動生成したい。

## Decision
- OAuthコールバックはLambdaで処理し、トークンをS3に保存
- 管理スクリプトがS3からトークンを読み取り、Fitbit APIを呼び出す
- 生成結果はAstroのcontentディレクトリへMarkdownとして保存

## Consequences
- トークン管理はS3の運用に依存
- Fitbit APIのレート制限やデータ欠落を考慮する必要がある
