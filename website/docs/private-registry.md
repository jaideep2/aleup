---
sidebar_position: 8
title: Private registry (interim)
---

# Private registry (interim)

Until the license is finalized, `@aleup/*` is not on public npm. Two ways to consume it:

## GitHub Packages (teams/CI)

Publishing `@aleup/*` to GitHub Packages requires the GitHub org **aleup** (scope must
match the repository owner). Once set up:

```ini
# .npmrc in your repo
@aleup:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

`NPM_TOKEN` is a classic PAT with `read:packages`, set in dev shells, CI secrets, and
(for Docker builds) passed as a build arg:

```dockerfile
FROM base AS installer
ARG NPM_TOKEN
ENV NPM_TOKEN=$NPM_TOKEN
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
ENV NPM_TOKEN=""
```

Note pnpm **hard-fails** install when the env var referenced by `.npmrc` is unset —
document it as required setup for your team.

## Local file overrides (single machine)

With an `aleup` checkout next to your repo:

```jsonc
// package.json (root)
"pnpm": {
  "overrides": {
    "@aleup/core": "file:../aleup/packages/core",
    "@aleup/import": "file:../aleup/packages/import"
    // …one per package you use
  }
}
```

Keep real semver ranges (`"@aleup/core": "^0.1.0"`) in your dependencies — the overrides
rewrite them locally, and removing the overrides block is the entire migration to the
registry later. Run `pnpm build` in the aleup checkout after pulling changes (packages
are consumed as built `dist/`).

## Go-public day

Flip each package's `publishConfig` to public npm, add the real LICENSE, publish via
changesets, and delete the `.npmrc` scope lines / overrides from consumers.
