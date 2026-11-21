import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/deploy.yml"
CI_WORKFLOW = ROOT / ".github/workflows/ci.yml"


def workflow_job(name):
    return WORKFLOW.read_text().split(f"\n  {name}:\n", 1)[1].split("\n\n  ", 1)[0]


def workflow_step(name):
    return WORKFLOW.read_text().split(f"      - name: {name}\n", 1)[1].split("\n      - ", 1)[0].split("\n\n  ", 1)[0]


def step_script(name):
    block = workflow_step(name).split("        run: |\n", 1)[1]
    return "\n".join(line[10:] for line in block.splitlines() if line.startswith("          "))


class DeploymentSchedulingTests(unittest.TestCase):
    def test_migrations_are_serial_without_holding_the_fly_deployment_lock(self):
        migrations = workflow_job("migrations")
        self.assertIn("group: supabase-migrations\n      cancel-in-progress: false", migrations)
        self.assertNotIn("group: fly-deploy", migrations)
        self.assertNotIn("\nconcurrency:", WORKFLOW.read_text())
        self.assertNotIn("Supabase%20Preview", WORKFLOW.read_text())

    def test_deployment_requires_successful_migrations(self):
        deploy = workflow_job("deploy")
        self.assertIn("needs: [notify, migrations]", deploy)
        self.assertIn("!cancelled() && needs.migrations.result == 'success' &&", deploy)
        self.assertIn("needs.migrations.outputs.migrated == 'true'", deploy)
        self.assertIn("github.event.workflow_run.event == 'push'", deploy)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", deploy)

    def test_deployment_stays_serial_and_checks_the_tip_of_main(self):
        deploy = workflow_job("deploy")
        self.assertIn("concurrency:\n      group: fly-deploy\n      cancel-in-progress: false", deploy)
        self.assertLess(deploy.index("- name: Read the tip of main"), deploy.index("- name: Deploy\n"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Deploy"))

    def test_notification_reports_migration_and_fly_results_separately(self):
        notification = workflow_job("update-notification")
        self.assertIn("needs: [notify, migrations, deploy, cloudflare, dashboard]", notification)
        self.assertIn("migrations_result: ${{ needs.migrations.result }}", notification)
        self.assertIn("migrated: ${{ needs.migrations.outputs.migrated == 'true' }}", notification)
        self.assertIn("deploy_result: ${{ needs.deploy.result }}", notification)


    def test_dashboard_deploy_follows_a_healthy_fly_deploy(self):
        deploy = workflow_job("deploy")
        dashboard = workflow_job("dashboard")
        self.assertIn("deployed: ${{ steps.hosts.outcome == 'success' }}", deploy)
        self.assertIn("needs: deploy", dashboard)
        self.assertIn("if: needs.deploy.outputs.deployed == 'true'", dashboard)
        self.assertIn("group: dashboard-deploy\n      cancel-in-progress: false", dashboard)
        self.assertIn("ref: ${{ github.event.workflow_run.head_sha }}", dashboard)
        self.assertIn("persist-credentials: false", dashboard)
        self.assertLess(dashboard.index("- name: Build dashboard"), dashboard.index("- name: Read the tip of main"))
        self.assertLess(dashboard.index("- name: Read the tip of main"), dashboard.index("- name: Deploy dashboard"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Deploy dashboard"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Check the dashboard assets"))
        self.assertIn("deployed: ${{ steps.assets.outcome == 'success' }}", dashboard)
        notification = workflow_job("update-notification")
        self.assertIn("dashboard_result: ${{ needs.dashboard.result }}", notification)
        self.assertIn("dashboard_deployed: ${{ needs.dashboard.outputs.deployed == 'true' }}", notification)


class MigrationDeploymentTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name)
        self.call_log = path / "calls"
        supabase = path / "supabase"
        supabase.write_text('''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys
assert os.environ["SUPABASE_ACCESS_TOKEN"] == "test-access-token"
assert os.environ["SUPABASE_DB_PASSWORD"] == "test-database-password"
with Path(os.environ["MIGRATION_CALL_LOG"]).open("a") as output:
    output.write(json.dumps(sys.argv[1:]) + "\\n")
command = "link" if sys.argv[1] == "link" else "dry-run" if "--dry-run" in sys.argv else "push"
sys.exit(1 if command == os.environ.get("FAIL_COMMAND") else 0)
''')
        supabase.chmod(0o755)
        self.environment = {
            **os.environ,
            "PATH": f"{path}:{os.environ['PATH']}",
            "MIGRATION_CALL_LOG": str(self.call_log),
            "SUPABASE_ACCESS_TOKEN": "test-access-token",
            "SUPABASE_DB_PASSWORD": "test-database-password",
            "SUPABASE_PROJECT_ID": "abcdefghijklmnopqrst",
        }

    def run_migrations(self, **environment):
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", step_script("Apply Supabase migrations")],
            env={**self.environment, **environment},
            capture_output=True,
            text=True,
            timeout=10,
        )

    def calls(self):
        return [json.loads(line) for line in self.call_log.read_text().splitlines()] if self.call_log.exists() else []

    def test_checks_out_the_ci_commit_and_requires_successful_push_ci(self):
        migrations = workflow_job("migrations")
        self.assertIn("ref: ${{ github.event.workflow_run.head_sha }}", migrations)
        self.assertIn("persist-credentials: false", migrations)
        self.assertIn("github.event.workflow_run.event == 'push'", migrations)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", migrations)
        self.assertIn("supabase/setup-cli@689adcfb80d947100a1eab127289b97d1fb07b13", migrations)
        self.assertIn("version: 3.1.0", migrations)

    def test_ci_installs_the_same_supabase_cli_as_the_migration_job(self):
        migrations = workflow_job("migrations")
        install = re.search(r"- uses: (supabase/setup-cli@\S+ # \S+)\n\s+(?:if: .*\n\s+)?with:\n\s+version: (\S+)", migrations)
        ci_job = CI_WORKFLOW.read_text().split("\n  deploy:\n", 1)[1].split("\n\n  ", 1)[0]
        self.assertIn(f"- uses: {install.group(1)}\n        with:\n          version: {install.group(2)}", ci_job)

    def test_stale_commits_skip_setup_and_migrations(self):
        migrations = workflow_job("migrations")
        self.assertLess(migrations.index("- name: Read the tip of main"), migrations.index("- name: Apply Supabase migrations"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Apply Supabase migrations"))
        self.assertIn("migrated: ${{ steps.migrate.outcome == 'success' }}", migrations)

    def test_credentials_come_from_repository_settings(self):
        block = workflow_step("Apply Supabase migrations")
        for name in ("SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"):
            self.assertIn(f"{name}: ${{{{ secrets.{name} }}}}", block)
        self.assertIn("SUPABASE_PROJECT_ID: ${{ vars.SUPABASE_PROJECT_ID }}", block)

    def test_links_and_previews_before_applying_without_seed_roles_or_vault(self):
        result = self.run_migrations()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.calls(), [
            ["link", "--project-ref", "abcdefghijklmnopqrst"],
            ["db", "push", "--remote", "--dry-run", "--skip-vault"],
            ["db", "push", "--remote", "--yes", "--skip-vault"],
        ])
        for name in ("SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD"):
            self.assertNotIn(self.environment[name], result.stdout + result.stderr)

    def test_missing_credentials_fail_before_any_supabase_command(self):
        for name in ("SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_ID"):
            with self.subTest(name=name):
                result = self.run_migrations(**{name: ""})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(name, result.stderr)
                self.assertEqual(self.calls(), [])

    def test_command_failures_stop_later_commands(self):
        for command, count in [("link", 1), ("dry-run", 2), ("push", 3)]:
            with self.subTest(command=command):
                self.call_log.unlink(missing_ok=True)
                result = self.run_migrations(FAIL_COMMAND=command)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(len(self.calls()), count)


class FlyDeployTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.page_status = 200
        self.asset_status = 200
        self.health_status = 200
        self.asset_type = None
        self.page = '<link href="/assets/app.css"><script src="/assets/app.js"></script>'
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
                if not is_page:
                    self.send_header("Content-Type", owner.asset_type or ("text/css" if ".css" in self.path else "text/javascript"))
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
            "/signin", "/assets/app.css?deploy=123.2", "/assets/app.js?deploy=123.2",
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

    # Workers SPA fallback answers a missing asset with 200 and the HTML shell.
    def test_html_fallback_for_an_asset_fails(self):
        self.asset_type = "text/html; charset=utf-8"
        result = self.run_step()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("/assets/app.css", result.stdout + result.stderr)

    def test_page_without_assets_fails(self):
        self.page = "<title>Sign in - Cloudflare Access</title>"
        self.assertNotEqual(self.run_step().returncode, 0)

    def test_page_missing_one_asset_type_fails(self):
        for page in ('<script src="/assets/app.js"></script>', '<link href="/assets/app.css">'):
            with self.subTest(page=page):
                self.page = page
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
