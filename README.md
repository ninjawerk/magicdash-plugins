# MagicDash plugin catalog

`index.json` is the community plugin index that [MagicDash](https://github.com/ninjawerk/magicdash) dashboards download
(*Edit → Add → Browse & install plugins…*) and search locally. Plugins live in their authors' own repositories; this
repo only lists them.

## Trust model — read this

- **Installing a plugin runs its code on the user's device** with the dashboard's permissions.
- Every entry is pinned to a **release asset URL and its SHA-256**. The dashboard verifies the checksum before installing,
  and CI verifies that the zip's manifest matches the entry (id, version, sdkVersion).
- `"reviewed": true` means a maintainer of this repo has **read that exact version's code**. Contributors must leave it
  unset; maintainers set it after review. New versions reset to unreviewed until re-read.
- Unreviewed entries are shown in dashboards with an **"unreviewed"** warning and a confirmation step. We list them on the
  author's word alone — that is what "unreviewed" means, and dashboards say so.

## Adding or updating a plugin

1. Your plugin repo: tag a release and attach `<id>-<version>.zip` (from `npm run pack-plugin <id>` in a MagicDash checkout,
   or any zip whose top-level folder is the plugin). Optional: copy `.github/workflows/release.yml` from
   [magicdash-countdown](https://github.com/ninjawerk/magicdash-countdown) to do this on tag.
2. Open a PR adding/updating your entry in `index.json`:

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "description": "One or two sentences.",
  "author": "your-github-name",
  "repo": "you/magicdash-my-plugin",
  "version": "1.0.0",
  "download": "https://github.com/you/magicdash-my-plugin/releases/download/v1.0.0/my-plugin-1.0.0.zip",
  "sha256": "<sha256sum of that zip>",
  "sdkVersion": 1,
  "minHost": "0.1.0",
  "tags": ["weather"],
  "screenshot": "https://…/screenshot.png"
}
```

3. CI validates the schema, downloads the zip, checks the SHA and the manifest. Fix anything it flags.

Rules:
- **Ids are first come, first served** and must be kebab-case. Ids of bundled MagicDash plugins are reserved
  (see `RESERVED` in `validate.mjs`).
- `download` must be `https` and should be a GitHub release asset (immutable). Never point at a branch.
- Declare `sdkVersion` (SDK major you built against) and `minHost` so dashboards that can't run your plugin hide it.
- Keep `description` under 300 characters and plain.

Run `node validate.mjs --only my-plugin` locally before opening the PR.

## Using another index

Dashboards can add more sources under *Browse → Sources* — a gist, a company server, anything that serves this JSON
shape. The first configured source wins when two list the same id.
