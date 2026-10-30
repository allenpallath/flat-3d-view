#!/usr/bin/env bash
# Build the app and publish dist/ to the gh-pages branch (GitHub Pages: "Deploy from a branch" → gh-pages / root).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
SRC_SHA=$(git rev-parse --short HEAD)
REMOTE=$(git remote get-url origin)
TMP=$(mktemp -d)
cp -r dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name || echo deploy)" -c user.email="$(git -C "$OLDPWD" config user.email || echo deploy@localhost)" \
  commit -qm "Deploy $SRC_SHA to GitHub Pages"
git push -f "$REMOTE" gh-pages
rm -rf "$TMP"
echo "Deployed $SRC_SHA → https://allenpallath.github.io/flat-3d-view/"
