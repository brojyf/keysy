# Keysy

## Local pre-commit checks

Install [Gitleaks](https://github.com/gitleaks/gitleaks#installing) and enable
the repository hooks once per clone:

```sh
brew install gitleaks
git config --local core.hooksPath .githooks
```

The hook blocks commits with whitespace errors or detected secrets in staged
changes. It does not modify files. Gitleaks must be available on `PATH`, including
when committing from an IDE; a missing installation blocks the commit with an
installation hint. CI tests the hook with Gitleaks 8.30.1 and retains the full
commit-range secret scan and existing checks.

Run the hook tests with:

```sh
python3 .github/scripts/test_pre_commit.py
```

## Contributors
Patrick Jiang  
JZ Wang
