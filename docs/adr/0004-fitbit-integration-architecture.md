# ADR 0004: Fitbit連携アーキテクチャ

- Status: Accepted
- Date: 2026-01-05

## Context
Fitbitの運動ログをブログ記事の下書きとして自動生成したい。

## Decision
- OAuthコールバックはLambdaで処理し、トークンをS3に保存
- 管理スクリプトがS3からトークンを読み取り、Fitbit APIを呼び出す
- Fitbitのtoken refresh結果は、記事生成のdry-run時もS3に保存する
- 生成結果はAstroのcontentディレクトリへMarkdownとして保存
- Workout本文にはFitbitの日次活動データにある総距離を表示し、取得できないスプリットのplaceholderは出力しない

## Consequences
- トークン管理はS3の運用に依存
- Fitbit APIのレート制限やデータ欠落を考慮する必要がある

## 2026-09-28: Garmin優先の日単位取込へ拡張

- 共通入口を `import-workouts.js` とし、既存の `import-fitbit-workouts.js` は同じ両対応処理へ委譲する。
- 日ごとにGarminの対象ランを先に確認し、存在する日はFitbitを取得しない。正常に検索して対象ランがない日だけFitbitへ切り替える。
- Garminの認証・通信・不正データは空データと区別し、範囲処理を停止する。Fitbit tokenは必要な日だけS3から読み込む。
- 既存frontmatter・本文・ファイル名/URLを維持し、既存の同日記事はスキップする。心拍などの新しい本文項目は追加しない。
- Garmin認証はローカルPython CLIと `~/.garminconnect/` の保存tokenを使用する。取得のみで、Garminの活動更新は行わない。
- 詳細は `docs/architecture.yaml` の `workout_import` と `garmin` を正とする。
