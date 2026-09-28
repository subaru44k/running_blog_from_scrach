# Garminのローカル認証・詳細取得

## 対象と前提

個人アカウントでランニング詳細を取得するローカルCLI。非公式の `python-garminconnect` 0.3.16を使用するため、Garmin側の変更で動かなくなる可能性がある。Python CLIは記事を作成せず、Nodeの `import-workouts.js` がGarmin / Fitbit両対応の記事生成を担当する。

- Python 3.12以上を `uv` で準備する（既存のシステムPythonは変更しない）。
- Python依存は `admin-app/requirements-garmin.txt` のバージョンとハッシュで固定する。
- 初回ログインはユーザー自身のターミナルで行う。秘密値をチャット・コマンド引数・環境変数へ貼り付けない。
- Garminの日本アカウント（garmin.com）を対象とする。garmin.cnは未対応。

## セットアップ

リポジトリのルートで実行する。このMacではCodexがセットアップ済み。

```sh
uv venv --python 3.12 admin-app/.venv-garmin
uv pip install --python admin-app/.venv-garmin/bin/python --require-hashes -r admin-app/requirements-garmin.txt
```

依存更新時は `requirements-garmin.in` と設計SSOTのバージョンを合わせ、以下で固定依存を再生成する。

```sh
uv pip compile admin-app/requirements-garmin.in --python-version 3.12 --generate-hashes --output-file admin-app/requirements-garmin.txt
```

## 初回ログイン（ユーザーが実行）

```sh
sh /Users/yamadashinya/work/subaru-misc-blog/admin-app/scripts/garmin.sh login
```

メールアドレス、非表示のパスワード、必要時に非表示の二段階認証コードを入力する。パスワードは入力中も表示されない。ログイン成功後はチャットで「ログインできた」と伝える。tokenの内容を貼り付ける必要はない。

認証tokenは `~/.garminconnect/garmin_tokens.json` に保存する。ディレクトリは0700、ファイルは0600。パスワードは保存しない。tokenは以後の取得・refreshに再利用する。Chromeへのログインとは別の認証である。

## 指定日の取得

```sh
sh /Users/yamadashinya/work/subaru-misc-blog/admin-app/scripts/garmin.sh fetch --date 2026-09-28
```

指定日はGarminのローカル日付として扱う。取得コマンドは保存済みtokenだけを使うため、tokenがない・無効な場合は入力待ちに切り替えず失敗終了する。ユーザー自身が `login` を再実行する。

取得物は `~/.garminconnect/activities/2026-09-28/` に保存される。

| ファイル | 内容 |
| --- | --- |
| `{activityId}.json` | 活動サマリー |
| `{activityId}-splits.json` | Garminが返したラップ |
| `{activityId}-details.json` | グラフ・軌跡用の詳細（Garmin側で間引かれる可能性がある） |
| `{activityId}-original.zip` | 元のFITファイルを含むZIP。自動展開はしない |
| `{activityId}.tcx` | TCX形式の活動データ |
| `manifest.json` | 一覧、サマリー、取得済みファイル、部分失敗、TCX内のラップ・GPS・心拍の件数 |

Garminのサマリー距離はm、時間は秒として記録する。大きい活動IDも精度を失わない文字列としてファイル名に使う。欠落した項目やスプリットを推測で補わない。TCX・詳細JSONの有無だけでFITの記録内容を断定せず、必要に応じて元のFITを解析する。

保存物はリポジトリ外に置き、0700/0600のアクセス権を設定する。認証やAPI例外の本文はログに表示しない。活動の変更・削除・アップロードは行わないが、tokenの自動更新は永続化する。AWS・公開サイト・Astro記事へ書き込まない。

## 終了コードと確認

- `0`: ログイン成功、または指定日の全取得が完了（ランニング0件も含む）。
- `1`: 認証・通信・アクセス上限・保存失敗など。認証・アクセス上限で処理は停止する。
- `2`: 活動検索は成功したが、一部の詳細を取得できなかった。`manifest.json` で確認する。

初回の実データ検証では、9/28の開始時刻・時間・距離をGarmin Connectと比較し、記録済みラップ、心拍、GPSを確認する。9/28は元のFIT、8ラップ、GPSと心拍各1,892点を実取得できた。

## Garmin / Fitbit両対応の記事取込

```sh
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --from 2026-09-27 --to 2026-09-28 --dry-run
```

既定は日ごとにGarminを先に確認し、対象ランがある日はFitbitを呼ばない。正常に検索して対象ランがない日だけFitbitへ切り替える。同日に別々のランが両ソースにあってもGarminのみを採用する。Garmin認証・通信エラーでは切り替えず停止する。`--source garmin` / `--source fitbit` で限定できる。従来の `import-fitbit-workouts.js` も同じ処理を呼ぶ。

記事取込はPython CLIの `import-data --date YYYY-MM-DD` からラン・記録済みラップのJSONを受け取り、秒・mをms・kmへ変換する。このモードは元のFIT/TCXを保存しない。記録済み1kmラップと最終端数を既存の矢印形式で出力し、1kmに揃わないラップは推測で分割しない。本文に心拍・GPS・パワーは追加しない。

記事は両ソースとも従来の `YYYY-MM-DD-fitbit-workout.md` に保存する。同日の既存取込記事（番号付きも含む）はAPI取得前にスキップして上書き・重複生成をしない。実行例・従来の環境変数は [admin-app README](../../admin-app/README.md) を参照。

アカウント不要の検証:

```sh
admin-app/.venv-garmin/bin/python -m unittest discover -s admin-app/test -p 'test_garmin_local.py'
```

## 参照

- [python-garminconnect（認証・取得クライアント）](https://github.com/cyberjunky/python-garminconnect)
- [Garmin公式の活動エクスポート](https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8)
- [Garmin公式Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) / [事業用途の利用条件](https://developer.garmin.com/gc-developer-program/program-faq/)
