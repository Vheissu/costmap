#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-voldemort}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/doughmap/current}"

cd "$REPO_ROOT"
npm run build

ssh "$SSH_HOST" "mkdir -p '$REMOTE_ROOT'"
rsync -az --delete --no-o --no-g --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r dist/ "$SSH_HOST:$REMOTE_ROOT/"
ssh "$SSH_HOST" "chown -R www-data:www-data '$REMOTE_ROOT' || true"

echo "Deployed dist/ to $SSH_HOST:$REMOTE_ROOT"
