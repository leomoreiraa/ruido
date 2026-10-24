#!/usr/bin/env python3
"""End-to-end regression: simultaneous public site/source pushes must reconcile."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
GIT = shutil.which("git")
RSYNC = shutil.which("rsync")


def run(*args, env=None, cwd=None):
    return subprocess.run(args, env=env, cwd=cwd, text=True, capture_output=True,
                          check=True)


def publication_step(path, name):
    lines = (ROOT / path).read_text(encoding="utf-8").splitlines()
    target = "      - name: " + name
    start = lines.index(target)
    run_start = next(i for i in range(start + 1, len(lines))
                     if lines[i] == "        run: |")
    body = []
    for line in lines[run_start + 1:]:
        if line and not line.startswith("          "):
            break
        body.append(line[10:] if line else "")
    return "\n".join(body) + "\n"


class PublicMirrorRaceTest(unittest.TestCase):
    def setUp(self):
        if not GIT or not RSYNC:
            self.skipTest("git and rsync required")
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.remote = self.base / "public.git"
        self.seed = self.base / "seed"
        run(GIT, "init", "--bare", "--initial-branch=main", str(self.remote))
        run(GIT, "clone", str(self.remote), str(self.seed))
        run(GIT, "-C", str(self.seed), "config", "user.name", "test")
        run(GIT, "-C", str(self.seed), "config", "user.email", "test@example.org")
        (self.seed / "index.html").write_text("original static")
        (self.seed / "build-info.json").write_text(json.dumps({"run": "10"}))
        (self.seed / "LICENSE").write_text("preserve license")
        (self.seed / "source").mkdir()
        (self.seed / "source" / "old.txt").write_text("original source")
        (self.seed / "source" / "app").mkdir()
        (self.seed / "source" / "app" / "page.tsx").write_text("old audited source")
        run(GIT, "-C", str(self.seed), "add", "-A")
        run(GIT, "-C", str(self.seed), "commit", "-m", "initial")
        run(GIT, "-C", str(self.seed), "push", "origin", "main")
        self.workspace = self.base / "workspace"
        self.workspace.mkdir()
        self.runner = self.base / "runner"
        self.runner.mkdir()
        self.shim = self.base / "bin"
        self.shim.mkdir()
        self.injected = self.base / "injected"
        self.concurrent = self.base / "concurrent"
        self.summary = self.base / "summary.txt"
        
        
        wrapper = """#!/usr/bin/env bash
set -e
if [[ "${1:-}" == "clone" ]]; then
  /usr/bin/git "$@"
  # Same size + same mtime must NOT hide changed content (rsync --checksum).
  if [[ "$INJECT_KIND" == "source" ]]; then
    touch -r "$RUNNER_TEMP/ruido-public/build-info.json" "$GITHUB_WORKSPACE/out/build-info.json"
  else
    touch -r "$RUNNER_TEMP/ruido-public/source/app/page.tsx" "$GITHUB_WORKSPACE/source-public/app/page.tsx"
  fi
  exit 0
fi
if [[ "${1:-}" == "-C" && "${3:-}" == "push" && ! -e "$INJECT_MARK" ]]; then
  touch "$INJECT_MARK"
  /usr/bin/git clone "$PUBLIC_REMOTE" "$CONCURRENT_CLONE"
  /usr/bin/git -C "$CONCURRENT_CLONE" config user.name race
  /usr/bin/git -C "$CONCURRENT_CLONE" config user.email race@example.org
  if [[ "$INJECT_KIND" == "source" ]]; then
    mkdir -p "$CONCURRENT_CLONE/source"
    printf 'concurrent source\\n' > "$CONCURRENT_CLONE/source/race.txt"
  else
    printf 'concurrent static\\n' > "$CONCURRENT_CLONE/index.html"
  fi
  /usr/bin/git -C "$CONCURRENT_CLONE" add -A
  /usr/bin/git -C "$CONCURRENT_CLONE" commit -m concurrent
  /usr/bin/git -C "$CONCURRENT_CLONE" push origin HEAD:main
fi
exec /usr/bin/git "$@"
"""
        (self.shim / "git").write_text(wrapper)
        (self.shim / "git").chmod(0o755)

    def execute(self, workflow, step, inject):
        script = publication_step(workflow, step)
        self.assertIn("for attempt in 1 2 3 4 5; do", script)
        self.assertIn("rsync -a --checksum --delete", script)
        self.assertIn("git -C \"$dest\" reset --hard FETCH_HEAD", script)
        self.assertIn("git -C \"$dest\" fetch --depth=1 origin main", script)
        self.assertNotIn("push --force", script)
        self.assertNotIn("push -f", script)
        
        script = script.replace("gh auth setup-git", "true")
        script = script.replace("https://github.com/leomoreiraa/ruido.git",
                                str(self.remote))
        check = subprocess.run(["bash", "-n"], input=script, text=True,
                               capture_output=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        env = os.environ.copy()
        env.update({
            "PATH": str(self.shim) + os.pathsep + os.environ["PATH"],
            "RUNNER_TEMP": str(self.runner),
            "GITHUB_WORKSPACE": str(self.workspace),
            "GITHUB_SHA": "testsha",
            "GITHUB_RUN_ID": "20",
            "GITHUB_STEP_SUMMARY": str(self.summary),
            "RUIDO_PUBLIC_REPO_TOKEN": "fake-test-token",
            "INJECT_MARK": str(self.injected),
            "INJECT_KIND": inject,
            "PUBLIC_REMOTE": str(self.remote),
            "CONCURRENT_CLONE": str(self.concurrent),
        })
        completed = subprocess.run(["bash", "-e", "-o", "pipefail"],
                                   input=script, env=env, text=True,
                                   capture_output=True, timeout=90)
        self.assertEqual(completed.returncode, 0,
                         completed.stdout[-3000:] + "\n" + completed.stderr[-3000:])
        self.assertTrue(self.injected.exists(), "test did not inject a push race")
        checked = self.base / "checked"
        run(GIT, "clone", str(self.remote), str(checked))
        return checked

    def test_site_retry_preserves_concurrent_source_and_license(self):
        out = self.workspace / "out"
        out.mkdir()
        (out / "index.html").write_text("new audited static")
        (out / "build-info.json").write_text(json.dumps({"run": "20"}))
        checked = self.execute(".github/workflows/deploy-visual-fast.yml",
                               "Sincronizar site auditado no repositório público",
                               "source")
        self.assertEqual((checked / "index.html").read_text(), "new audited static")
        self.assertEqual((checked / "source/race.txt").read_text(),
                         "concurrent source\n")
        self.assertEqual((checked / "LICENSE").read_text(), "preserve license")
        self.assertEqual(json.loads((checked / "build-info.json").read_text())["run"],
                         "20")

    def test_source_mirror_does_not_require_actions_artifact_storage(self):
        workflow = (ROOT / ".github/workflows/publish-public-source.yml").read_text()
        self.assertNotIn("actions/upload-artifact@", workflow)
        self.assertNotIn("actions/download-artifact@", workflow)
        self.assertNotIn("needs: export", workflow)
        self.assertIn("group: ruido-public-write", workflow)
        self.assertLess(workflow.index("python3 -I scripts/build-public-source.py export source-public"),
                        workflow.index("python3 -I scripts/build-public-source.py verify source-public"))
        self.assertLess(workflow.index("python3 -I scripts/build-public-source.py verify source-public"),
                        workflow.index("      - name: Enviar apenas source/ ao GitHub público"))

    def test_source_retry_preserves_concurrent_site(self):
        src = self.workspace / "source-public"
        (src / "app").mkdir(parents=True)
        (src / "app/page.tsx").write_text("new audited source")
        checked = self.execute(".github/workflows/publish-public-source.yml",
                               "Enviar apenas source/ ao GitHub público", "site")
        self.assertEqual((checked / "index.html").read_text(), "concurrent static\n")
        self.assertEqual((checked / "source/app/page.tsx").read_text(),
                         "new audited source")
        self.assertEqual((checked / "LICENSE").read_text(), "preserve license")


if __name__ == "__main__":
    unittest.main()
