# SOPs

Standard operating procedures are step-by-step workflows the agents run,
started by triggers (manual, cron, webhook, channel messages, …). Their
definitions are large and evolve with ZeroClaw, so `client.sops` handles
them as decoded JSON (`unknown`)
([why](../architecture/decisions/ADR-002-dynamic-shapes-stay-json.md)).

- **Authoring:** `list`, `get`, `create`, `save`, `delete`; `graph` returns
  an SOP as a node graph with layout and diagnostics; `graphDraft` and
  `wireDraft` do the same for unsaved edits; `graphLegend` and
  `triggerSources` describe what can be used.
- **Running:** `run(name, payload)` starts one through its manual trigger
  and returns the run id; `runs` lists active and recent runs; `runOverlay`
  shows a run's state per step with its tool calls; `watchRuns` streams run
  changes live (a `Feed`, read with `for await`); `cancel` stops a run at
  its next step boundary.
- **Approvals:** a run can wait for an operator. Answer it with
  `decide(name, runId, Decision.approve())` (or `Decision.deny(reason)`,
  `Decision.amend(text)`, `Decision.revise(guidance)`), or, on the gateway
  host, with `pending`, `approve` and `deny`.

Every SOP route answers 503 while the SOP subsystem is disabled.

## Canvases and the quickstart

`client.canvas` publishes HTML, SVG, Markdown or text frames to a named
canvas, reads them back and streams them live (`watch`, a `Feed`).
`client.quickstart` drives the first-agent setup the dashboard offers:
`state`, `fields`, `validate`, `apply`, `dismiss`.
