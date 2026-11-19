# Logseq Plugin

## Releasing

Never use GitHub Actions for this repository: no workflows, no `.github/workflows`, for releases or anything else.

Logseq's **Install plugin from GitHub release** reads the repository's latest GitHub release and takes the first `.zip`
attached to it, so a release is built and published by hand: raise the version in `package.json`, `sh tools/release.sh`,
commit, tag `v<version>`, push, and attach `dist/logseq-plugin-v<version>.zip` to a release of that tag. Then run
`sh ~/logseq-value/logseq-plugin/tools/sync-loaded.sh`, which brings the folder the owner's Logseq loads to the
release and reloads the plugin there: the release is not finished until it says so.

Build and release from your own copy (`logseq-value/work/<name>/`), never from `logseq-value/logseq-plugin/`, which only ever
holds the latest release (`logseq-value/CLAUDE.md`).
