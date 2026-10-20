import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCAN_SCRIPT = Path(__file__).with_name("scan-secrets.sh")


class SecretScanTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repository = Path(self.directory.name)
        self.environment = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Secret scan test",
            "GIT_AUTHOR_EMAIL": "test@example.com",
            "GIT_COMMITTER_NAME": "Secret scan test",
            "GIT_COMMITTER_EMAIL": "test@example.com",
        }
        self.git("init", "-b", "main")
        self.commit("Initial clean commit")
        self.base = self.git("rev-parse", "HEAD")

    def git(self, *arguments):
        return subprocess.check_output(
            ["git", "-c", "commit.gpgsign=false", *arguments],
            cwd=self.repository,
            env=self.environment,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()

    def commit(self, message):
        self.git("add", ".")
        self.git("commit", "--allow-empty", "-m", message)

    def add_secret(self):
        token = "ghp_" + hashlib.sha256(b"secret scan coverage").hexdigest()[:36]
        (self.repository / "credentials.txt").write_text(f"token={token}\n")

    def assert_scan(self, expected_exit, base=None):
        result = subprocess.run(
            ["bash", str(SCAN_SCRIPT)],
            cwd=self.repository,
            env={
                **self.environment,
                "BASE_SHA": self.base if base is None else base,
                "HEAD_SHA": self.git("rev-parse", "HEAD"),
            },
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, expected_exit, result.stdout + result.stderr)

    def test_clean_changes_pass(self):
        self.commit("Clean change")
        self.assert_scan(0)

    def test_merged_side_branch_is_scanned(self):
        self.commit("First PR commit")
        self.git("checkout", "-b", "side")
        self.add_secret()
        self.commit("Add synthetic secret on side branch")
        self.git("checkout", "main")
        self.git("merge", "--no-ff", "side", "-m", "Merge side branch")
        self.assert_scan(2)

    def test_merge_commit_changes_are_scanned(self):
        self.commit("First PR commit")
        self.git("checkout", "-b", "side")
        self.commit("Clean side branch")
        self.git("checkout", "main")
        self.git("merge", "--no-ff", "--no-commit", "side")
        self.add_secret()
        self.commit("Add synthetic secret while merging")
        self.assert_scan(2)

    def test_commit_after_first_page_is_scanned(self):
        for number in range(1, 36):
            if number == 31:
                self.add_secret()
            self.commit(f"PR commit {number}")
        self.assert_scan(2)

    def test_removed_secret_is_still_scanned(self):
        self.add_secret()
        self.commit("Add synthetic secret")
        (self.repository / "credentials.txt").unlink()
        self.commit("Remove synthetic secret")
        self.assert_scan(2)

    def test_new_branch_push_scans_history(self):
        self.add_secret()
        self.commit("Add synthetic secret")
        self.assert_scan(2, base="0" * 40)

    def test_existing_base_history_is_excluded(self):
        self.add_secret()
        self.commit("Existing synthetic secret")
        self.base = self.git("rev-parse", "HEAD")
        self.commit("Clean change")
        self.assert_scan(0)


if __name__ == "__main__":
    unittest.main()
