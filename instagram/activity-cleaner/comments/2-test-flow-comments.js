/*
 * Step 2 - Test flow (comments; deletes nothing)
 *
 * Runs every step of the bulk script up to, but not including, the delete:
 * turns on selection mode, selects up to 3 rows, checks Instagram registered
 * them, finds the action button WITHOUT clicking it, then clears the selection.
 * If every line says OK, the bulk script's selectors still match the page.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/comments
 */
(async function testFlowComments() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    ["mousedown", "mouseup", "click"].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));
  };
  // empty circles: new UI ([data-testid] + mask style) or the old bloks one
  const getIcons = () => [...document.querySelectorAll('[data-testid="bulk_action_checkbox"] div[style*="circle__outline"], div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]')];
  const countChecked = () => [...document.querySelectorAll('[data-testid="bulk_action_checkbox"] div[style], div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle-check")).length;
  // the clickable row: the circle has its own role=button ("Toggle checkbox"),
  // the row is the next role=button up (new UI, 2026-10-25)
  const rowOf = (el) => {
    let row = el.closest('[role="button"]');
    while (row && row.getAttribute("aria-label") === "Toggle checkbox") row = row.parentElement?.closest('[role="button"]');
    return row || null;
  };
  const ok = (msg) => console.log(`%c  OK    ${msg}`, "color:lime");
  const fail = (msg) => { console.warn(`  FAIL  ${msg}`); return false; };

  console.log("%cTest flow - checks every step of the bulk script, deletes nothing.", "color:cyan;font-weight:bold");
  let pass = true;

  // 1. selection mode
  let icons = getIcons();
  if (!icons.length) {
    const sb = [...document.querySelectorAll("span,div")].find(el => ownText(el) === "Select")
      || [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')].find(el => el.innerText?.trim() === "Select");
    if (!sb) return fail("'Select' not found - reload the page, or Instagram changed it.");
    realClick(sb);
    await sleep(1800);
    icons = getIcons();
  }
  if (!icons.length) return fail("selection mode is on but no rows have a checkbox - nothing to test on.");
  ok(`selection mode on, ${icons.length} rows with a checkbox`);

  // 2. select up to 3 and make sure Instagram registered it
  const checkedBefore = countChecked();
  const outlineBefore = getIcons().length;
  const picks = [];
  for (const icon of icons) {
    if (picks.length >= 3) break;
    const row = rowOf(icon);
    if (!row) continue;
    realClick(row);
    picks.push(row);
    await sleep(700);
  }
  if (!picks.length) return fail("no row was clickable.");
  await sleep(700);
  // a selected row swaps its empty circle for a checked one; read either side
  const registered = Math.max(countChecked() - checkedBefore, outlineBefore - getIcons().length);
  if (registered === picks.length) ok(`selected ${picks.length}, and Instagram shows ${registered} checked`);
  else pass = fail(`clicked ${picks.length} rows but Instagram shows ${registered} checked - the bulk script would delete the wrong amount or nothing.`);
  picks.forEach((row, i) => console.log(`        ${i + 1}. ${(row.getAttribute("aria-label") || (row.innerText || "").replace(/\s+/g, " ").trim()).slice(0, 100) || "(media only)"}`));

  // 3. the action button the bulk script presses - located, NOT clicked
  const action = document.querySelector('div[role="button"][aria-label="Delete"][style*="pointer-events: auto"]')
    || [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
      .find(s => s.innerText?.trim() === "Delete")?.closest('div[style*="pointer-events: auto"]');
  if (action) ok("'Delete' button found (not clicked)");
  else pass = fail("'Delete' button not found - the bulk script would stop here.");

  // 4. undo the selection
  for (const row of picks) { if (document.contains(row)) realClick(row); await sleep(400); }
  await sleep(700);
  if (getIcons().length >= outlineBefore) ok("selection cleared");
  else console.warn("  WARN  some rows are still checked - untick them by hand or reload the page.");

  console.log(pass
    ? "%cTest passed. Nothing was deleted. Next: run the bulk script (it starts in DRY_RUN)."
    : "%cTest failed. Nothing was deleted. Do NOT run the bulk script - paste this output in an issue.",
    `color:${pass ? "lime" : "red"};font-weight:bold`);
  return pass;
})();
