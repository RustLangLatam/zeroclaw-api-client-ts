# Contributing to zeroclaw-api-client-ts

Thanks for your interest. Every kind of contribution helps: code, docs, bug
reports and reports of gateway changes the client does not follow yet.

All PRs target **`main`**; never push to it directly.

1. **Find the gateway side.** Every change starts from the ZeroClaw build the
   client targets ([Compatibility](docs/book/src/reference/compatibility.md)):
   the route in `crates/zeroclaw-gateway/src/lib.rs` and its handler.
2. **Branch.** `feat/*`, `fix/*` or `docs/*` from `main`.
3. **Change, test, document.** Follow [AGENTS.md](AGENTS.md) and the
   step-by-step guide in
   [docs/book/src/contributing/architecture.md](docs/book/src/contributing/architecture.md).
4. **Open the PR** with the template filled in and conventional commit titles
   (`feat: …`, `fix: …`, `docs: …`). Commits are authored by the repository
   owner. Name no application or company that uses the client. Add what
   changed for users to `CHANGELOG-next.md`.

## Setup

```sh
npm ci
```

## Checks

```sh
npm run lint        # npm run format fixes what it can
npm run typecheck
npm test
npm run build
python3 scripts/endpoint-map.py --check
python3 scripts/route-drift.py
mdbook build docs/book
```

Against a running gateway, the read-only live test checks that every read
answers:

```sh
ZEROCLAW_URL=http://127.0.0.1:42617 ZEROCLAW_TOKEN=zc_… npm test
```
