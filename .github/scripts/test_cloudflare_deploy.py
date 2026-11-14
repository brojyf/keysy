import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/cloudflare-deploy.yml"


def workflow_step(name):
    return WORKFLOW.read_text().split(f"      - name: {name}\n", 1)[1].split("\n      - ", 1)[0]


def step_script(name):
    block = workflow_step(name).split("        run: |\n", 1)[1]
    return "\n".join(line[10:] for line in block.splitlines() if line.startswith("          "))


class DeploymentSchedulingTests(unittest.TestCase):
    def test_only_successful_main_push_ci_runs_can_deploy(self):
        workflow = WORKFLOW.read_text()
        self.assertIn("workflow_run:\n    workflows: [CI]\n    types: [completed]\n    branches: [main]", workflow)
        self.assertIn("if: github.event.workflow_run.event == 'push' && github.event.workflow_run.conclusion == 'success'", workflow)
        self.assertNotIn("workflow_dispatch:", workflow)
        self.assertNotIn("pull_request:", workflow)

    def test_checks_out_the_commit_ci_tested_without_persisting_credentials(self):
        workflow = WORKFLOW.read_text()
        self.assertIn("ref: ${{ github.event.workflow_run.head_sha }}", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("permissions:\n  contents: read", workflow)

    def test_deployments_are_serial_and_do_not_cancel_a_running_publish(self):
        self.assertIn("concurrency:\n      group: cloudflare-deploy\n      cancel-in-progress: false", WORKFLOW.read_text())

    def test_checks_main_after_building_and_before_publishing(self):
        workflow = WORKFLOW.read_text()
        self.assertLess(workflow.index("- name: Build sites"), workflow.index("- name: Read the tip of main"))
        self.assertLess(workflow.index("- name: Read the tip of main"), workflow.index("- name: Deploy sites"))
        self.assertIn("if: steps.main.outputs.sha == github.event.workflow_run.head_sha", workflow_step("Deploy sites"))

    def test_credentials_are_only_exposed_to_the_deploy_step(self):
        deploy = workflow_step("Deploy sites")
        self.assertIn("CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}", deploy)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}", deploy)
        self.assertNotIn("CLOUDFLARE_API_TOKEN", workflow_step("Build sites"))

    def test_tests_are_run_by_ci(self):
        self.assertIn("run: python3 .github/scripts/test_cloudflare_deploy.py", (ROOT / ".github/workflows/ci.yml").read_text())


class DeploymentScriptTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for site in ("web", "wiki"):
            (self.root / site).mkdir()
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.log = self.root / "calls"
        self.output = self.root / "output"
        self.environment = {
            **os.environ,
            "PATH": f"{self.bin}:{os.environ['PATH']}",
            "CALL_LOG": str(self.log),
            "GITHUB_OUTPUT": str(self.output),
            "GITHUB_REPOSITORY": "test/keysy",
            "GH_TOKEN": "test-github-token",
            "CLOUDFLARE_API_TOKEN": "test-cloudflare-token",
            "CLOUDFLARE_ACCOUNT_ID": "test-account",
        }

    def tool(self, name, script):
        path = self.bin / name
        path.write_text("#!/bin/bash\nset -eu\n" + script)
        path.chmod(0o755)

    def run_step(self, name, **environment):
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", step_script(name)],
            cwd=self.root,
            env={**self.environment, **environment},
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_builds_both_sites_with_frozen_dependencies(self):
        self.tool("bun", 'printf "%s %s\\n" "${PWD##*/}" "$*" >> "$CALL_LOG"\n')
        result = self.run_step("Build sites")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.log.read_text().splitlines(), [
            "web install --frozen-lockfile", "web run build",
            "wiki install --frozen-lockfile", "wiki run build",
        ])

    def test_build_failure_stops_the_job(self):
        self.tool("bun", 'printf "%s\\n" "$*" >> "$CALL_LOG"\nexit 1\n')
        self.assertNotEqual(self.run_step("Build sites").returncode, 0)
        self.assertEqual(self.log.read_text().splitlines(), ["install --frozen-lockfile"])

    def test_reads_the_current_main_commit(self):
        self.tool("gh", 'test "$*" = "api repos/test/keysy/commits/main --jq .sha"\nprintf "current-main\\n"\n')
        result = self.run_step("Read the tip of main")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.output.read_text(), "sha=current-main\n")

    def test_main_api_failure_blocks_deployment(self):
        self.tool("gh", "exit 1\n")
        self.assertNotEqual(self.run_step("Read the tip of main").returncode, 0)
        self.assertFalse(self.output.exists())

    def test_deploys_both_sites_with_the_same_pinned_wrangler(self):
        self.tool("bunx", 'test "$CLOUDFLARE_API_TOKEN" = "test-cloudflare-token"\ntest "$CLOUDFLARE_ACCOUNT_ID" = "test-account"\nprintf "%s\\n" "$*" >> "$CALL_LOG"\n')
        result = self.run_step("Deploy sites")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.log.read_text().splitlines(), [
            "wrangler@4.162.0 deploy --cwd web",
            "wrangler@4.162.0 deploy --cwd wiki",
        ])

    def test_first_publish_failure_stops_the_second_publish(self):
        self.tool("bunx", 'printf "%s\\n" "$*" >> "$CALL_LOG"\nexit 1\n')
        self.assertNotEqual(self.run_step("Deploy sites").returncode, 0)
        self.assertEqual(len(self.log.read_text().splitlines()), 1)

    def test_missing_credentials_fail_before_running_wrangler(self):
        self.tool("bunx", 'printf "unexpected\\n" >> "$CALL_LOG"\n')
        for name in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
            with self.subTest(name=name):
                result = self.run_step("Deploy sites", **{name: ""})
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
