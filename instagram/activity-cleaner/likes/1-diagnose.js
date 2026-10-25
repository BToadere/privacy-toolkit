/*
 * Step 1 - Diagnose (read only)
 *
 * Does nothing but read the page. No clicks, no deletes.
 * Use it to confirm the selectors below still match Instagram's
 * current UI before you run anything that changes data.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/likes
 */
(function diagnose() {
  // Select label is now a bare <span> with no data-bloks-name (changed
  // 2026-07-27); match on the element's own text instead.
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const selectBtn = [...document.querySelectorAll('span,div')]
    .find(el => ownText(el) === "Select");
  const icons = document.querySelectorAll('[data-testid="bulk_action_checkbox"] div[style*="circle__outline"], div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');

  console.log("%c=== IG diagnose (read only) ===", "font-weight:bold;font-size:14px");
  console.log("Select button found:", selectBtn ? "yes" : "no");
  console.log("Selectable like icons visible right now:", icons.length);
  console.log("UI language:", document.documentElement.lang || "unknown");
  console.log("Current URL:", location.href);

  if (!selectBtn) {
    console.warn("Select button not found. Either the page is still loading, " +
      "or your UI is not in English (the scripts match the English labels " +
      "'Select' and 'Unlike').");
  }
  // 0 icons here is normal: the circle icons only appear after you turn on
  // selection mode. Run 2-check-select-mode.js next.
})();
