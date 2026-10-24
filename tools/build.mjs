// Builds the paste-ready console scripts from src/.
//
// Each src/<type>.bulk.js holds the settings and page-specific selectors for
// one activity type and an `//@engine` marker. The marker is replaced with the
// shared engine (src/bulk-engine.js), so every generated file stays a single,
// self-contained script you can read top to bottom and paste into the console.
//
//   node tools/build.mjs          write the generated scripts
//   node tools/build.mjs --check  fail if a generated script is out of date
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "instagram", "activity-cleaner");
const TARGETS = {
  "likes.bulk.js": "likes/4-bulk-unlike.js",
  "comments.bulk.js": "comments/3-bulk-delete-comments.js",
  "story_replies.bulk.js": "story_replies/3-bulk-delete-story-replies.js",
};
const NOTICE = "/* GENERATED from src/ by tools/build.mjs - edit src/, then run `npm run build`. */\n";

const check = process.argv.includes("--check");
const engine = readFileSync(join(ROOT, "src", "bulk-engine.js"), "utf8");
let stale = 0;

for (const [src, out] of Object.entries(TARGETS)) {
  const template = readFileSync(join(ROOT, "src", src), "utf8");
  if (!template.includes("  //@engine\n")) throw new Error(`${src}: missing //@engine marker`);
  const start = template.indexOf("(async function");
  const built = template.slice(0, start) + NOTICE + template.slice(start).replace("  //@engine\n", engine);
  const path = join(ROOT, out);
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== built) {
      console.error(`out of date: ${out}`);
      stale++;
    }
  } else {
    writeFileSync(path, built);
    console.log(`built ${out}`);
  }
}
if (stale) {
  console.error("Run `npm run build` and commit the result.");
  process.exit(1);
}
