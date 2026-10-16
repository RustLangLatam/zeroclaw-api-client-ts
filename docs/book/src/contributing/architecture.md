# Contributing

Read [`AGENTS.md`](https://github.com/RustLangLatam/zeroclaw-api-client-ts/blob/main/AGENTS.md)
first: it holds the rules every change follows. This page explains the most
common change, covering a gateway route.

## Adding or changing an endpoint

1. **Find the handler.** In the ZeroClaw build listed in
   [Compatibility](../reference/compatibility.md), find the route in
   `crates/zeroclaw-gateway/src/lib.rs` and read its handler: auth, query,
   body, every status it answers, and the struct or `json!` it returns. A
   route enters the client only once official ZeroClaw has it, or a pull
   request there adds it.
2. **Pick the module.** Routes belong to the module of their area
   (`config.ts`, `channels.ts`, …). A new area gets a new module, a class
   holding the client, a property on `Client` and an export in `index.ts`.
3. **Write the method.** It is `async`, and its doc comment opens with the
   route (`` /** `POST /api/cron/{id}/run`: runs a job now and waits for it. */ ``).
   Pass the path as an array of segments to `this.#c._json` (or `_field`,
   `_text`, `_empty`), never a formatted string. Unwrap single-field
   envelopes with `_field` (`{"jobs": […]}` returns `CronJob[]`).
4. **Write the types.** Mirror the gateway's fields in an interface; mark
   anything optional or newer optional; type dynamic shapes `unknown`
   ([ADR-002](../architecture/decisions/ADR-002-dynamic-shapes-stay-json.md)).
5. **Test it.** Add a case to `tests/endpoints.test.ts` (method, path,
   query, body, answer, result). For a new response type, add a captured
   vector (see [Testing](./testing.md)).
6. **Update the docs.** Regenerate the [endpoint map](../reference/endpoints.md)
   with `python3 scripts/endpoint-map.py --write` (CI fails while it is
   stale), and update the guide of the area. `python3 scripts/route-drift.py`
   then shows any gateway route still uncovered (CI runs it). For a new
   gateway build, pass its checkout to refresh `scripts/gateway-routes.txt`
   and commit the list with the client change.

## Checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
python3 scripts/endpoint-map.py --check
python3 scripts/route-drift.py
mdbook build docs/book
```

`npm run format` fixes formatting and the lint findings it can. CI runs the
tests on Node 20, 22 and 24.

## Branches and pull requests

Branch from `main` (`feat/*`, `fix/*`, `docs/*`) and open a PR with the
template filled in; never push to `main` directly. Use conventional
commits. Releases are tagged `vX.Y.Z` from `main` (the tag must match
`package.json`'s version and `src/version.ts`); the release workflow builds
the package and publishes it to npm with provenance, and
`CHANGELOG-next.md` becomes the release notes.
