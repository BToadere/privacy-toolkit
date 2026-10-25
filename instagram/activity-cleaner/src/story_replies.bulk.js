/*
 * Step 3 (story replies) - Bulk delete (loops until the session limit or none left)
 *
 * WARNING: this deletes real data and cannot be undone. Read the code before
 * you run it. Do not run scripts you have not read.
 *
 * Same flow as the comments scripts (Select -> pick items -> Delete -> confirm).
 *
 * Run on: https://www.instagram.com/your_activity/interactions/story_replies
 *
 * Start:  paste and press Enter.
 * Stop:   type   window.__STOP__ = true   and press Enter.
 *         It stops after the current cycle.
 *
 * Keep the tab visible. Background tabs get throttled by the browser
 * and the timers slow down.
 */
(async function bulkDeleteStoryReplies() {
  // ===== settings =====
  const DRY_RUN     = true;   // true = select one batch, list it, deselect, and stop. Nothing is deleted.
                              // Set to false only after you checked the dry-run output.
  const SCAN_LIMIT  = 1000;   // dry run: count at most this many before reporting (each scroll is a request)
  const BATCH_MIN   = 20;     // fewest items selected per cycle (randomized)
  const BATCH_MAX   = 30;     // most items selected per cycle (randomized)
  const MAX_BATCH   = 100;    // hard cap - Instagram deselects past ~100 per action (and can 500)
  const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
  const CLICK_MIN   = 250;    // pause between selection clicks (ms). Selecting is local to
  const CLICK_MAX   = 600;    // the page - no request is sent until the action itself
  const MAX_TOTAL   = 100000; // stop after this many this session - effectively 'all'; the error checks below stop the run if Instagram pushes back
  const MIN_PAUSE   = 15000;  // min pause between cycles (ms)
  const MAX_PAUSE   = 22000;  // max pause between cycles (ms)
  const LONG_BREAK  = 0.1;    // chance of a longer human-like pause between cycles
  const SELECT_RETRIES = 3;   // if the list looks empty, re-check this many times (page reloads slowly after big deletes)
  const SELECT_PAUSES = [5000, 8000, 12000]; // escalating waits (ms) between those re-checks; extra retries reuse the last value
  const SORT_ORDER = "auto";  // "auto" = keep whatever the page is set to when you start;
                              // "newest" / "oldest" = force that order and put it back
                              // whenever the page resets it (every re-render does)
  const MAX_RETRIES = 1;      // backoff-and-retry this many times on a 429 before stopping; 0 = stop on the first 429, -1 = retry forever
  const BACKOFF_MIN = 60000;  // wait at least this long after a 429 (ms)
  const BACKOFF_MAX = 120000; // wait at most this long after a 429 (ms)
  const RECOVER_500  = 1;      // after a 500 breaks the page, try to restore it in place this many times (0 = stop immediately, -1 = keep trying forever)
  const RECOVER_MIN  = 60000;  // wait at least this long before the restore attempt (ms)
  const RECOVER_MAX  = 100000; // wait at most this long before the restore attempt (ms)
  const EMPTY_RECOVERIES = 3;  // if the list vanishes with NO failed request (what a 429 leaves
                               // behind), try the same tab switch this many times; -1 = keep trying.
                               // Reset as soon as the list is back, so only failures count.
  // A 500 on the real delete action breaks the page - the script tries the
  // in-place tab-switch recovery (RECOVER_500 times), then stops. A 429 (Too
  // Many Requests) gets one backoff-and-retry by default; if it comes back,
  // we stop. -1 on either limit means retry forever and never stop for it.
  // WARNING: raising these keeps sending actions after Instagram already told
  // you to slow down. That is aggressive and can get your account temporarily
  // blocked - especially -1, which never backs out on its own.
  // ====================

  // ===== page-specific selectors and labels =====
  const PAGE = {
    noun: "story replies",
    action: "delete",
    actionLabel: "Delete",
    done: "deleted",
    confirmWait: 1500,
    awayTab: "Likes",
    homeTab: "Story replies",
    // New UI (2026-10-25): a role=button labelled "Delete"; the clickable one
    // is the inner pointer-events: auto copy. Old UI: the bloks TextSpan's
    // pointer-events container.
    findAction: () => document.querySelector('div[role="button"][aria-label="Delete"][style*="pointer-events: auto"]')
      || [...document.querySelectorAll('span[data-bloks-name="bk.components.TextSpan"]')]
        .find(s => s.innerText?.trim() === "Delete")?.closest('div[style*="pointer-events: auto"]'),
  };

  //@engine
})();
