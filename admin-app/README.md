# Astro Blog Admin

This is a standalone admin UI to manage (list, add, edit, delete) blog posts stored as Markdown files in the Astro blog repository. The admin edits files in `../astro-blog/src/content/blog` directly — no database.

## Setup

```bash
cd admin-app
npm install
npm start
```

By default, it connects to the `astro-blog/src/content/blog` folder next door. Make sure you have the Astro blog repo alongside this folder.

Features
- Lists posts with title, date, status, category, and filename.
- Create/edit posts with structured frontmatter fields (title, date and JST time, author, category, status, allowComments) and a Markdown body.
- Auto-generates filenames like `YYYY-MM-DD-my-title-<hash>.md` for new posts.
- Preview Markdown rendering without saving.

Notes
- The blog app reads Markdown frontmatter per `src/content/config.ts`; only `status: publish` is visible on the public site.
- The old Movable Type export (`old_blog_data/export_blog_1.txt`) is not used here; Markdown is the single source of truth.

Filename rules
- If the title contains only non-ASCII characters (e.g., Japanese), the app preserves them in the slug when possible. If a usable slug still cannot be produced, it falls back to `untitled`.
- A short hash is always appended to avoid collisions and to align with legacy naming styles.

Edit defaults
- In the edit form, when a post is missing these fields, the UI defaults to: Title → `練習`, Status → `publish`, Allow Comments → checked.
- New posts default to the current JST date and time. Editing preserves the stored
  time, and saved frontmatter uses an ISO 8601 timestamp with the `+09:00` offset.

## Garmin / Fitbit Workout Import

`node scripts/import-workouts.js` は、日ごとにGarminを先に確認して既存形式のブログ下書きを生成します。
従来の `node scripts/import-fitbit-workouts.js` も同じ処理へ委譲するため、既存の呼び出し方法を継続できます。

### 取得元

- 既定の `--source auto`: Garminの30秒以上のランがある日はGarminのみを使い、Fitbitは呼びません。
- Garmin検索に成功して対象ランがない日だけFitbitへ切り替えます。
- 同日に両機器で別のランを記録しても、Garminがある日はその日のFitbitをすべて除外します。
- `--source garmin` / `--source fitbit` で取得元を限定できます。
- Garminの認証・通信・アクセス制限・不正データは「ランなし」と扱わず、範囲処理を停止して失敗終了します。
- Fitbitの日次取得失敗やアクセス制限も停止します。対象ランが5日連続でない場合も失敗終了します。

### 認証と準備

GarminにはPython 3.12以上、`admin-app/.venv-garmin` の固定依存、ローカルtokenが必要です。
セットアップと初回認証は [Garmin手順](../docs/runbooks/garmin-local.md) を参照してください。
`--source fitbit` を使う場合はGarminの環境・認証は不要です。

Fitbitを使用する日だけ、AWS認証と以下の `admin-app/.env` 設定が必要です。
Garminだけの日はS3 tokenの読み込みやFitbit tokenのrefreshを行いません。

```dotenv
TOKEN_S3_BUCKET=your-secrets-bucket
TOKEN_S3_KEY=fitbit/token.json
FITBIT_CLIENT_ID=your-client-id
FITBIT_CLIENT_SECRET=your-client-secret
AWS_REGION=ap-northeast-1
```

Fitbit tokenは既存の `fitbit-callback` LambdaのOAuthフローでS3に保存します。
AWS標準プロファイルは `codex-prod` です。

### 実行例（リポジトリルート）

```sh
# 1日を確認（記事は書かずMarkdownを表示）
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --date 2026-09-28 --dry-run

# 両端を含む期間を確認
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --from 2026-09-27 --to 2026-09-28 --dry-run

# 期間を実際に取り込む
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --from 2026-09-27 --to 2026-09-28

# Fitbitだけを使う
AWS_PROFILE=codex-prod node admin-app/scripts/import-workouts.js --source fitbit --date 2026-09-27 --dry-run
```

- `--date YYYY-MM-DD`: 複数指定可能。同じ日付は1回だけ処理します。
- `--from YYYY-MM-DD --to YYYY-MM-DD`: 両端を含む期間。両オプションを一緒に指定します。
- `--days N`: 基準タイムゾーンの今日から直近N日。日付指定なしの既定は今日1日です。
- `--dry-run` または `FITBIT_IMPORT_DRY_RUN=true`: 記事を書き込まずMarkdownを表示します。使用ソースのtoken refreshは永続化します。
- `--help`: オプション一覧。

### 記事フォーマットと重複防止

既存frontmatterと `31分ジョグ(7.20km)` の本文、スプリットの矢印と5区間ごとの折り返しを維持します。
心拍・GPS・パワーなどの新しい本文項目は追加しません。Garminの秒・mはms・kmへ変換します。
Garminは記録済み1kmラップと最終端数を表示し、距離が1kmに揃わないラップは推測で分割せず省略します。
ラップ詳細404もスプリットを省略します。Fitbitも総距離だけのTCX lapから架空の1kmスプリットを作りません。
距離がない場合は括弧を省略し、スプリットがない場合は補足行を追加しません。

記事日時は採用ソースの最も早い有効なラン開始時刻です。Garminは `startTimeGMT` から基準オフセットへ変換し、
Fitbitは従来どおり日次ログの `startTime` を使います。有効な開始時刻がない日は記事を書かず警告します。

両ソースとも `astro-blog/src/content/blog/YYYY-MM-DD-fitbit-workout.md` に保存し、既存URLを維持します。
同日の取込記事がある場合はAPI取得前にスキップします。過去の番号付き記事も対象です。
編集済み記事の上書きや、再実行による番号付き重複記事は作成しません。

### 従来の環境変数

Garminにも従来の `FITBIT_DEFAULT_CATEGORY` / `FITBIT_DEFAULT_AUTHOR` / `FITBIT_DEFAULT_STATUS`
（既定draft）と `FITBIT_IMPORT_TZ_OFFSET`（既定540分/JST）を適用します。
`FITBIT_MAX_CONSECUTIVE_EMPTY_DAYS`（既定5）は両ソースの対象ランがない日数に適用します。

Fitbitの判定はRun系活動名・活動カタログに加え、既定Activity ID `91060` を含みます。
`FITBIT_RUN_ACTIVITY_NAMES` / `FITBIT_RUN_ACTIVITY_IDS` で変更できます。
`FITBIT_DISTANCE_RESOLUTION`（既定1sec）と `FITBIT_SPLIT_DEBUG` はFitbitの詳細取得に使用します。
TCXの取得には `activity` に加えて `location` スコープが必要です。
64bit `logId` は文字列のまま詳細URLへ渡します。
