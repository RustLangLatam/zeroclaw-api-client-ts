# AGENTS.md - ZeroClaw API client for TypeScript

Core instructions for coding assistants working in this repository. Read `docs/book/src/contributing/architecture.md` before a non-trivial change.

## Single Source Of Truth

The gateway is the source of truth for every request and response shape. This SDK mirrors the router of the ZeroClaw build it targets (`crates/zeroclaw-gateway/src/lib.rs` in ZeroClaw) and never invents fields:

1. Before adding or changing a type, find the gateway handler and the struct (or `json!` literal) it serializes, and name it in the module comment.
2. Shapes the gateway builds ad hoc, or that change with configuration (config sections, SOP definitions, catalogs), stay `unknown` instead of guessed interfaces.
3. Optional and newer fields are optional in the interface, so an older or newer gateway still fits.
4. A route enters the client only once official ZeroClaw has it, or at least a pull request in zeroclaw-labs/zeroclaw adds it. Routes only a fork has stay out of `main` and its releases.

## Safety And Privacy

- Never commit secrets, tokens, credentials, personal data, or real identities. Tests use invented tokens and hosts.
- The bearer token never appears in `String(client)`, JSON, errors, or URLs (on the WebSocket it travels in `Sec-WebSocket-Protocol`).
- A library never prints, logs, or starts work that outlives a call: it throws typed errors (`ZeroClawError` subclasses) and leaves streams to the caller.
- Do not keep unused production code; remove it or use it.

## Working Rules

1. Read the owning module, its tests, and the matching gateway handler before editing.
2. One resource group per module (`cron.ts`, `config.ts`, …), reached from a `Client` property; path segments are passed as an array to `Client._json`/`_field`/`_empty`, never formatted into a string, so ids are always encoded.
3. Keep one concern per PR. Avoid unrelated cleanup and do not mix broad formatting changes with functional changes.
4. No runtime dependencies ([ADR-003](docs/book/src/architecture/decisions/ADR-003-web-platform-no-dependencies.md)); use web platform APIs that browsers, Node, Deno and Bun share. A new dev dependency needs a reason in the PR.
5. Every endpoint gets a case in `tests/endpoints.test.ts` (method, path, query, body, result). Logic gets table-driven tests. New response types get a captured vector in `tests/vectors/` and a line in `tests/vectors.test.ts`.
6. Work on a non-`main` branch (`feat/*`, `fix/*`, `docs/*`), open a PR to `main`, and never push directly to `main`. Releases are tagged `vX.Y.Z` from `main`; the release workflow publishes to npm.
7. Use conventional commits. Commits are authored by the repository owner; do not add bot or assistant attribution footers or files.
8. Name no application, company or deployment that uses the client: not in code, docs, test vectors, commits or PRs. Say "an application".

## User-Facing Text

- Code, comments, errors, and documentation are in English.
- English Markdown under `docs/book/` is the documentation source of truth; TSDoc comments cover each public name.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
python3 scripts/endpoint-map.py --check
python3 scripts/route-drift.py
```

Docs changes also build the book: `mdbook build docs/book`.
