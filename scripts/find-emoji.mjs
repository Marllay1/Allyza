// Lists emoji / pictographic glyphs in UI source (excluding locale files, where emoji inside real copy is intentional).
// Run: node scripts/find-emoji.mjs
import fs from "node:fs";
import path from "node:path";

const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2190}-\u{21FF}\u{2795}\u{25B6}\u{2713}\u{2715}\u{2039}\u{203A}\u{FF0B}\u{2764}]/u;
let count = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(f.name) && !p.includes("locales")) {
      fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (re.test(line)) { count++; console.log(`${p.replace(/\\/g, "/")}:${i + 1}: ${line.trim().slice(0, 130)}`); }
      });
    }
  }
})("src");
console.log(`\n${count} line(s)`);
process.exit(count && process.argv.includes("--strict") ? 1 : 0);
