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
- Create/edit posts with structured frontmatter fields (title, date, author, category, status, allowComments) and a Markdown body.
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

## Fitbit Workout Import

The script `scripts/import-fitbit-workouts.js` turns Fitbit activity logs into draft
Markdown posts. Requirements:

1. Complete the Fitbit OAuth flow using the `fitbit-callback` Lambda so tokens are stored in S3.
2. Export the following environment variables before running the script (or place them in `admin-app/.env`):

   ```bash
   export TOKEN_S3_BUCKET=your-secrets-bucket
   export TOKEN_S3_KEY=fitbit/token.json      # optional
   export FITBIT_CLIENT_ID=...                # from Fitbit application settings
   export FITBIT_CLIENT_SECRET=...
   export AWS_REGION=ap-northeast-1           # or your region
   ```

   Example `.env`:

   ```bash
   TOKEN_S3_BUCKET=your-secrets-bucket
   TOKEN_S3_KEY=fitbit/token.json
   FITBIT_CLIENT_ID=...
   FITBIT_CLIENT_SECRET=...
   AWS_REGION=ap-northeast-1
   ```

3. Run the script (defaults to import yesterday’s activities):

   ```bash
   node scripts/import-fitbit-workouts.js
   ```

   Options:

   - `--date YYYY-MM-DD` import a specific date (can be repeated)
   - `--days N` import the last `N` days (defaults to 1 → yesterday)
   - Set `FITBIT_IMPORT_DRY_RUN=true` to skip writing files
   - Adjust `FITBIT_IMPORT_TZ_OFFSET` (minutes, default `540` for JST) if you want
     timestamps rendered in a different timezone
   - `FITBIT_DISTANCE_RESOLUTION` to control intraday distance sampling when
     computing run splits (`1sec` by default; use `1min` if you hit API limits)
   - `FITBIT_DEFAULT_CATEGORY`, `FITBIT_DEFAULT_AUTHOR`, and `FITBIT_DEFAULT_STATUS`
     customise the generated frontmatter
   - `FITBIT_SPLIT_DEBUG=true` to log why 1 km splits could not be computed

The script refreshes the Fitbit access token when needed and persists the updated
refresh token back to S3. Generated posts are created under
`astro-blog/src/content/blog` with filenames like
`YYYY-MM-DD-fitbit-workout.md` and default to draft status so you can review and
edit before publishing.

Activities will include 1 km splits when Fitbit laps are present or when
distance time series data is available (fallback uses TCX trackpoints if provided).

Note: The TCX endpoint requires the `location` scope in addition to `activity`.
If your access token was created without `location`, reauthorize the Fitbit app
with that scope and rerun the importer.
