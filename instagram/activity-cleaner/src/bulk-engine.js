  window.__STOP__ = false;
  const RETRY_LIMIT = MAX_RETRIES < 0 ? "unlimited" : MAX_RETRIES;
  const RECOVER_LIMIT = RECOVER_500 < 0 ? "unlimited" : RECOVER_500;
  const EMPTY_LIMIT = EMPTY_RECOVERIES < 0 ? "unlimited" : EMPTY_RECOVERIES;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));

  // Watch Instagram's own action requests. A 500 here is almost always rate
  // limiting after a burst, not a bug - we detect it and stop cleanly instead
  // of misreporting "nothing left" when the page has actually broken.
  let actionError = null;   // HTTP error on the real action
  let loadMore429 = false;  // 429 on pagination ('load more') this cycle
  const __origFetch = window.fetch;
  window.fetch = function (...a) {
    const p = __origFetch.apply(this, a);
    const u = typeof a[0] === "string" ? a[0] : (a[0] && a[0].url) || "";
    if (u.includes("wbloks/fetch") && u.includes("type=action")) {
      p.then(r => {
        if (!r.ok) {
          if (u.includes("_next")) {
            if (r.status === 429) { loadMore429 = true; console.warn("HTTP 429 registered on 'load more' - Instagram is throttling (the actions themselves still go through)."); }
            else console.warn(`Note: 'load more' failed (HTTP ${r.status}) - continuing.`);
          } else actionError = r.status; // error on the real action
        }
      }).catch(() => { actionError = "network"; });
    }
    return p;
  };
  const realClick = (el) => {
    el.scrollIntoView({ block: "center" });
    ["mousedown", "mouseup", "click"].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, buttons: 1 })));
  };
  // Instagram dropped the data-bloks-name wrapper around the Select label
  // (recorded 2026-07-27: it's now a bare <span>, bloks/aria/role all null, no
  // role=button parent). Match on the element's OWN text instead - ownText only
  // counts direct text nodes, so this hits the innermost label span and not
  // some big container whose innerText happens to include "Select". Clicking
  // the span works; the event bubbles to the real handler.
  const ownText = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
  const findSelect = () => [...document.querySelectorAll('span,div')]
    .find(el => ownText(el) === "Select")
    || [...document.querySelectorAll('div[data-bloks-name="bk.components.Flexbox"]')]
      .find(el => el.innerText?.trim() === "Select")
    || null;
  // Empty selection circles. Instagram dropped the bloks attributes here
  // (recorded 2026-10-25): the circle is now a plain div with the
  // circle__outline mask inside [data-testid="bulk_action_checkbox"]. The old
  // bloks selector stays as a fallback for accounts still on the old UI.
  const getIcons = () => document.querySelectorAll(
    '[data-testid="bulk_action_checkbox"] div[style*="circle__outline"], div[data-bloks-name="ig.components.Icon"][style*="circle__outline"]');
  // The clickable row around a circle. The circle sits in its own
  // role=button ("Toggle checkbox", pointer-events: none); the row is the
  // next role=button up, labelled with the post ("Video, 3 of 18, by @x, ...").
  const rowOf = (el) => {
    let row = el.closest('[role="button"]');
    while (row && row.getAttribute("aria-label") === "Toggle checkbox") row = row.parentElement?.closest('[role="button"]');
    return row || null;
  };
  // Every row on the page, selected or not.
  const allRows = () => [...document.querySelectorAll(
    '[data-testid="bulk_action_checkbox"], div[data-bloks-name="ig.components.Icon"][style*="circle"]')]
    .map(rowOf).filter(Boolean);
  // A row's identity. The list is virtualized and React reuses row nodes, so
  // DOM nodes cannot be used as keys. The row label names the post; its
  // "N of M" position shifts as items go, so it is dropped. Rows without a
  // label fall back to their text plus thumbnail.
  const rowKey = (row) => {
    const label = row.getAttribute("aria-label");
    if (label) return label.replace(/, \d+ of \d+/, "");
    return (row.innerText || "").replace(/\s+/g, " ").trim() + "|" + (row.querySelector("img")?.src || "");
  };
  // Click the rows with these keys that are still on the page (used to undo a
  // selection - never by node, which may now show a different post).
  const clickRowsByKey = async (keys) => {
    const want = new Set(keys);
    for (const row of allRows()) {
      if (!want.has(rowKey(row))) continue;
      want.delete(rowKey(row));
      realClick(row);
      await sleep(rnd(300, 600));
    }
  };
  // Dry run only: scroll through the list and count the rows, up to SCAN_LIMIT
  // (every scroll is a 'load more' request, so the scan is capped too). Stops
  // early on a 429 - counting is not worth getting throttled for.
  const scanList = async () => {
    const seen = new Set();
    let still = 0;
    window.scrollTo(0, 0);
    await sleep(1500);
    while (seen.size < SCAN_LIMIT && still < 4 && !window.__STOP__ && !loadMore429) {
      const before = seen.size;
      for (const icon of getIcons()) {
        const row = rowOf(icon);
        if (row) seen.add(rowKey(row));
      }
      still = seen.size === before ? still + 1 : 0;
      window.scrollBy(0, 1600);
      await sleep(rnd(1200, 2000));
    }
    window.scrollTo(0, 0);
    await sleep(1500);
    return { count: Math.min(seen.size, SCAN_LIMIT), complete: still >= 4, throttled: loadMore429 };
  };
  const blocked = () => [...document.querySelectorAll("*")]
    .some(el => /action blocked|try again later|we restrict/i.test(el.innerText || ""));

  // Sort order. Every re-render (reload, tab switch, the recovery below) drops
  // the list back to the default "Newest to oldest", so we read what is set,
  // remember it, and put it back when it flips. Flow recorded 2026-07-20:
  // Sort & filter -> the order option -> Apply, all div[role=button] with an
  // exact aria-label; the current order is shown as plain text next to the
  // Sort & filter button.
  const SORT_LABEL = { newest: "Newest to oldest", oldest: "Oldest to newest" };
  const byAria = (label) => [...document.querySelectorAll('[role="button"]')]
    .find(el => (el.getAttribute("aria-label") || "").trim() === label);
  // only VISIBLE text counts - the closed sort sheet can stay in the DOM with
  // both options in it, which would make every read look like "newest"
  const visible = (el) => el.offsetParent !== null;
  const readSort = () => {
    const texts = [...document.querySelectorAll("div,span")]
      .filter(visible).map(el => (el.innerText || "").trim());
    const hits = Object.keys(SORT_LABEL).filter(key => texts.includes(SORT_LABEL[key]));
    return hits.length === 1 ? hits[0] : null; // both visible = sheet is open, cannot tell
  };
  const applySort = async (order) => {
    if (readSort() === order) return true;
    // the page can still be rendering (right after a recovery tab switch it
    // always is), so wait for the button instead of giving up on the spot
    let sf = byAria("Sort & filter");
    for (let i = 0; i < 8 && !sf; i++) { await sleep(1500); sf = byAria("Sort & filter"); }
    if (!sf) { console.warn("Sort & filter button not found - leaving the sort order alone."); return false; }
    realClick(sf);
    await sleep(1500);
    const opt = byAria(SORT_LABEL[order]);
    if (!opt) { console.warn(`Sort option '${SORT_LABEL[order]}' not found - leaving the sort order alone.`); return false; }
    realClick(opt);
    await sleep(800);
    const apply = byAria("Apply");
    if (!apply) { console.warn("Apply button not found - the sort sheet may still be open."); return false; }
    realClick(apply);
    await sleep(3000); // the list reloads
    const now = readSort();
    if (now === order) { console.log(`%cSort order set to '${SORT_LABEL[order]}'.`, "color:orange;font-weight:bold"); return true; }
    console.warn(`Tried to set '${SORT_LABEL[order]}' but the page shows '${now ? SORT_LABEL[now] : "something unreadable"}'.`);
    return false;
  };

  // "Something went wrong - There was a problem removing some or all of your
  // content." Instagram shows this modal after a throttled action. The items
  // usually ARE removed; the modal just blocks the page until OK is pressed.
  // Its OK is a plain <button> with no bloks/aria/role attributes (recorded
  // 2026-07-20), so the same focus+click used for the confirm dialog works.
  // Clicking it the millisecond it appears does NOT bring the list back (the
  // page stays blank); by hand, where a few seconds pass first, it does. So
  // let the modal settle, then click ONCE - a second click lands on the
  // closing dialog and seems to kill the re-render.
  const findOk = () => [...document.querySelectorAll("button")]
    .find(b => (b.innerText || "").trim() === "OK");
  const DIALOG_SETTLE = 4000; // wait before pressing OK
  const DIALOG_AFTER  = 6000; // wait after pressing OK, before retrying the list
  const DIALOG_RETRY  = 2000; // re-check pause after a dialog (instead of the long SELECT_PAUSES)
  let justDismissed = false;  // set by dismissError, consumed by the select loop
  let dialogSpent = 0;        // ms burned on the dialog this cycle - credited against the cycle pause
  const dismissError = async () => {
    if (!findOk()) return false;
    const t0 = Date.now();
    console.warn(`'Something went wrong' dialog is up - waiting ${DIALOG_SETTLE / 1000}s, then pressing OK.`);
    await sleep(DIALOG_SETTLE);
    const ok = findOk();
    if (!ok) return false; // gone on its own
    ok.focus();
    ok.click();
    await sleep(600);
    if (document.contains(ok)) realClick(ok); // native click did not take
    console.warn(`Pressed OK - waiting ${DIALOG_AFTER / 1000}s for the page to come back, then retrying.`);
    await sleep(DIALOG_AFTER);
    justDismissed = true; // keep the following re-checks short, not 5/8/12s
    dialogSpent += Date.now() - t0; // waiting here counts towards the cycle pause
    return true;
  };

  // After a 500 the list often breaks (endless spinner). A full page reload
  // would kill this script, but the page is an SPA: switching to another tab
  // and back makes Instagram re-render the list in place. Try that before
  // giving up.
  const findTab = (label) => {
    const re = new RegExp("^" + label + "$", "i");
    const els = [...document.querySelectorAll("div,span")].filter(el => re.test((el.innerText || "").trim()));
    return els.length ? els[els.length - 1] : null; // last match = deepest element
  };
  let recoverTries = 0;
  // Counts only the tab switches that did NOT bring the list back (see the 429
  // case below); a genuinely empty list must still end the run.
  let emptyRecoveries = 0;
  // err: an HTTP status (counts against RECOVER_500), or null for the
  // empty-list case, whose budget (EMPTY_RECOVERIES) the caller tracks.
  const tryRecover = async (err) => {
    actionError = null;
    loadMore429 = false;
    if (err !== null) {
      recoverTries++;
      if (RECOVER_500 >= 0 && recoverTries > RECOVER_500) return false;
    }
    const wait = rnd(RECOVER_MIN, RECOVER_MAX);
    const what = typeof err === "number" ? `HTTP ${err}` : err; // callers pass a status or a reason
    console.warn(err === null
      ? `Waiting ~${Math.round(wait / 1000)}s, then switching tabs to re-render the list without a reload.`
      : `${what} broke the page - waiting ~${Math.round(wait / 1000)}s, then switching tabs to re-render the list without a reload (attempt ${recoverTries}/${RECOVER_LIMIT}).`);
    await sleep(wait);
    await dismissError(); // the modal would eat the tab clicks
    const away = findTab(PAGE.awayTab);
    if (away) { console.log(`%cRecovery: switching to the ${PAGE.awayTab} tab...`, "color:orange;font-weight:bold"); realClick(away); await sleep(2500); }
    else console.warn(`Recovery: ${PAGE.awayTab} tab not found - cannot switch away.`);
    const home = findTab(PAGE.homeTab);
    if (home) { console.log(`%cRecovery: switching back to the ${PAGE.homeTab} tab...`, "color:orange;font-weight:bold"); realClick(home); await sleep(3500); }
    else console.warn(`Recovery: ${PAGE.homeTab} tab not found - the page may be too broken.`);
    console.log("%cRecovery: tab switch done - re-checking the list.", "color:orange;font-weight:bold");
    return true;
  };

  // Decide the order ONCE, before anything is deleted.
  let wantSort = null, sortFails = 0;
  if (SORT_ORDER === "auto") {
    wantSort = readSort();
    console.log(wantSort
      ? `Sort order: keeping '${SORT_LABEL[wantSort]}' (auto - whatever was set when you started).`
      : "Sort order: could not read the current setting - it will not be enforced.");
  } else if (SORT_LABEL[SORT_ORDER]) {
    wantSort = SORT_ORDER;
    await applySort(wantSort);
  } else {
    console.warn(`SORT_ORDER '${SORT_ORDER}' is not valid - use "auto", "newest" or "oldest". Leaving the sort order alone.`);
  }

  let total = 0, cycle = 0, errorStreak = 0, noEffect = 0;
  console.log("%cStart. Stop with:  window.__STOP__ = true", "color:cyan;font-weight:bold");

  cycles:
  while (!window.__STOP__ && total < MAX_TOTAL) {
    // NOTE: actionError/loadMore429 are NOT reset here. Throttled responses
    // arrive seconds late (often during the between-cycle pause), so the flags
    // are only cleared where they are handled - resetting them here wiped them
    // before the check ever saw them.
    justDismissed = false; // only a dialog handled IN this cycle shortens its re-checks
    await dismissError(); // leftover modal from the last cycle
    // a re-render (recovery tab switch, or Instagram doing it on its own) puts
    // the list back to the default order - undo that before selecting anything
    if (wantSort && readSort() !== wantSort) {
      console.warn(`Sort order was reset - putting it back to '${SORT_LABEL[wantSort]}'.`);
      if (!await applySort(wantSort) && ++sortFails >= 2) {
        wantSort = null; // do not fight the page every cycle
        console.warn("Could not set the sort order twice in a row - continuing with whatever the page shows.");
      }
    }
    if (blocked()) {
      console.warn("Instagram shows 'action blocked'. Stopped. Wait 24-48h before trying again.");
      break;
    }

    // Make sure selection mode is on. If the rows are gone, check for the
    // error dialog FIRST - when it is up it is blocking the page, so waiting
    // out the retries would just burn time. Press OK, then retry the list.
    let icons = getIcons();
    if (icons.length === 0 && await dismissError()) icons = getIcons();
    for (let att = 1; icons.length === 0 && att <= SELECT_RETRIES && !window.__STOP__; att++) {
      const sb = findSelect();
      // right after a dismissed dialog we already waited DIALOG_AFTER - use
      // short re-checks so the waits do not stack up to half a minute
      const wait = justDismissed ? DIALOG_RETRY : SELECT_PAUSES[Math.min(att, SELECT_PAUSES.length) - 1];
      if (sb) { console.log(`Retry ${att}/${SELECT_RETRIES}: list is back - turning selection mode on again...`); realClick(sb); }
      else console.log(`List not ready yet (attempt ${att}/${SELECT_RETRIES}) - waiting ${Math.round(wait / 1000)}s for the page to load...`);
      const slept = sb ? 1500 : wait;
      await sleep(slept);
      if (justDismissed) dialogSpent += slept;
      icons = getIcons();
    }
    justDismissed = false;
    if (icons.length === 0) {
      if (!findSelect()) {
        // Select still gone after the retries: either truly empty, or the page
        // broke after a throttled action. Instagram's 500 is slow (~15-20s), so
        // if we were mid-run give it a moment to arrive before deciding - and
        // watch for the error dialog, which often shows up without any failed
        // request at all. If it does, click OK and carry on immediately.
        if (total > 0) {
          for (let i = 0; i < 18 && !actionError; i++) {
            if (await dismissError()) continue cycles; // start the cycle over, retries and all
            await sleep(1000);
          }
        }
        if (actionError) {
          const err = actionError;
          if (err !== 429 && await tryRecover(err)) continue;
          console.warn(`Instagram returned HTTP ${err} - rate limited, the page broke mid-run. Reload and wait 30-60+ min before running again.`);
        }
        else {
          // No request failed, but the list is gone. That is what a 429 leaves
          // behind: the flag was consumed by the backoff, so nothing counts as
          // an error any more, and the page dropped the list anyway. Give it
          // the same tab switch the 500 path gets before concluding anything.
          if (total > 0 && (EMPTY_RECOVERIES < 0 || emptyRecoveries < EMPTY_RECOVERIES)) {
            emptyRecoveries++;
            console.warn(`The list is gone but no request failed - trying the tab switch (${emptyRecoveries}/${EMPTY_LIMIT}) before giving up.`);
            if (await tryRecover(null)) continue;
          }
          console.log(`Select gone. Either all ${PAGE.noun} are removed, or Instagram rate-limited you (the page can break silently). If ${PAGE.noun} remain, reload and wait before running again.`);
        }
      } else {
        // Selection mode is available but no rows are loaded. After a
        // re-render that usually means the list is still filling in, and
        // ending a long run early is worse than waiting a few more seconds.
        console.log("Select is back but no rows yet - checking once more before calling it done...");
        realClick(findSelect());
        await sleep(5000);
        if (getIcons().length > 0) continue;
        console.log(`No ${PAGE.noun} left.`);
      }
      break;
    }

    // The list is back, so whatever we did worked. Both recovery budgets count
    // ATTEMPTS THAT FAILED - a recovery that brought the page back must not
    // spend one, or a long run dies on its second unrelated error.
    recoverTries = 0;
    emptyRecoveries = 0;

    if (DRY_RUN) {
      // Tell the user how much a real run would touch before anything else.
      console.log(`%cDRY RUN: counting ${PAGE.noun} (up to ${SCAN_LIMIT})...`, "color:yellow;font-weight:bold");
      const scan = await scanList();
      const found = scan.complete ? `${scan.count}` : `at least ${scan.count}`;
      console.log(`%cDRY RUN: ${found} ${PAGE.noun} found${scan.throttled ? " (scan stopped early: Instagram returned 429 - slow down before a real run)" : scan.complete ? "" : ` (scan capped at SCAN_LIMIT = ${SCAN_LIMIT})`}.`, "color:yellow;font-weight:bold");
      console.log(`%cDRY RUN: a real run would remove up to ${Math.min(scan.count, MAX_TOTAL)} this session (MAX_TOTAL = ${MAX_TOTAL}), in batches of ${BATCH_MIN}-${BATCH_MAX}, ~${Math.round((MIN_PAUSE + MAX_PAUSE) / 2000)}s apart.`, "color:yellow;font-weight:bold");
      loadMore429 = false;
      icons = getIcons();
      if (icons.length === 0) { console.log("DRY RUN: the list did not come back after the scan - reload and try again."); break; }
    }

    // Select a randomized batch. Instagram keeps only ~25 rows in the DOM at a
    // time, so scroll to load more until we reach the target (or run out).
    // Never select past MAX_TOTAL.
    const target = Math.min(rnd(BATCH_MIN, BATCH_MAX + 1), MAX_BATCH, MAX_TOTAL - total);
    const skipped = new Set();
    const picks = [];    // selected rows, for the dry-run report
    const pickKeys = []; // their keys, taken at selection time (nodes get reused)
    let sel = 0, emptyScrolls = 0;
    while (sel < target && !window.__STOP__ && emptyScrolls < 4) {
      let picked = 0;
      for (const icon of getIcons()) {
        if (sel >= target) break;
        if (skipped.has(icon)) continue;
        const btn = rowOf(icon);
        if (!btn) continue;
        if (Math.random() < SKIP_CHANCE) { skipped.add(icon); continue; } // stays for a later cycle
        realClick(btn);
        picks.push(btn);
        pickKeys.push(rowKey(btn));
        sel++;
        picked++;
        await sleep(rnd(450, 1100));
      }
      if (sel < target) {
        window.scrollBy(0, 1600);            // load more rows
        await sleep(1100);
        emptyScrolls = picked === 0 ? emptyScrolls + 1 : 0;
      }
    }
    if (sel === 0) { console.log("Nothing selectable. Done."); break; }

    if (DRY_RUN) {
      // Report what this batch WOULD remove, then undo the selection. The
      // list does not shrink in a dry run, so one batch is all we look at.
      const describe = (el) => {
        const label = el.getAttribute("aria-label") || "";
        const text = (el.innerText || "").replace(/\s+/g, " ").trim();
        const alt = el.querySelector("img[alt]")?.alt || "";
        return (label || text || alt || "(no text - media only)").slice(0, 120);
      };
      console.log(`%cDRY RUN: this batch would remove ${sel} item(s):`, "color:yellow;font-weight:bold");
      picks.forEach((el, i) => console.log(`  ${i + 1}. ${describe(el)}`));
      await clickRowsByKey(pickKeys);
      console.log("%cDRY RUN: selection cleared, nothing was deleted. Set DRY_RUN = false to run for real.", "color:yellow;font-weight:bold");
      break;
    }

    // Action (Unlike / Delete) + confirm.
    await sleep(1200);
    const actionBtn = PAGE.findAction();
    if (!actionBtn) { console.warn(`${PAGE.actionLabel} button not found. Stopped.`); break; }
    realClick(actionBtn);

    await sleep(PAGE.confirmWait);
    const confirmBtn = [...document.querySelectorAll("button")]
      .find(b => b.innerText?.trim() === PAGE.actionLabel);
    if (!confirmBtn) { console.warn("Confirm dialog not found. Stopped."); break; }
    confirmBtn.focus();
    await sleep(100);
    confirmBtn.click();

    // let Instagram process, then check for throttling on the requests
    await sleep(1500);
    await dismissError();
    if (actionError && actionError !== 429) {
      // 500 (or network error) on the real action: the page usually breaks here
      const err = actionError;
      if (await tryRecover(err)) continue;
      console.warn(`Instagram returned HTTP ${err} on the ${PAGE.action} action - hard stop. Reload and wait 30-60+ min (sometimes hours) before trying again.`);
      break;
    }
    if (actionError === 429) {
      errorStreak++;
      if (MAX_RETRIES >= 0 && errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on the ${PAGE.action} action again (${errorStreak}x) - you are rate limited. Stopping. Reload and wait 30-60+ min before trying again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on the ${PAGE.action} action (retry ${errorStreak}/${RETRY_LIMIT}) - backing off ~${Math.round(back / 1000)}s, then retrying the remaining ${PAGE.noun}. Warning: continuing after a 429 can result in a block.`);
      actionError = null;
      loadMore429 = false; // one backoff covers this throttle episode
      await sleep(back);
      continue;
    }

    // Did the items actually go? Instagram sometimes accepts the action (no
    // error, sometimes even a toast) and removes nothing. Selected posts that
    // are still on the page after a few seconds were not removed. Matched by
    // key, not node: React reuses row nodes for the posts that move up.
    await sleep(2500);
    const onPage = new Set(allRows().map(rowKey));
    const left = pickKeys.filter(k => onPage.has(k)).length;
    const gone = sel - left;
    if (gone === 0) {
      noEffect++;
      console.warn(`Cycle ${cycle + 1}: Instagram accepted the ${PAGE.action} but all ${sel} selected ${PAGE.noun} are still there (${noEffect}/2).`);
      await clickRowsByKey(pickKeys); // deselect
      if (noEffect >= 2) {
        console.warn("Nothing was removed twice in a row - Instagram is silently ignoring the action (usually throttling). Stopped. Wait 30-60+ min.");
        break;
      }
      await sleep(rnd(BACKOFF_MIN, BACKOFF_MAX));
      continue;
    }
    noEffect = 0;
    if (left) console.warn(`${left} of ${sel} selected ${PAGE.noun} are still on the page - counting only the ${gone} that went.`);

    total += gone;
    cycle++;
    console.log(`Cycle ${cycle}: ${PAGE.done} ${gone} | total ${total}/${MAX_TOTAL}`);

    if (loadMore429) {
      // pagination got throttled; the actions went through, but Instagram is
      // telling us to slow down - back off once, stop if it keeps happening
      loadMore429 = false;
      errorStreak++;
      if (MAX_RETRIES >= 0 && errorStreak > MAX_RETRIES) {
        console.warn(`HTTP 429 on 'load more' again (${errorStreak}x) - Instagram keeps throttling. Stopping. Wait 30-60+ min before running again.`);
        break;
      }
      const back = rnd(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`HTTP 429 registered on 'load more' (retry ${errorStreak}/${RETRY_LIMIT}) - backing off ~${Math.round(back / 1000)}s before continuing.`);
      await sleep(back);
      continue;
    }
    errorStreak = 0;
    if (total >= MAX_TOTAL) break; // limit reached - no point pausing first

    // vary the pause; now and then take a longer break like a human would
    const base = Math.random() < LONG_BREAK ? rnd(MAX_PAUSE, MAX_PAUSE + 40000) : rnd(MIN_PAUSE, MAX_PAUSE);
    const pause = Math.max(DIALOG_AFTER, base - dialogSpent); // dialog time already was a pause
    if (dialogSpent) console.log(`Pause ${Math.round(pause / 1000)}s (${Math.round(base / 1000)}s minus the ${Math.round(dialogSpent / 1000)}s already spent on the error dialog, never below ${DIALOG_AFTER / 1000}s).`);
    dialogSpent = 0;
    await sleep(pause);
  }

  window.fetch = __origFetch;
  console.log(`%cStopped. ${PAGE.done[0].toUpperCase() + PAGE.done.slice(1)} ${total} ${PAGE.noun} in ${cycle} cycles.`, "color:lime;font-weight:bold");
