/*
 * Step 1 (story replies) - Diagnose (turns on selection mode, deletes nothing)
 *
 * Same flow as the comments scripts. Clicks "Select" and reports whether the
 * selectors still match. It does NOT select or delete anything.
 *
 * Run on: https://www.instagram.com/your_activity/interactions/story_replies
 */
(async function diagnoseStoryReplies() {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Select is a bare <span> on the current UI (2026-07-27); the Flexbox
  // wrapper is the older UI. Try both.
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const selectBtn = [...document.querySelectorAll('span,div')].find(el => ownText(el) === "Select")
    || [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')]
      .find(el => el.innerText?.trim() === "Select");

  console.log("%c=== IG story replies diagnose (read only) ===", "font-weight:bold;font-size:14px");
  console.log("Select button found:", selectBtn ? "yes" : "no");
  console.log("UI language:", document.documentElement.lang || "unknown");
  console.log("URL:", location.href);

  if (!selectBtn) {
    console.warn("No Select button. Page still loading, or UI not in English " +
      "(scripts match the English labels 'Select' and 'Delete').");
    return;
  }

  selectBtn.scrollIntoView({ block: "center" });
  ["mousedown", "mouseup", "click"].forEach(t =>
    selectBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));
  await sleep(1500);

  const icons = document.querySelectorAll('[data-testid="bulk_action_checkbox"] div[style*="circle__outline"], div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  const deleteSpan = document.querySelector('div[role="button"][aria-label="Delete"]')
    || [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
      .find(s => s.innerText?.trim() === "Delete");

  console.log("Selectable icons after Select:", icons.length);
  console.log("'Delete' control present:", deleteSpan ? "yes" : "no (usually appears once something is selected)");
  console.log("If this looks right, run 2-test-flow-story-replies.js.");
})();
