import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


HOOKS_DIRECTORY = Path(__file__).resolve().parents[2] / ".githooks"


class PreCommitTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repository = Path(self.directory.name)
        self.environment = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Pre-commit test",
            "GIT_AUTHOR_EMAIL": "test@example.com",
            "GIT_COMMITTER_NAME": "Pre-commit test",
            "GIT_COMMITTER_EMAIL": "test@example.com",
        }
        self.git("init", "-b", "main")
        shutil.copytree(HOOKS_DIRECTORY, self.repository / ".githooks")
        self.git("config", "core.hooksPath", ".githooks")
        self.secret = "ghp_" + hashlib.sha256(b"pre-commit coverage").hexdigest()[:36]

    def git(self, *arguments, **options):
        return subprocess.run(
            ["git", "-c", "commit.gpgsign=false", *arguments],
            cwd=options.pop("cwd", self.repository),
            env=options.pop("env", self.environment),
            capture_output=True,
            text=True,
            check=options.pop("check", True),
        )

    def stage(self, content, filename="credentials.txt"):
        path = self.repository / filename
        path.write_text(content)
        self.git("add", "--", filename)
        return path

    def commit(self, expected_exit=0, **options):
        result = self.git("commit", "-m", "Test staged changes", check=False, **options)
        output = result.stdout + result.stderr
        if expected_exit == 0:
            self.assertEqual(result.returncode, 0, output)
        else:
            self.assertNotEqual(result.returncode, 0, output)
            self.assertNotEqual(self.git("rev-parse", "--verify", "HEAD", check=False).returncode, 0)
        return output

    def test_clean_first_commit_passes(self):
        self.stage("No credentials here.\n")
        self.commit()

    def test_staged_secret_blocks_commit_and_is_redacted(self):
        self.stage(f"token={self.secret}\n")
        output = self.commit(expected_exit=1)
        self.assertIn("github-pat", output)
        self.assertNotIn(self.secret, output)

    def test_unstaged_cleanup_does_not_hide_staged_secret(self):
        path = self.stage(f"token={self.secret}\n")
        path.write_text("No credentials here.\n")
        self.commit(expected_exit=1)

    def test_unstaged_secret_is_excluded(self):
        path = self.stage("No credentials here.\n")
        path.write_text(f"token={self.secret}\n")
        self.commit()

    def test_staged_whitespace_blocks_commit(self):
        self.stage("Trailing spaces.  \n")
        output = self.commit(expected_exit=1)
        self.assertIn("trailing whitespace", output)

    def test_unstaged_whitespace_is_excluded(self):
        path = self.stage("Clean content.\n")
        path.write_text("Trailing spaces.  \n")
        self.commit()

    def test_missing_gitleaks_blocks_commit_with_install_hint(self):
        self.stage("Clean content.\n")
        tools = self.repository / "tools"
        tools.mkdir()
        (tools / "git").symlink_to(shutil.which("git"))
        output = self.commit(expected_exit=1, env={**self.environment, "PATH": str(tools)})
        self.assertIn("brew install gitleaks", output)

    def test_commit_from_subdirectory_scans_unusual_filename(self):
        self.stage(f"token={self.secret}\n", filename="credentials with spaces.txt")
        subdirectory = self.repository / "nested"
        subdirectory.mkdir()
        self.commit(expected_exit=1, cwd=subdirectory)


if __name__ == "__main__":
    unittest.main()
