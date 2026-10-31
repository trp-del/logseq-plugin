# Logseq Plugin

## Releasing

Never use GitHub Actions for this repository: no workflows, no `.github/workflows`, for releases or anything else.

Logseq's **Install plugin from GitHub release** reads the repository's latest GitHub release and takes the first `.zip`
attached to it, so a release is built and published by hand: raise the version in `package.json`, `sh tools/release.sh`,
commit, tag `v<version>`, push, and attach `dist/logseq-plugin-v<version>.zip` to a release of that tag.
