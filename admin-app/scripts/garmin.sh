#!/bin/sh
set -eu
task_admin_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
task_python="$task_admin_dir/.venv-garmin/bin/python"
if [ ! -x "$task_python" ]; then
  echo 'Garmin用Python環境がありません。docs/runbooks/garmin-local.md のセットアップ手順を実行してください。' >&2
  exit 1
fi
exec "$task_python" "$task_admin_dir/scripts/garmin.py" "$@"
