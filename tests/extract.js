"use strict";
/* index.html から <script> の内容を抽出し、構文チェック用ファイルを生成する */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "index.html");
const out = "/tmp/opencode/game.js";

const html = fs.readFileSync(src, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("ERROR: <script> block not found in index.html");
  process.exit(1);
}
fs.mkdirSync("/tmp/opencode", { recursive: true });
fs.writeFileSync(out, m[1]);
console.log("extracted " + m[1].length + " bytes -> " + out);
