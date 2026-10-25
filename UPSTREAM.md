# Upstream sources

| Path | Upstream | License |
|------|----------|---------|
| `instagram/activity-cleaner/` | https://github.com/dodosack/instagram-activity-cleaner | MIT |

The upstream history was imported with `git subtree`, so every original commit
and its author are preserved here.

## We have diverged

Since the import, `activity-cleaner` changed its layout:

- the `scripts/` level is gone (`scripts/likes/` is now `likes/`, and so on);
- the four Select-mode bulk scripts (likes, comments, story replies, reposts) are generated from one shared engine
  (`src/bulk-engine.js`) plus a small per-page template (`src/*.bulk.js`);
- every bulk script has a `DRY_RUN` mode, on by default.

Because of that, `git subtree pull` no longer applies cleanly. Port upstream
fixes by hand instead:

```sh
git fetch https://github.com/dodosack/instagram-activity-cleaner.git main
git log --oneline <last-ported-commit>..FETCH_HEAD   # see what is new
git show <commit>                                   # apply the idea to src/, then npm run build
```

Last upstream commit included: `49b1f77` (2026-07-27).

Fixes that also make sense upstream should be sent back as pull requests.
