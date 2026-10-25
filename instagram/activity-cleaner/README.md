# instagram-activity-cleaner

Remove your own Instagram likes, comments, reposts, and story replies in bulk
from the browser console. No login details, no external server, no extension.
The scripts click Instagram's own "Select", "Unlike", and "Delete" buttons for
you.

## Read this first

- **Do not run code you have not read.** Anyone can hide anything in a console
  script. Read every line before you paste it. That includes the scripts here.
- These scripts run in your own logged-in browser. A malicious script in the
  same place could read your session. So check what you paste, every time.
- Unliking cannot be undone automatically.
- Automating actions can trigger Instagram rate limits ("action blocked").
  Go slow. See [Limits](#limits).
- Your account, your risk. See [SECURITY.md](SECURITY.md).

## Where in Instagram

Log in on desktop Chrome, then open the likes page:

```
https://www.instagram.com/your_activity/interactions/likes
```

You can also reach it in the app/site menu:
Profile menu → **Your activity** → **Interactions** → **Likes**.

Comments, reposts, and story replies are on their own pages:
`https://www.instagram.com/your_activity/interactions/comments`
`https://www.instagram.com/your_activity/interactions/reposts`
`https://www.instagram.com/your_activity/interactions/story_replies`
(Profile menu → **Your activity** → **Interactions** → **Comments** / **Reposts** / **Story replies**).

## How to run

1. Open the likes page above while logged in.
2. Open DevTools: `F12` → **Console** tab.
3. If pasting is blocked, type `allow pasting`, press Enter, then paste.
4. Run the scripts in order. Each one tells you what to run next.

The scripts assume your Instagram UI is in **English** (labels `Select` and
`Unlike`). Other languages need the labels changed in the code.

## Scripts

Each type has its own folder at the top of this folder. Open the matching page (see
above) before running a group, and run the files in number order.

**Likes** — [`likes/`](likes/) — page `.../interactions/likes`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose.js` | Checks the selectors match the current UI | no |
| `2-check-select-mode.js` | Turns on selection mode, counts likes | no |
| `3-test-flow-likes.js` | Selects 3, checks every step up to Unlike, deselects | no |
| `4-bulk-unlike.js` | Loops and removes likes in batches | yes |

**Comments** — [`comments/`](comments/) — page `.../interactions/comments`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-comments.js` | Turns on selection mode, checks selectors | no |
| `2-test-flow-comments.js` | Selects 3, checks every step up to Delete, deselects | no |
| `3-bulk-delete-comments.js` | Loops and deletes comments in batches | yes |

**Reposts** — [`reposts/`](reposts/) — page `.../interactions/reposts`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-reposts.js` | Turns on selection mode, checks selectors | no |
| `2-test-flow-reposts.js` | Selects 3, checks every step up to Delete, deselects | no |
| `3-bulk-remove-reposts.js` | Loops and removes reposts in batches (dry run first) | yes |
| `4-unrepost-via-viewer.js` | **Recommended.** Un-reposts through the profile viewer | yes |

For reposts, use `4-unrepost-via-viewer.js` — the bulk list (`1`-`3`) deletes
unreliably. See [`reposts/NOTES.md`](reposts/NOTES.md).

**Story replies** — [`story_replies/`](story_replies/) — page `.../interactions/story_replies`

| File | What it does | Deletes? |
|------|--------------|----------|
| `1-diagnose-story-replies.js` | Turns on selection mode, checks selectors | no |
| `2-test-flow-story-replies.js` | Selects 3, checks every step up to Delete, deselects | no |
| `3-bulk-delete-story-replies.js` | Loops and deletes story replies in batches | yes |

Comments, reposts, and story replies all use the same delete flow (Select →
pick → Delete → confirm), so those three groups are near-identical; only likes
differ (they use "Unlike").

Doing the diagnose and test-flow first is how you find out whether it still
works before you delete anything. The test-flow scripts never delete: they
run every step up to the delete button, find it without clicking it, and
clear the selection. If any line says FAIL, do not run the bulk script. Instagram changes its markup, so
the selectors can break; the diagnose step tells you early.

Each page uses slightly different controls, so the three groups are not
interchangeable.

### Reposts: known Instagram issue

The reposts bulk list (scripts `1`–`3`) deletes unreliably on Instagram's
side: it often shows a "deleted" toast but leaves the repost in place. This
happens **when you delete by hand too**, so it is not caused by these scripts
— and no sort order or setting fixes it. Use the workaround instead:
`4-unrepost-via-viewer.js` removes reposts one by one through the profile
viewer and works reliably. Details in [`reposts/NOTES.md`](reposts/NOTES.md).

## Bulk script

### Dry run (on by default)

Every bulk script (likes, comments, story replies, and both reposts scripts)
starts with `DRY_RUN = true`. In a dry run the likes, comments and story
replies scripts first scroll through the list and count what is there (up to
`SCAN_LIMIT`, 1000 by default), then print how many a real run would remove
(capped by `MAX_TOTAL`). Then they select one batch, print what it would
remove, clear the selection, and stop.
**Nothing is deleted.** Check the output, then set `DRY_RUN = false` at the top
of the script and run it again to delete for real.

```js
const DRY_RUN = true;   // false = actually delete
```

The reposts viewer script (`reposts/4-unrepost-via-viewer.js`) works the same
way: it walks through your reposts, reports each one it would un-repost, and
changes nothing.

### For contributors

The likes, comments, and story replies bulk scripts are generated from a shared
engine in [`src/`](src/). Edit `src/`, then run `npm run build` from the repo
root. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Settings

The bulk scripts share the same settings at the top. The batch size is
randomized each cycle and the scripts occasionally skip an item or take a
longer pause, so the pattern looks less automated:

```js
const BATCH_MIN   = 20;     // fewest selected per cycle (randomized)
const BATCH_MAX   = 30;     // most selected per cycle (randomized)
const MAX_BATCH   = 100;    // hard cap per cycle (see below)
const SKIP_CHANCE = 0.12;   // chance to skip an item this pass (picked up later)
const CLICK_MIN   = 250;    // pause between selection clicks (ms) - selecting sends no request
const CLICK_MAX   = 600;
const MAX_TOTAL   = 100000; // stop after this many this session (effectively all)
const MIN_PAUSE   = 15000;  // min pause between cycles (ms)
const MAX_PAUSE   = 22000;  // max pause between cycles (ms)
const LONG_BREAK  = 0.1;    // chance of a longer human-like pause between cycles
const SELECT_RETRIES = 3;   // re-checks before concluding the list is empty
const SELECT_PAUSES = [5000, 8000, 12000]; // escalating waits between re-checks (ms)
const SORT_ORDER  = "auto"; // "auto" keeps what you set, "newest" / "oldest" force one
const SCAN_LIMIT  = 1000;   // dry run: count at most this many (each scroll is a request)
const MAX_RETRIES = 1;      // backoff-and-retries on a 429 before stopping (see Limits)
const RECOVER_500 = 1;      // in-place restore attempts after a 500 breaks the page (see Limits)
const EMPTY_RECOVERIES = 3; // restore attempts when the list vanishes with no failed request
```

These are production values: one run removes everything at roughly 2,500
items an hour (likes validated on a real account, 2026-10-25). Each cycle is
one request no matter how many items it holds, so bigger batches go faster
without hitting Instagram more often. The reposts scripts use the same
values; the viewer script (`4-unrepost-via-viewer.js`) goes one by one with
`MAX = 100000`.
Leave `MAX_RETRIES` and `RECOVER_500` at 1 - setting them to -1 keeps
sending actions after Instagram has told you to stop, which is how an
account gets an action block (typically 24-48h, longer if it repeats).

After every delete the script checks that the selected items actually left
the page, and counts only those. If Instagram accepts a delete but removes
nothing twice in a row (it does this when it throttles silently), the script
stops.

Skipped items are not lost — they stay unselected and get picked up in a later
cycle.

**The sort order stays where you put it.** Instagram resets the list to its
default *Newest to oldest* on every re-render — a reload, a tab switch, or the
script's own recovery. With `SORT_ORDER = "auto"` the script reads whichever
order is set when you start and puts that back whenever the page drops it. Set
`"newest"` or `"oldest"` to force one instead; the script applies it before the
first delete. If it cannot set the order twice in a row, it stops trying and
carries on with whatever the page shows.

**Slow reloads are not mistaken for "done."** After a bigger delete the page
can take a while to re-render. If the list looks empty, the script re-checks
`SELECT_RETRIES` times with the escalating `SELECT_PAUSES` waits (5s/8s/12s;
extra retries reuse the last value) before it concludes there is nothing left.

**Batch size is capped at ~100.** The page only keeps ~25 rows in the DOM, so
the scripts scroll to load more until the batch is full. But Instagram's own
multi-select only allows about **100 at once** — past that it starts
deselecting, and asking it to unlike/delete a too-large batch can return an
HTTP 500 and leave the page stuck (you then have to reload and start the run
again). `MAX_BATCH = 100` keeps you under that. If you still hit 500s or a stuck
page, lower `BATCH_MAX`.

- **Start:** paste and press Enter.
- **Stop:** type `window.__STOP__ = true` and press Enter. It stops after the
  current cycle.
- Keep the tab visible. Background tabs get throttled and the timers slow down.

## Limits

Instagram limits how many actions you can do in a day. There is no official
number and it depends on the account.

- Start with a dry run, then one small real batch (`MAX_TOTAL = 6`) before a full run.
- On a main account with thousands of items, consider a few sessions spread over a day or two.
- If you see "action blocked" or "try again later", stop and wait 24-48h.
  The bulk script stops on its own if it detects that message.

**HTTP 500 / 429 = rate limiting.** After a burst (often ~100-150 actions in a
short run, regardless of batch size) Instagram starts throttling. This is not a
bug in the script. The bulk scripts watch Instagram's requests and handle the
two cases differently:

- **`500` on the unlike/delete request** — the page usually breaks here
  (endless spinner). A reload would kill the script, so it waits 60-100s and
  then switches to another tab and back, which makes Instagram re-render the
  list in place, and continues (`RECOVER_500 = 1` attempt). If the page does
  not come back, it **stops** with a clear message instead of pretending the
  list is empty — then reload and wait 30-60+ minutes before running again.
- **`429 Too Many Requests`** (on the action or on the "load more" pagination) —
  the script registers it, prints a warning, **backs off 1-2 minutes and
  retries once** (`MAX_RETRIES = 1`). If the 429 comes right back, it stops.
  Set `MAX_RETRIES = 0` to stop on the very first 429 instead.

A 429 is handled and cleared before the backoff, so if the page then drops the
list during that wait, no error is pending any more and nothing looks broken —
the run would just end early. The scripts therefore try the same tab switch
whenever the list vanishes without a failed request (`EMPTY_RECOVERIES = 3`).
Both recovery budgets count *failed* attempts: a tab switch that brings the
list back does not spend one, so a long run is not ended by its second
unrelated error.

You can raise `MAX_RETRIES` and `RECOVER_500` to ride out longer throttles, or
set either to `-1` to retry **forever** (the script then never stops for that
error class on its own). **Be careful:** that means sending actions after
Instagram already told you to slow down, which is aggressive and can get your
account temporarily blocked — especially `-1`, where only `window.__STOP__ =
true` or a real block ends the run. Leave both at 1 unless you accept that
risk. Smaller sessions and longer pauses make throttling happen less in the
first place.

## Credits

The core of this project (how to find and click Instagram's Select / Unlike /
Delete buttons) is derived from Chidi's work:

- [iamceeso/instagram-bulk-likes-remover](https://github.com/iamceeso/instagram-bulk-likes-remover)
- [iamceeso/instagram-bulk-comment-deleter](https://github.com/iamceeso/instagram-bulk-comment-deleter)

This repo adds read-only checks, a small test step, a session limit,
action-block detection, the reposts support (worked out separately, since the
reposts confirm is a React popup that needs a leaf-level click), and the docs.

## License

MIT. See [LICENSE](LICENSE).
