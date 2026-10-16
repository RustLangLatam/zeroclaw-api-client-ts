---
id: ADR-004
title: Types describe the wire, nothing validates at run time
date: 2026-10-16
status: accepted
relates-to:
  - tests/vectors.test.ts
---

# ADR-004: Types Describe The Wire, Nothing Validates At Run Time

## Context

The Rust and Python clients decode answers into checked types (serde,
pydantic). A TypeScript client could do the same with a schema library,
at the cost of a dependency and of bundle size in every browser app, or
trust the gateway's JSON and only describe it.

## Decision

Answers are returned as the gateway sent them, typed by interfaces that
describe its JSON (snake_case fields, optional fields marked optional). No
schema library, no conversion. The captured response vectors in
`tests/vectors/` are assigned to those interfaces in `tests/vectors.test.ts`,
so the compiler fails when a type and a real answer disagree.

## Consequences

- Zero cost per call and nothing to install; fields a newer gateway adds
  are there for callers who need them.
- A gateway that changes a field's type is not caught at run time; the
  vectors and the live test catch it when they are refreshed.
- Field names keep the gateway's snake_case, as in the sibling clients;
  method names and options are camelCase.
