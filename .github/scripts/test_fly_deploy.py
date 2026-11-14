import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/fly-deploy.yml"


def workflow_job(name):
    return WORKFLOW.read_text().split(f"\n  {name}:\n", 1)[1].split("\n\n  ", 1)[0]


def workflow_step(name):
    return WORKFLOW.read_text().split(f"      - name: {name}\n", 1)[1].split("\n      - ", 1)[0].split("\n\n  ", 1)[0]


def step_script(name):
    block = workflow_step(name).split("        run: |\n", 1)[1]
    return "\n".join(line[10:] for line in block.splitlines() if line.startswith("          "))


class DeploymentSchedulingTests(unittest.TestCase):
    def test_migration_wait_does_not_hold_the_deployment_lock(self):
        migrations = workflow_job("migrations")
        self.assertIn("- name: Wait for Supabase migrations", migrations)
        self.assertNotIn("    concurrency:", migrations)
        self.assertNotIn("\nconcurrency:", WORKFLOW.read_text())
        self.assertNotIn("- name: Wait for Supabase migrations", workflow_job("deploy"))

    def test_deployment_requires_successful_migrations(self):
        deploy = workflow_job("deploy")
        self.assertIn("needs: [notify, migrations]", deploy)
        self.assertIn("!cancelled() && needs.migrations.result == 'success' &&", deploy)
        self.assertIn("github.event.workflow_run.event == 'push'", deploy)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", deploy)

    def test_deployment_stays_serial_and_checks_the_tip_of_main(self):
        deploy = workflow_job("deploy")
        self.assertIn("concurrency:\n      group: fly-deploy\n      cancel-in-progress: false", deploy)
        self.assertLess(deploy.index("- name: Read the tip of main"), deploy.index("- name: Deploy\n"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Deploy"))

    def test_notification_reports_the_migration_result_when_it_blocks_deployment(self):
        notification = workflow_job("update-notification")
        self.assertIn("needs: [notify, migrations, deploy]", notification)
        self.assertIn("deploy_result: ${{ needs.migrations.result != 'success' && needs.migrations.result || needs.deploy.result }}", notification)


class MigrationGateTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name)
        self.call_log = path / "calls"
        gh = path / "gh"
        gh.write_text('''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import subprocess
import sys
assert sys.argv[1:3] == ["api", "repos/test/keysy/commits/tested-commit/check-runs?check_name=Supabase%20Preview"]
assert sys.argv[3] == "--jq"
assert os.environ["GH_TOKEN"] == "test-token"
log = Path(os.environ["MIGRATION_CALL_LOG"])
calls = log.read_text().splitlines() if log.exists() else []
attempt = calls.count("gh")
with log.open("a") as output:
    output.write("gh\\n")
if os.environ.get("GH_API_FAILURE"):
    sys.exit(1)
conclusions = json.loads(os.environ["MIGRATION_CONCLUSIONS"])
response = conclusions[min(attempt, len(conclusions) - 1)]
if isinstance(response, str):
    response = {"check_runs": [{"conclusion": None if response == "pending" else response}]}
sys.exit(subprocess.run(["jq", "-r", sys.argv[4]], input=json.dumps(response), text=True).returncode)
''')
        gh.chmod(0o755)
        sleep = path / "sleep"
        sleep.write_text('#!/bin/sh\nprintf "sleep\\n" >> "$MIGRATION_CALL_LOG"\n')
        sleep.chmod(0o755)
        self.environment = {
            **os.environ,
            "PATH": f"{path}:{os.environ['PATH']}",
            "MIGRATION_CALL_LOG": str(self.call_log),
            "GH_TOKEN": "test-token",
            "GITHUB_REPOSITORY": "test/keysy",
            # workflow_run's GITHUB_SHA can differ from the commit CI tested.
            "GITHUB_SHA": "workflow-default-commit",
            "COMMIT_SHA": "tested-commit",
        }

    def run_gate(self, conclusions, **environment):
        self.call_log.unlink(missing_ok=True)
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", step_script("Wait for Supabase migrations")],
            env={**self.environment, "MIGRATION_CONCLUSIONS": json.dumps(conclusions), **environment},
            capture_output=True,
            text=True,
            timeout=15,
        )

    def test_waits_for_migrations_on_the_commit_ci_tested(self):
        result = self.run_gate(["pending", "success"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh", "sleep", "gh"])

    def test_migration_environment_uses_the_ci_commit(self):
        block = workflow_step("Wait for Supabase migrations")
        self.assertIn("COMMIT_SHA: ${{ github.event.workflow_run.head_sha }}", block)
        self.assertIn("GH_TOKEN: ${{ github.token }}", block)

    def test_completed_migrations_do_not_wait(self):
        result = self.run_gate(["success"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh"])

    def test_parses_successful_check_response(self):
        result = self.run_gate([{"check_runs": [{"status": "completed", "conclusion": "success"}]}])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh"])

    def test_empty_check_runs_wait_for_a_successful_check(self):
        result = self.run_gate([
            {"check_runs": []},
            {"check_runs": [{"status": "completed", "conclusion": "success"}]},
        ])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh", "sleep", "gh"])

    def test_null_conclusion_waits_for_a_successful_check(self):
        result = self.run_gate([
            {"check_runs": [{"status": "in_progress", "conclusion": None}]},
            {"check_runs": [{"status": "completed", "conclusion": "success"}]},
        ])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh", "sleep", "gh"])

    def test_unsuccessful_migrations_block_deployment(self):
        for conclusion in ("failure", "cancelled", "timed_out", "action_required", "neutral", "skipped", "stale"):
            with self.subTest(conclusion=conclusion):
                result = self.run_gate([conclusion])
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(conclusion, result.stdout)
                self.assertEqual(self.call_log.read_text().splitlines(), ["gh"])

    def test_api_errors_block_deployment(self):
        self.assertNotEqual(self.run_gate(["success"], GH_API_FAILURE="1").returncode, 0)
        self.assertEqual(self.call_log.read_text().splitlines(), ["gh"])

    def test_pending_migrations_time_out(self):
        result = self.run_gate(["pending"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("15 minutes", result.stdout)
        self.assertEqual(self.call_log.read_text().splitlines().count("gh"), 60)


class FlyDeployTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.page_status = 200
        self.asset_status = 200
        self.health_status = 200
        self.page = '<link href="/_next/static/app.css"><script src="/_next/static/app.js"></script>'
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.requests.append((self.path, dict(self.headers)))
                is_page = self.path in ("/", "/signin")
                status = owner.page_status if is_page else owner.asset_status
                if self.path == "/health":
                    status = owner.health_status
                if self.path == "/access-login":
                    status = 200
                self.send_response(status)
                if status == 302:
                    self.send_header("Location", "/access-login")
                self.end_headers()
                self.wfile.write((owner.page if is_page else "OK").encode())

            def log_message(self, *_):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name)
        # Use real curl against a local fixture. Remove retry delays from tests.
        wrapper = path / "curl"
        wrapper.write_text('''#!/usr/bin/env python3
import os
import subprocess
import sys
from urllib.parse import urlsplit
args = sys.argv[1:]
for option in ("--retry", "--retry-delay", "--max-time"):
    while option in args:
        index = args.index(option)
        del args[index:index + 2]
args = [os.environ["TEST_ORIGIN"] + urlsplit(arg).path + ("?" + urlsplit(arg).query if urlsplit(arg).query else "") if arg.startswith("https://") else arg for arg in args]
sys.exit(subprocess.run([os.environ["REAL_CURL"], *args]).returncode)
''')
        wrapper.chmod(0o755)
        self.environment = {
            **os.environ,
            "PATH": f"{path}:{os.environ['PATH']}",
            "REAL_CURL": shutil.which("curl"),
            "TEST_ORIGIN": f"http://127.0.0.1:{server.server_port}",
            "CF_ACCESS_CLIENT_ID": "test-client-id",
            "CF_ACCESS_CLIENT_SECRET": "test-client-secret",
            "GITHUB_RUN_ID": "123",
            "GITHUB_RUN_ATTEMPT": "2",
        }

    def run_step(self, name="Check the dashboard assets", **environment):
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", step_script(name)],
            env={**self.environment, **environment},
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_dashboard_page_and_assets_use_access_headers(self):
        result = self.run_step()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([path for path, _ in self.requests], [
            "/signin", "/_next/static/app.css?deploy=123.2", "/_next/static/app.js?deploy=123.2",
        ])
        for _, headers in self.requests:
            self.assertEqual(headers.get("CF-Access-Client-Id"), "test-client-id")
            self.assertEqual(headers.get("CF-Access-Client-Secret"), "test-client-secret")
        self.assertNotIn("test-client-secret", result.stdout + result.stderr)

    def test_access_environment_uses_repository_secrets(self):
        block = workflow_step("Check the dashboard assets")
        for name in ("CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET"):
            self.assertIn(f"{name}: ${{{{ secrets.{name} }}}}", block)

    def test_missing_access_credentials_fail_before_requests(self):
        for name in ("CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET"):
            with self.subTest(name=name):
                result = self.run_step(**{name: ""})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(name, result.stderr)
                self.assertEqual(self.requests, [])

    def test_page_redirect_fails_without_following_login(self):
        self.page_status = 302
        result = self.run_step()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual([path for path, _ in self.requests], ["/signin"])

    def test_asset_redirect_fails_without_following_login(self):
        self.asset_status = 302
        result = self.run_step()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(path == "/access-login" for path, _ in self.requests))

    def test_missing_assets_fail(self):
        self.asset_status = 404
        self.assertNotEqual(self.run_step().returncode, 0)

    def test_page_without_next_assets_fails(self):
        self.page = "<title>Sign in - Cloudflare Access</title>"
        self.assertNotEqual(self.run_step().returncode, 0)

    def test_public_health_redirect_fails_without_following_login(self):
        self.health_status = 302
        self.assertNotEqual(self.run_step("Check the public hosts").returncode, 0)
        self.assertEqual([path for path, _ in self.requests], ["/health"])

    def test_public_health_checks_do_not_send_access_credentials(self):
        result = self.run_step("Check the public hosts")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([path for path, _ in self.requests], ["/health", "/health"])
        for _, headers in self.requests:
            self.assertNotIn("CF-Access-Client-Id", headers)
            self.assertNotIn("CF-Access-Client-Secret", headers)


if __name__ == "__main__":
    unittest.main()
