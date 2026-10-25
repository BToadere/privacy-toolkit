/*
 * Step 2 - Check selection mode (clicks "Select", deletes nothing)
 *
 * Clicks the "Select" button to turn on selection mode, then counts
 * how many like icons are loaded. It does NOT select or unlike anything.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/likes
 */
(async function checkSelectMode() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Select label is now a bare <span> with no data-bloks-name (changed
  // 2026-07-27); match on the element's own text instead.
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const selectBtn = [...document.querySelectorAll('span,div')]
    .find(el => ownText(el) === "Select");

  if (!selectBtn) {
    console.warn("Select button not found. Reload the page and try again.");
    return;
  }

  selectBtn.scrollIntoView({ block: "center" });
  ["mousedown", "mouseup", "click"].forEach(t =>
    selectBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));

  console.log("Clicked Select, waiting for icons to load...");
  await sleep(1500);

  const icons = document.querySelectorAll('[data-testid="bulk_action_checkbox"] div[style*="circle__outline"], div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  console.log("Selectable like icons now visible:", icons.length);
  console.log("Scroll down to load more likes. When this works, run 3-test-flow-likes.js.");
})();
