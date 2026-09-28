"""Credential-free checks for Garmin authentication and private data handling."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location(
    "garmin_local", Path(__file__).parents[1] / "scripts" / "garmin.py"
)
garmin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(garmin)

TCX = b'''<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity><Lap><Track><Trackpoint><Position/><HeartRateBpm/></Trackpoint>
<Trackpoint/></Track></Lap></Activity></Activities></TrainingCenterDatabase>'''


class GarminLocalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.token_dir = Path(self.temp.name) / ".garminconnect"
        self.token_file = self.token_dir / "garmin_tokens.json"
        self.patches = (
            patch.object(garmin, "TOKEN_DIR", self.token_dir),
            patch.object(garmin, "TOKEN_FILE", self.token_file),
        )
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def client_for_fetch(self):
        client = Mock()
        client.get_activities_by_date.return_value = [
            {"activityId": 5726486651353448760, "startTimeLocal": "2026-09-28 11:43:36",
             "distance": 7197.28, "duration": 1883.516}
        ]
        client.get_activity.return_value = {"summaryDTO": {"averageHR": 150}}
        client.get_activity_splits.return_value = {"lapDTOs": [{"distance": 1000, "duration": 300}]}
        client.get_activity_details.return_value = {"activityDetailMetrics": []}
        client.download_activity.side_effect = [b"PK\x03\x04original", TCX]
        return client

    def test_missing_tokens_never_attempt_network_login(self):
        with patch.object(garmin, "Garmin") as factory:
            with self.assertRaises(garmin.UserError):
                garmin.saved_client()
            factory.assert_not_called()

    def test_noninteractive_login_never_prompts(self):
        with patch.object(garmin.sys.stdin, "isatty", return_value=False), \
             patch("builtins.input") as prompt, patch.object(garmin, "Garmin") as factory:
            with self.assertRaises(garmin.UserError):
                garmin.login()
            prompt.assert_not_called()
            factory.assert_not_called()

    def test_interactive_login_saves_token_without_echoing_secrets(self):
        secret = "test-password-only"
        mfa = "123456"
        client = Mock()

        def factory(**kwargs):
            self.assertEqual(kwargs["password"], secret)
            self.assertEqual(kwargs["prompt_mfa"](), mfa)
            return client

        def dump(_):
            garmin.private_write(self.token_file, b'{"access_token":"test-token-only"}')

        client.client.dump.side_effect = dump
        output = io.StringIO()
        with patch.object(garmin.sys.stdin, "isatty", return_value=True), \
             patch.object(garmin.sys.stderr, "isatty", return_value=True), \
             patch("builtins.input", return_value="test@example.invalid"), \
             patch.object(garmin.getpass, "getpass", side_effect=[secret, mfa]), \
             patch.object(garmin, "Garmin", side_effect=factory), contextlib.redirect_stdout(output):
            garmin.login()
        self.assertEqual(self.token_file.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.token_dir.stat().st_mode & 0o777, 0o700)
        self.assertIsNone(client.password)
        for sensitive in (secret, mfa, "test-token-only"):
            self.assertNotIn(sensitive, output.getvalue())

    def test_fetch_keeps_precise_ids_private_files_and_tcx_evidence(self):
        client = self.client_for_fetch()
        garmin.private_dir(self.token_dir)
        with patch.object(garmin, "saved_client", return_value=client), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(garmin.fetch_day("2026-09-28"), 0)
        client.get_activities_by_date.assert_called_once_with("2026-09-28", "2026-09-28", activitytype="running")
        client.get_activity.assert_called_once_with("5726486651353448760")
        target = self.token_dir / "activities" / "2026-09-28"
        manifest = json.loads((target / "manifest.json").read_text())
        self.assertTrue(manifest["complete"])
        self.assertEqual(manifest["activities"][0]["tcx_counts"],
                         {"laps": 1, "trackpoints": 2, "gps_points": 1, "heart_rate_points": 1})
        for path in target.iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)

    def test_rate_limit_stops_requests_and_preserves_partial_manifest(self):
        client = self.client_for_fetch()
        garmin.private_dir(self.token_dir)
        client.get_activity_splits.side_effect = garmin.GarminConnectTooManyRequestsError("secret response")
        with patch.object(garmin, "saved_client", return_value=client), \
             contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(garmin.GarminConnectTooManyRequestsError):
                garmin.fetch_day("2026-09-28")
        client.get_activity_details.assert_not_called()
        client.download_activity.assert_not_called()
        manifest_path = self.token_dir / "activities" / "2026-09-28" / "manifest.json"
        self.assertNotIn("secret response", manifest_path.read_text())
        self.assertFalse(json.loads(manifest_path.read_text())["complete"])

    def test_optional_missing_details_still_downloads_original(self):
        client = self.client_for_fetch()
        garmin.private_dir(self.token_dir)
        client.get_activity_details.side_effect = garmin.GarminConnectNotFoundError("secret response")
        with patch.object(garmin, "saved_client", return_value=client), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(garmin.fetch_day("2026-09-28"), 2)
        self.assertEqual(client.download_activity.call_count, 2)
        manifest = json.loads((self.token_dir / "activities" / "2026-09-28" / "manifest.json").read_text())
        self.assertFalse(manifest["complete"])
        self.assertEqual(manifest["activities"][0]["errors"]["details"], "GarminConnectNotFoundError")

    def test_import_json_normalizes_units_and_reads_only_required_data(self):
        client = self.client_for_fetch()
        output = io.StringIO()
        with patch.object(garmin, "saved_client", return_value=client), contextlib.redirect_stdout(output):
            self.assertEqual(garmin.import_data("2026-09-28"), 0)
        data = json.loads(output.getvalue())["activities"][0]
        self.assertEqual(data["id"], "5726486651353448760")
        self.assertAlmostEqual(data["distanceKm"], 7.19728)
        self.assertAlmostEqual(data["durationMs"], 1883516)
        self.assertEqual(data["laps"], [{"meters": 1000, "seconds": 300}])
        client.get_activity.assert_not_called()
        client.get_activity_details.assert_not_called()
        client.download_activity.assert_not_called()
        self.assertFalse(self.token_dir.exists())

    def test_import_filters_short_runs_and_never_swallows_auth_or_rate_limit(self):
        client = self.client_for_fetch()
        client.get_activities_by_date.return_value.insert(0, {"activityId": 1, "duration": 29})
        client.get_activity_splits.side_effect = garmin.GarminConnectTooManyRequestsError("secret")
        output = io.StringIO()
        with patch.object(garmin, "saved_client", return_value=client), contextlib.redirect_stdout(output):
            with self.assertRaises(garmin.GarminConnectTooManyRequestsError):
                garmin.import_data("2026-09-28")
        self.assertEqual(output.getvalue(), "")
        client.get_activity_splits.assert_called_once_with("5726486651353448760")


if __name__ == "__main__":
    unittest.main()
