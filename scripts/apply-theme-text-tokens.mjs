/**
 * Codemod: map hardcoded Tailwind text neutrals/grays to theme tokens.
 * Run from repo root: node scripts/apply-theme-text-tokens.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "src");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(p) && !p.includes("node_modules")) out.push(p);
  }
  return out;
}

function replaceNeutrals(s) {
  const pairs = [
    [/text-neutral-300\b/g, "text-foreground-muted"],
    [/text-neutral-400\b/g, "text-foreground-dim"],
    [/text-neutral-500\b/g, "text-foreground-dim"],
    [/text-neutral-600\b/g, "text-foreground-muted"],
    [/text-neutral-700\b/g, "text-foreground-muted"],
    [/text-neutral-800\b/g, "text-foreground"],
    [/text-gray-300\b/g, "text-foreground-muted"],
    [/text-gray-400\b/g, "text-foreground-dim"],
    [/text-gray-500\b/g, "text-foreground-dim"],
    [/text-gray-600\b/g, "text-foreground-muted"],
    [/text-zinc-400\b/g, "text-foreground-dim"],
    [/text-zinc-500\b/g, "text-foreground-dim"],
    [/text-zinc-600\b/g, "text-foreground-muted"],
    [/text-slate-400\b/g, "text-foreground-dim"],
    [/text-slate-500\b/g, "text-foreground-dim"],
    [/text-slate-600\b/g, "text-foreground-muted"],
  ];
  for (const [re, rep] of pairs) s = s.replace(re, rep);
  return s;
}

function replaceWhite(s, file) {
  const rel = file.replace(/\\/g, "/");
  if (rel.includes("/video/VideoPlayer.tsx")) return s;
  if (rel.includes("/video/VideoCard.tsx")) return s;
  if (rel.endsWith("/Toast.tsx")) return s;

  s = s.replace(/\btext-white\/90\b/g, "text-foreground/90");
  s = s.replace(/\btext-white\/80\b/g, "text-foreground/80");
  s = s.replace(/\btext-white\/60\b/g, "text-foreground/60");
  s = s.replace(/\btext-white\/40\b/g, "text-foreground/40");
  s = s.replace(/\bhover:text-white\b/g, "hover:text-foreground");
  s = s.replace(/\bgroup-hover:text-white\b/g, "group-hover:text-foreground");
  s = s.replace(/\btext-white\b/g, "text-foreground");

  const restores = [
    [/bg-accent text-foreground/g, "bg-accent text-white"],
    [/bg-indigo-500 text-foreground/g, "bg-indigo-500 text-white"],
    [/bg-indigo-600 text-foreground/g, "bg-indigo-600 text-white"],
    [/bg-red-500 text-foreground/g, "bg-red-500 text-white"],
    [/bg-red-600 text-foreground/g, "bg-red-600 text-white"],
    [/bg-green-500 text-foreground/g, "bg-green-500 text-white"],
    [/bg-green-600 text-foreground/g, "bg-green-600 text-white"],
    [/bg-blue-500 text-foreground/g, "bg-blue-500 text-white"],
    [/bg-blue-600 text-foreground/g, "bg-blue-600 text-white"],
    [/bg-yellow-500 text-foreground/g, "bg-yellow-500 text-white"],
    [/from-blue-600 to-indigo-600 text-foreground/g, "from-blue-600 to-indigo-600 text-white"],
    [/from-purple-600 to-pink-600 text-foreground/g, "from-purple-600 to-pink-600 text-white"],
    [/bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground/g, "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"],
    [/bg-gradient-to-r from-purple-600 to-pink-600 text-foreground/g, "bg-gradient-to-r from-purple-600 to-pink-600 text-white"],
    [/bg-indigo-500\/80 text-foreground/g, "bg-indigo-500/80 text-white"],
    [/bg-accent\/80 text-foreground/g, "bg-accent/80 text-white"],
  ];
  for (const [re, rep] of restores) s = s.replace(re, rep);

  // Sidebar logo tile: gradient + icon must stay light
  s = s.replace(
    /bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-foreground/g,
    "bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white",
  );

  s = s.replace(/bg-foreground text-foreground\b/g, "bg-foreground text-background");
  s = s.replace(/bg-white text-foreground\b/g, "bg-white text-black");

  return s;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, "utf8");
  let after = replaceNeutrals(before);
  after = replaceWhite(after, file);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(file.replace(/\\/g, "/"));
  }
}
console.log("Files updated:", changed);
