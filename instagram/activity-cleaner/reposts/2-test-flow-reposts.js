/*
 * Step 2 (reposts) - Test flow (reposts; deletes nothing)
 *
 * Runs every step of the bulk script up to, but not including, the delete:
 * turns on selection mode, selects up to 3 rows, checks Instagram registered
 * them, finds the action button WITHOUT clicking it, then clears the selection.
 * If every line says OK, the bulk script's selectors still match the page.
 *
 * Sort the list "Oldest to newest" first (Sort & filter) - see NOTES.md.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/reposts
 */
(async function testFlowReposts() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  // the reposts page only reacts to a full pointer+mouse sequence on the leaf
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      pointerId: 1, pointerType: "mouse", isPrimary: true
    };
    el.dispatchEvent(new PointerEvent("pointerover", o));
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus();
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  };
  const getIcons = () => [...document.querySelectorAll('div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle__outline"));
  const countChecked = () => [...document.querySelectorAll('div[data-bloks-name="ig.components.Icon"]')]
    .filter(el => (el.getAttribute("style") || "").includes("circle-check")).length;
  const ok = (msg) => console.log(`%c  OK    ${msg}`, "color:lime");
  const fail = (msg) => { console.warn(`  FAIL  ${msg}`); return false; };

  console.log("%cTest flow - checks every step of the bulk script, deletes nothing.", "color:cyan;font-weight:bold");
  let pass = true;

  // 1. selection mode
  let icons = getIcons();
  if (!icons.length) {
    const sb = [...document.querySelectorAll('span[data-bloks-name="bk.components.Text"]')].find(s => ownText(s) === "Select");
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
    const row = icon.closest('[role="button"]');
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
  picks.forEach((row, i) => console.log(`        ${i + 1}. ${(row.innerText || "").replace(/\s+/g, " ").trim().slice(0, 100) || "(media only)"}`));

  // 3. the action button the bulk script presses - located, NOT clicked
  const action = [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
    .find(s => ownText(s) === "Delete" && s.closest('div[role="button"][aria-label="Delete"]'));
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
