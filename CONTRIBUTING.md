# Contributing

All documentation, code comments, and commit messages are in **English**.

## Layout

Each platform has its own folder (`instagram/`, ...), and each tool inside it is
self-contained: its own README, its own scripts, nothing shared across tools.

## Console scripts

Users copy one file and paste it into the browser console, so every script that
ships must be a single, readable file with no imports.

Where scripts share logic, the shared part lives in `src/` and the shipped files
are generated:

```sh
npm run build   # regenerate the scripts from src/
npm run check   # what CI runs: generated files up to date + every script parses
```

Never edit a file that starts with a `GENERATED` notice; edit `src/` instead.
Commit both `src/` and the regenerated output.

## Rules for scripts that delete data

- No network requests of their own, no credentials, no external code.
- Destructive scripts start with `DRY_RUN = true`.
- Stop on doubt. When a selector does not match, log it and stop rather than
  clicking something else.
- Keep the defaults slow. Rate limits are the main risk to the user's account.
