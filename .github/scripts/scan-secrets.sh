#!/usr/bin/env bash
set -euo pipefail

: "${BASE_SHA:?}" "${HEAD_SHA:?}"

revision_range="${BASE_SHA}..${HEAD_SHA}"
if [[ "$BASE_SHA" == 0000000000000000000000000000000000000000 ]]; then
  revision_range="$HEAD_SHA"
fi

# Include side branches and changes introduced by merge commits.
gitleaks git --redact --exit-code=2 --log-opts="--full-history -m $revision_range"
