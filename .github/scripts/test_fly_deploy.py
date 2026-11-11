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


def workflow_step(name):
    return WORKFLOW.read_text().split(f"      - name: {name}\n", 1)[1].split("\n      - ", 1)[0].split("\n  update-notification:", 1)[0]


def step_script(name):
    block = workflow_step(name).split("        run: |\n", 1)[1]
    return "\n".join(line[10:] for line in block.splitlines() if line.startswith("          "))


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
