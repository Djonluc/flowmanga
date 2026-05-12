import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "src", "components");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function transform(s) {
  const ordered = [
    ["bg-neutral-900/80", "bg-surface/90"],
    ["bg-neutral-900/50", "bg-surface/50"],
    ["bg-neutral-900", "bg-surface"],
    ["bg-neutral-800/50", "bg-surface-raised/50"],
    ["bg-neutral-800", "bg-surface-raised"],
    ["hover:bg-neutral-800", "hover:bg-surface-raised"],
    ["hover:bg-neutral-700", "hover:bg-surface-raised"],
    ["border-neutral-700", "border-foreground-dim/25"],
  ];
  for (const [a, b] of ordered) s = s.split(a).join(b);
  return s;
}

let n = 0;
for (const file of walk(ROOT)) {
  if (file.includes("ReaderBottomBar.tsx")) continue;
  const b = fs.readFileSync(file, "utf8");
  const a = transform(b);
  if (a !== b) {
    fs.writeFileSync(file, a, "utf8");
    n++;
    console.log(file);
  }
}
console.log("patched", n);
