# 検証手順

## 1) 404ポリシー
### 期待値
- 存在しないパスは **HTTP 404**
- 404ページは `noindex,follow`
- 404ページは canonical を出さない

### 確認（curl）
```
curl -I https://subaru-is-running.com/this-page-does-not-exist
```
期待:
- `HTTP/2 404`
- `content-type: text/html`

### 404ページのSEOタグ確認
```
curl -s https://subaru-is-running.com/404.html | head -n 60
```
期待:
- `<meta name="robots" content="noindex,follow">`
- `<link rel="canonical" ...>` が **出力されない**

## 2) 正常ページのcanonical
```
curl -s https://subaru-is-running.com/running-pace/ | head -n 60
```
期待:
- `<link rel="canonical" href="https://subaru-is-running.com/running-pace/">`

## 3) PDF圧縮 E2E
TODO: 公開APIのエンドポイント/認証経路を確定後に追記。

## 4) Garmin / Fitbit連携

アカウント不要のテスト:

```sh
npm test --prefix admin-app
admin-app/.venv-garmin/bin/python -m unittest discover -s admin-app/test -p 'test_garmin_local.py'
```

実アカウントでは [Garmin手順](garmin-local.md) の認証後、以下を実行する。

```sh
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --from 2026-09-27 --to 2026-09-28 --dry-run
```

9/27はGarminに対象ランがなくFitbit、9/28はGarminが選択されることを実確認済み。本文は既存の分数ジョグ・距離・矢印スプリット形式。dry-runは記事を書き込まない。既存の同日取込記事がある場合は両APIを呼ぶ前にスキップする。

Fitbit単独を確認する場合は `--source fitbit` を指定する。
