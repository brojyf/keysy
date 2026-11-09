import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/discord-merge.yml"


class DiscordNotificationTests(unittest.TestCase):
    def setUp(self):
        # Execute the actual workflow shell body without a YAML dependency.
        workflow = WORKFLOW.read_text()
        self.script = "\n".join(
            line[10:] for line in workflow.split("        run: |\n", 1)[1].splitlines()
        )
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name)
        self.environment = {
            **os.environ,
            "PATH": f"{self.path}:{os.environ['PATH']}",
            "WEBHOOK_URL": "https://discord.invalid/api/webhooks/123/test-token",
            "REPO": "example/keysy",
            "COMMIT_SHA": "1234567890abcdef",
            "COMMIT_MESSAGE": 'feat(api): support "quotes" @everyone\nCommit body',
            "COMMIT_AUTHOR": "Test author",
            "CI_CONCLUSION": "success",
            "MESSAGE_ID": "",
            "DEPLOY_RESULT": "pending",
            "DEPLOYED": "false",
            "GITHUB_OUTPUT": str(self.path / "outputs"),
            "REQUEST_FILE": str(self.path / "request.json"),
        }
        self.executable("gh", '#!/bin/sh\nprintf "api / dashboard"\n')
        self.executable("curl", '''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
args = sys.argv[1:]
Path(os.environ["REQUEST_FILE"]).write_text(json.dumps({
    "method": args[args.index("-X") + 1] if "-X" in args else "POST",
    "url": args[-1],
    "payload": json.loads(args[args.index("-d") + 1]),
}))
print(os.environ.get("DISCORD_RESPONSE", '{"id":"987654321"}'))
''')

    def executable(self, name, content):
        executable = self.path / name
        executable.write_text(content)
        executable.chmod(0o755)

    def notify(self, **environment):
        result = subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", self.script],
            env={**self.environment, **environment},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads((self.path / "request.json").read_text())

    def test_create_waits_for_message_and_exports_id(self):
        request = self.notify()
        self.assertEqual(request["method"], "POST")
        self.assertEqual(request["url"], self.environment["WEBHOOK_URL"] + "?wait=true")
        self.assertEqual((self.path / "outputs").read_text(), "message_id=987654321\n")
        self.assertIn("Fly deploy: ⏳ Pending", request["payload"]["content"])

    def test_commit_details_and_mentions_are_preserved_safely(self):
        payload = self.notify()["payload"]
        self.assertIn('1234567: feat(api): support "quotes" @everyone', payload["content"])
        self.assertNotIn("Commit body", payload["content"])
        self.assertIn("Scope: api / dashboard\nBy: Test author", payload["content"])
        self.assertIn("CI: ✅ Passed", payload["content"])
        self.assertEqual(payload["allowed_mentions"], {"parse": []})

    def test_ci_failure_and_cancellation_do_not_report_pending_deploy(self):
        for conclusion in ["failure", "cancelled", "timed_out"]:
            with self.subTest(conclusion=conclusion):
                content = self.notify(CI_CONCLUSION=conclusion)["payload"]["content"]
                self.assertIn("CI: ❌ " + conclusion, content)
                self.assertIn("Fly deploy: ⏭️ Not run (CI did not pass)", content)

    def test_update_edits_same_message_for_each_deploy_result(self):
        for result, deployed, status in [
            ("success", "true", "✅ Succeeded"),
            ("failure", "false", "❌ Failed"),
            ("cancelled", "false", "🚫 Cancelled"),
            ("success", "false", "⏭️ Skipped"),
            ("skipped", "false", "⏭️ Skipped"),
        ]:
            with self.subTest(result=result, deployed=deployed):
                request = self.notify(
                    MESSAGE_ID="987654321", DEPLOY_RESULT=result, DEPLOYED=deployed
                )
                self.assertEqual(request["method"], "PATCH")
                self.assertEqual(
                    request["url"], self.environment["WEBHOOK_URL"] + "/messages/987654321"
                )
                self.assertIn("Fly deploy: " + status, request["payload"]["content"])
                self.assertEqual(request["payload"]["allowed_mentions"], {"parse": []})

    def test_scope_lookup_failure_keeps_notification(self):
        self.executable("gh", "#!/bin/sh\nexit 1\n")
        self.assertIn("Scope: unknown", self.notify()["payload"]["content"])

    def test_invalid_response_does_not_export_message_id(self):
        for response in ['{}', '{"id":"not-an-id"}']:
            with self.subTest(response=response):
                result = subprocess.run(
                    ["bash", "-e", "-o", "pipefail", "-c", self.script],
                    env={**self.environment, "DISCORD_RESPONSE": response},
                    capture_output=True,
                    text=True,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.path / "outputs").exists())

    def test_patch_failure_does_not_create_another_message(self):
        self.executable("curl", '''#!/bin/sh
printf '%s\\n' "$@" >> "$REQUEST_FILE"
exit 22
''')
        result = subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", self.script],
            env={**self.environment, "MESSAGE_ID": "987654321"},
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        arguments = (self.path / "request.json").read_text().splitlines()
        self.assertEqual(arguments.count("PATCH"), 1)
        self.assertNotIn(self.environment["WEBHOOK_URL"] + "?wait=true", arguments)
        self.assertFalse((self.path / "outputs").exists())

    def test_webhook_failure_does_not_export_message_id(self):
        self.executable("curl", "#!/bin/sh\nexit 22\n")
        result = subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", self.script],
            env=self.environment,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.path / "outputs").exists())


if __name__ == "__main__":
    unittest.main()
