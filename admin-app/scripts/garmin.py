#!/usr/bin/env python3
"""Interactive local authentication and read-only Garmin activity inspection."""

import argparse
import getpass
import json
import logging
import math
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectNotFoundError,
    GarminConnectTooManyRequestsError,
)

TOKEN_DIR = Path.home() / ".garminconnect"
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"


class UserError(Exception):
    """A message safe to show without exposing a library response or token."""


def private_dir(path):
    if path.is_symlink():
        raise UserError("保存先にシンボリックリンクは使用できません。")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.chmod(0o700)


def private_write(path, data):
    # O_NOFOLLOW also protects an existing export file from symlink traversal.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(data)


def write_json(path, payload):
    private_write(path, (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode())


def saved_client():
    if TOKEN_FILE.is_symlink() or not TOKEN_FILE.is_file():
        raise UserError("保存済み認証がありません。先に garmin.sh login を実行してください。")
    private_dir(TOKEN_DIR)
    TOKEN_FILE.chmod(0o600)
    client = Garmin()
    client.login(str(TOKEN_DIR))
    return client


def login():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise UserError("初回ログインは、ご自身のターミナルから実行してください。")
    private_dir(TOKEN_DIR)
    if TOKEN_FILE.exists():
        try:
            saved_client()
            print("保存済み認証で接続できました。")
            return
        except GarminConnectAuthenticationError:
            pass
        except GarminConnectConnectionError:
            raise UserError("保存済み認証の確認に失敗しました。通信状態を確認して再実行してください。") from None
    print("Garminへ初回ログインします。パスワード・認証コードは保存しません。")
    email = input("Garminメールアドレス: ").strip()
    password = getpass.getpass("Garminパスワード（非表示）: ")
    if not email or not password:
        raise UserError("メールアドレスとパスワードを入力してください。")
    client = Garmin(
        email=email,
        password=password,
        prompt_mfa=lambda: getpass.getpass("二段階認証コード（非表示）: ").strip(),
    )
    del password
    try:
        client.login(str(TOKEN_DIR))
        # Persist explicitly: the library may suppress a failed initial dump.
        client.client.dump(str(TOKEN_DIR))
    finally:
        client.password = None
    if not TOKEN_FILE.is_file() or TOKEN_FILE.is_symlink():
        raise UserError("認証tokenを保存できませんでした。")
    TOKEN_FILE.chmod(0o600)
    print(f"ログインできました。認証tokenの保存先: {TOKEN_FILE}")
    print("このチャットで「ログインできた」とお知らせください。")


def iso_date(value):
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
        return value
    except ValueError:
        raise argparse.ArgumentTypeError("日付は YYYY-MM-DD 形式で指定してください。") from None


def activity_id(value):
    # Keep identifiers as decimal strings, including values above JS's safe range.
    if isinstance(value, bool) or not str(value).isascii() or not str(value).isdigit() or int(value) <= 0:
        raise UserError("Garminから有効なactivityIdが返りませんでした。")
    return str(value)


def tcx_counts(data):
    root = ET.fromstring(data)
    ns = {"tcx": "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"}
    return {
        "laps": len(root.findall(".//tcx:Lap", ns)),
        "trackpoints": len(root.findall(".//tcx:Trackpoint", ns)),
        "gps_points": len(root.findall(".//tcx:Trackpoint/tcx:Position", ns)),
        "heart_rate_points": len(root.findall(".//tcx:Trackpoint/tcx:HeartRateBpm", ns)),
    }


def summary_fields(activity):
    return {key: activity.get(key) for key in (
        "activityId", "activityName", "startTimeLocal", "startTimeGMT",
        "distance", "duration", "movingDuration", "elapsedDuration",
        "averageHR", "maxHR", "averageSpeed", "elevationGain",
    )}


def import_data(day):
    """Return only running summaries and recorded laps for the Node importer."""
    client = saved_client()
    activities = client.get_activities_by_date(day, day, activitytype="running")
    if not isinstance(activities, list):
        raise UserError("Garminの活動一覧が不正です。")
    normalized = []
    for activity in activities:
        if not isinstance(activity, dict):
            raise UserError("Garminの活動データが不正です。")
        identifier = activity_id(activity.get("activityId"))
        duration = activity.get("duration")
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 0:
            raise UserError("Garminの運動時間が不正です。")
        if duration < 30:
            continue
        distance = activity.get("distance")
        if distance is not None and (isinstance(distance, bool) or not isinstance(distance, (int, float)) or not math.isfinite(distance) or distance < 0):
            raise UserError("Garminの距離が不正です。")
        entry = {
            "id": identifier,
            "startTimeGMT": activity.get("startTimeGMT"),
            "durationMs": duration * 1000,
            "distanceKm": distance / 1000 if distance is not None else None,
            "laps": [],
        }
        try:
            data = client.get_activity_splits(identifier)
            if not isinstance(data, dict) or not isinstance(data.get("lapDTOs"), list):
                raise UserError("Garminのラップデータが不正です。")
            entry["laps"] = [{"meters": lap.get("distance"), "seconds": lap.get("duration")} for lap in data["lapDTOs"]]
        except GarminConnectNotFoundError:
            entry["lapsUnavailable"] = True
        normalized.append(entry)
    print(json.dumps({"activities": normalized}, ensure_ascii=False, allow_nan=False))
    return 0


def fetch_day(day):
    client = saved_client()
    activities = client.get_activities_by_date(day, day, activitytype="running")
    parent = TOKEN_DIR / "activities"
    private_dir(parent)
    target = parent / day
    private_dir(target)
    manifest = {
        "date": day, "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "Garmin Connect (unofficial client)",
        "distance_unit": "meter", "duration_unit": "second",
        "activities": [], "complete": False,
    }
    try:
        for activity in activities:
            identifier = activity_id(activity.get("activityId"))
            entry = {"id": identifier, "summary": summary_fields(activity), "files": {}, "errors": {}}
            manifest["activities"].append(entry)
            print(f"活動 {identifier}: {activity.get('startTimeLocal', day)}")
            jobs = (
                ("summary", ".json", lambda: client.get_activity(identifier)),
                ("splits", "-splits.json", lambda: client.get_activity_splits(identifier)),
                ("details", "-details.json", lambda: client.get_activity_details(identifier)),
                ("original", "-original.zip", lambda: client.download_activity(identifier, Garmin.ActivityDownloadFormat.ORIGINAL)),
                ("tcx", ".tcx", lambda: client.download_activity(identifier, Garmin.ActivityDownloadFormat.TCX)),
            )
            for label, suffix, request in jobs:
                try:
                    payload = request()
                    path = target / f"{identifier}{suffix}"
                    if label in ("original", "tcx"):
                        if not isinstance(payload, bytes) or not payload:
                            raise UserError("空または不正なダウンロードデータです。")
                        private_write(path, payload)
                    else:
                        write_json(path, payload)
                    entry["files"][label] = path.name
                    if label == "tcx":
                        try:
                            entry["tcx_counts"] = tcx_counts(payload)
                        except ET.ParseError:
                            entry["errors"]["tcx_parse"] = "ParseError"
                    print(f"  {label}: 保存しました")
                except (GarminConnectAuthenticationError, GarminConnectTooManyRequestsError):
                    entry["errors"][label] = "authentication_or_rate_limit"
                    raise
                except (GarminConnectNotFoundError, GarminConnectConnectionError) as error:
                    # ConnectionError may wrap a denied request or exhausted quota.
                    status = getattr(getattr(error, "response", None), "status_code", None)
                    entry["errors"][label] = type(error).__name__
                    if status in (401, 403, 429):
                        raise
                    print(f"  {label}: 取得できませんでした（{type(error).__name__}）")
        manifest["complete"] = not any(entry["errors"] for entry in manifest["activities"])
    finally:
        write_json(target / "manifest.json", manifest)
    print(f"ランニング {len(activities)}件。保存先: {target}")
    if not manifest["complete"]:
        print("一部の詳細を取得できませんでした。manifest.jsonを確認してください。")
        return 2
    return 0


def main():
    os.umask(0o077)
    # API/login errors can include sensitive response bodies; don't emit them.
    logging.disable(logging.CRITICAL)
    parser = argparse.ArgumentParser(description="Garminのローカル認証とランニング詳細取得")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("login", help="ターミナルで認証しtokenをローカル保存")
    fetch = commands.add_parser("fetch", help="保存済み認証で指定日の詳細を取得")
    fetch.add_argument("--date", required=True, type=iso_date, help="Garminのローカル日付 YYYY-MM-DD")
    importer = commands.add_parser("import-data", help="記事取込用ラン・ラップJSONを返す")
    importer.add_argument("--date", required=True, type=iso_date)
    args = parser.parse_args()
    try:
        if args.command == "login":
            login()
            return 0
        if args.command == "import-data":
            return import_data(args.date)
        return fetch_day(args.date)
    except UserError as error:
        print(str(error), file=sys.stderr)
    except GarminConnectTooManyRequestsError:
        print("Garminのアクセス上限に達しました。時間を置いて再実行してください。", file=sys.stderr)
    except GarminConnectAuthenticationError:
        print("Garmin認証に失敗しました。ご自身のターミナルで login を実行してください。", file=sys.stderr)
    except GarminConnectConnectionError:
        print("Garminへ接続できませんでした。通信状態やサービスの状態を確認してください。", file=sys.stderr)
    except (KeyboardInterrupt, EOFError):
        print("入力を中断しました。", file=sys.stderr)
    except Exception as error:
        print(f"処理に失敗しました（{type(error).__name__}）。秘密保護のためエラー本文は表示しません。", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
