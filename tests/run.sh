#!/bin/bash
# Phase検証: 抽出 -> 構文チェック -> スモークテスト
set -e
cd "$(dirname "$0")/.."

echo "== extract =="
node tests/extract.js

echo "== syntax check =="
node --check /tmp/opencode/game.js
echo "syntax OK"

echo "== smoke test =="
node tests/harness.js
