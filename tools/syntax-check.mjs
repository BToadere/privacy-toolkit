// Parses every console script so a typo never ships.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (name === "node_modules" || name.startsWith(".")) return [];
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
});
const files = walk(join(import.meta.dirname, "..", "instagram"))
  .filter((p) => !p.includes("/src/")); // templates contain the //@engine marker, not full scripts
for (const f of files) execFileSync(process.execPath, ["--check", f], { stdio: "inherit" });
console.log(`syntax ok: ${files.length} scripts`);
