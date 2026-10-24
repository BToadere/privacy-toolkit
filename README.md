# privacy-toolkit

Tools and guides to reduce your digital footprint: remove your activity from
platforms, export your data, and delete accounts you no longer use.

## Principles

- **No credentials.** Tools run in your own logged-in browser. Nothing asks for
  your password, and nothing talks to a third-party server.
- **Read before you run.** Every script is short and plain. Read it first.
- **Slow and safe.** Platforms rate-limit automated actions. The defaults are
  deliberately conservative.
- **Your account, your risk.** See each tool's `SECURITY.md`.

## Tools

| Platform | Tool | What it does |
|----------|------|--------------|
| Instagram | [activity-cleaner](instagram/activity-cleaner/) | Bulk-remove your likes, comments, reposts, and story replies |
| Instagram | [account-deletion](instagram/account-deletion.md) | Export your data and delete the account for good |

## Using a single tool

You do not need to clone the whole repo. Each tool's README is self-contained:
open a script on GitHub, click **Copy raw file**, and paste it where the README
says. To download only one folder:

```sh
git clone --filter=blob:none --sparse https://github.com/BToadere/privacy-toolkit
cd privacy-toolkit
git sparse-checkout set instagram
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases with one zip per tool are on the
[Releases](https://github.com/BToadere/privacy-toolkit/releases) page.

## Credits

`instagram/activity-cleaner` is based on
[dodosack/instagram-activity-cleaner](https://github.com/dodosack/instagram-activity-cleaner)
(MIT), imported with its full history. See [UPSTREAM.md](UPSTREAM.md).

## License

MIT. See [LICENSE](LICENSE). Imported code keeps its original license.
