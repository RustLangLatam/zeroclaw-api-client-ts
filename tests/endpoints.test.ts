// Every endpoint at the HTTP boundary: method, path, query, body, and what
// the call returns from the gateway's answer.

import assert from "node:assert/strict";
import { test } from "node:test";
import { announce, type Client, Decision, isNotFound, PatchOps } from "../src/index.js";
import { gateway, json, query } from "./helpers.js";

interface Case {
  call: (c: Client) => Promise<unknown>;
  method: string;
  path: string;
  query?: Record<string, string>;
  /** The JSON body the gateway expects; `undefined` for none. */
  body?: unknown;
  headers?: Record<string, string>;
  /** The gateway's answer (JSON); `{}` when unset. */
  reply?: unknown;
  /** What the call returns; checked when set. */
  result?: unknown;
}

const job = { id: "j1", job_type: "shell" };
const frame = { frame_id: "f", content_type: "text", content: "hi", timestamp: "t" };

const CASES: Case[] = [
  // agents
  {
    call: (c) => c.agent("helper").listFiles("notes"),
    method: "GET",
    path: "/api/agents/helper/workspace/list",
    query: { path: "notes" },
    reply: { path: "notes", entries: [] },
    result: { path: "notes", entries: [] },
  },
  {
    call: (c) => c.agent("helper").readFile("a b.txt"),
    method: "GET",
    path: "/api/agents/helper/workspace/read",
    query: { path: "a b.txt" },
  },
  {
    call: (c) => c.agent("helper").makeDir("d"),
    method: "POST",
    path: "/api/agents/helper/workspace/mkdir",
    body: { path: "d" },
  },
  {
    call: (c) => c.agent("helper").movePath("a", "b"),
    method: "POST",
    path: "/api/agents/helper/workspace/move",
    body: { from: "a", to: "b" },
  },
  {
    call: (c) => c.agent("helper").removePath("a"),
    method: "DELETE",
    path: "/api/agents/helper/workspace/path",
    body: { path: "a" },
  },
  {
    call: (c) => c.agent("helper").personalityFiles(),
    method: "GET",
    path: "/api/personality",
    query: { agent: "helper" },
  },
  {
    call: (c) => c.agent("helper").personality("SOUL.md"),
    method: "GET",
    path: "/api/personality/SOUL.md",
    query: { agent: "helper" },
  },
  {
    call: (c) => c.agent("helper").writePersonality("SOUL.md", "be kind", 42),
    method: "PUT",
    path: "/api/personality/SOUL.md",
    query: { agent: "helper" },
    body: { content: "be kind", expected_mtime_ms: 42 },
  },
  {
    call: (c) => c.agent("helper").writePersonality("SOUL.md", "x"),
    method: "PUT",
    path: "/api/personality/SOUL.md",
    query: { agent: "helper" },
    body: { content: "x", expected_mtime_ms: null },
  },
  {
    call: (c) => c.agent("helper").personalityTemplates({ user_name: "Ana", include_memory: true }),
    method: "GET",
    path: "/api/personality/templates",
    query: { agent: "helper", user_name: "Ana", include_memory: "true" },
  },
  {
    call: (c) => c.agent("helper").skills(),
    method: "GET",
    path: "/api/agents/helper/skills",
  },
  // canvas
  {
    call: (c) => c.canvas.list(),
    method: "GET",
    path: "/api/canvas",
    reply: { canvases: ["a"] },
    result: ["a"],
  },
  {
    call: (c) => c.canvas.current("a"),
    method: "GET",
    path: "/api/canvas/a",
    reply: { frame },
    result: frame,
  },
  {
    call: (c) => c.canvas.publish("a", "text", "hi"),
    method: "POST",
    path: "/api/canvas/a",
    body: { content_type: "text", content: "hi" },
    reply: { frame },
    result: frame,
  },
  {
    call: (c) => c.canvas.history("a"),
    method: "GET",
    path: "/api/canvas/a/history",
    reply: { frames: [frame] },
    result: [frame],
  },
  { call: (c) => c.canvas.clear("a"), method: "DELETE", path: "/api/canvas/a" },
  // channels
  {
    call: (c) => c.channels.list(),
    method: "GET",
    path: "/api/channels",
    reply: { channels: [] },
    result: [],
  },
  {
    call: (c) => c.channels.bind("telegram", "bot", "42"),
    method: "POST",
    path: "/api/channels/bind",
    body: { channel_type: "telegram", alias: "bot", identity: "42" },
  },
  {
    call: (c) => c.channels.relink("whatsapp.main"),
    method: "POST",
    path: "/api/channels/whatsapp.main/relink",
  },
  {
    call: (c) => c.channels.send("whatsapp.main", "+34600000000", "Hola"),
    method: "POST",
    path: "/api/channels/whatsapp.main/send",
    body: { to: "+34600000000", content: "Hola", thread_id: null },
  },
  {
    call: (c) => c.channels.redeliver("email.box", "a@b.example"),
    method: "POST",
    path: "/api/channels/email.box/messages/a@b.example/redeliver",
    reply: { channel: "email.box", message_id: "a@b.example", outcome: "redelivered" },
    result: { channel: "email.box", message_id: "a@b.example", outcome: "redelivered" },
  },
  {
    call: (c) => c.channels.rooms("whatsapp.main"),
    method: "GET",
    path: "/api/channels/whatsapp.main/rooms",
    reply: {
      channel: "whatsapp.main",
      rooms: [{ id: "1203@g.us", name: "Team", participants: 3 }],
    },
    result: [{ id: "1203@g.us", name: "Team", participants: 3 }],
  },
  {
    call: (c) => c.channels.createRoom("whatsapp.main", "Team", undefined, ["+34600000000"]),
    method: "POST",
    path: "/api/channels/whatsapp.main/rooms",
    body: { name: "Team", topic: null, invites: ["+34600000000"] },
  },
  {
    call: (c) => c.channels.roomMembers("whatsapp.main", "1203@g.us"),
    method: "GET",
    path: "/api/channels/whatsapp.main/rooms/1203@g.us/members",
    reply: { members: [{ id: "+34600000000", admin: true }] },
    result: [{ id: "+34600000000", admin: true }],
  },
  {
    call: (c) => c.channels.invite("whatsapp.main", "1203@g.us", "+34611111111"),
    method: "POST",
    path: "/api/channels/whatsapp.main/rooms/1203@g.us/invites",
    body: { user: "+34611111111" },
  },
  {
    call: (c) => c.channels.removeMember("whatsapp.main", "1203@g.us", "+34611111111"),
    method: "DELETE",
    path: "/api/channels/whatsapp.main/rooms/1203@g.us/members/+34611111111",
  },
  // config
  { call: (c) => c.config.snapshot(), method: "GET", path: "/api/config" },
  { call: (c) => c.config.schema(), method: "OPTIONS", path: "/api/config" },
  {
    call: (c) => c.config.propSchema("a.b"),
    method: "OPTIONS",
    path: "/api/config/prop",
    query: { path: "a.b" },
  },
  {
    call: (c) => c.config.get("a.b"),
    method: "GET",
    path: "/api/config/prop",
    query: { path: "a.b" },
  },
  {
    call: (c) => c.config.set("a.b", 3, "why"),
    method: "PUT",
    path: "/api/config/prop",
    body: { path: "a.b", value: 3, comment: "why" },
  },
  {
    call: (c) => c.config.set("a.b", null),
    method: "PUT",
    path: "/api/config/prop",
    body: { path: "a.b", value: null },
  },
  {
    call: (c) => c.config.reset("a.b"),
    method: "DELETE",
    path: "/api/config/prop",
    query: { path: "a.b" },
  },
  {
    call: (c) => c.config.patch([PatchOps.replace("a", 1), PatchOps.remove("b")], true),
    method: "PATCH",
    path: "/api/config",
    body: [
      { op: "replace", path: "a", value: 1 },
      { op: "remove", path: "b" },
    ],
    headers: { "x-zeroclaw-override-drift": "true" },
  },
  {
    call: (c) => c.config.list("gateway"),
    method: "GET",
    path: "/api/config/list",
    query: { prefix: "gateway" },
  },
  {
    call: (c) => c.config.drift(),
    method: "GET",
    path: "/api/config/drift",
    reply: { drifted: [] },
    result: [],
  },
  {
    call: (c) => c.config.pendingReload(),
    method: "GET",
    path: "/api/config/reload-status",
    reply: { pending_reload: true },
    result: true,
  },
  {
    call: (c) => c.config.init("agents"),
    method: "POST",
    path: "/api/config/init",
    query: { section: "agents" },
    reply: { initialized: ["agents.x"] },
    result: ["agents.x"],
  },
  { call: (c) => c.config.migrate(), method: "POST", path: "/api/config/migrate" },
  {
    call: (c) => c.config.templates(),
    method: "GET",
    path: "/api/config/templates",
    reply: { templates: [] },
    result: [],
  },
  {
    call: (c) => c.config.mapKeys("agents"),
    method: "GET",
    path: "/api/config/map-keys",
    query: { path: "agents" },
    reply: { keys: ["helper"] },
    result: ["helper"],
  },
  {
    call: (c) => c.config.createMapKey("agents", "helper"),
    method: "POST",
    path: "/api/config/map-key",
    query: { path: "agents", key: "helper" },
  },
  {
    call: (c) => c.config.deleteMapKey("agents", "helper"),
    method: "DELETE",
    path: "/api/config/map-key",
    query: { path: "agents", key: "helper" },
  },
  {
    call: (c) => c.config.deletePlan("agents", "helper"),
    method: "GET",
    path: "/api/config/delete-plan",
    query: { path: "agents", key: "helper" },
  },
  {
    call: (c) => c.config.renameMapKey("agents", "a", "b"),
    method: "POST",
    path: "/api/config/rename-map-key",
    body: { path: "agents", from: "a", to: "b" },
  },
  {
    call: (c) => c.config.refreshContextWindow("openai", "default"),
    method: "POST",
    path: "/api/config/model-providers/openai/default/refresh-context-window",
    reply: { context_window: 128000 },
    result: 128000,
  },
  {
    call: (c) => c.config.aliasValues("agents"),
    method: "GET",
    path: "/api/config/resolve-alias-source",
    query: { source: "agents" },
    reply: { values: ["helper"] },
    result: ["helper"],
  },
  {
    call: (c) => c.config.catalog(),
    method: "GET",
    path: "/api/config/catalog",
    reply: { model_providers: [] },
    result: [],
  },
  {
    call: (c) => c.config.catalogModels("openai"),
    method: "GET",
    path: "/api/config/catalog/models",
    query: { model_provider: "openai" },
  },
  { call: (c) => c.config.status(), method: "GET", path: "/api/config/status" },
  { call: (c) => c.config.agentOptions(), method: "GET", path: "/api/config/agent-options" },
  {
    call: (c) => c.config.sections(),
    method: "GET",
    path: "/api/config/sections",
    reply: { sections: [] },
    result: [],
  },
  {
    call: (c) => c.config.sectionItems("providers.models"),
    method: "GET",
    path: "/api/config/sections/providers.models",
  },
  {
    call: (c) => c.config.selectSectionItem("providers.models", "openai"),
    method: "POST",
    path: "/api/config/sections/providers.models/items/openai",
    body: { alias: null },
  },
  // cost
  {
    call: (c) => c.cost.summary("2026-01-01T00:00:00Z"),
    method: "GET",
    path: "/api/cost",
    query: { from: "2026-01-01T00:00:00Z" },
    reply: { cost: { total_tokens: 3 } },
    result: { total_tokens: 3 },
  },
  {
    call: (c) => c.cost.agent("helper"),
    method: "GET",
    path: "/api/cost",
    query: { agent: "helper" },
    reply: { cost: {} },
  },
  // cron
  {
    call: (c) => c.cron.list(),
    method: "GET",
    path: "/api/cron",
    reply: { jobs: [job] },
    result: [job],
  },
  {
    call: (c) =>
      c.cron.create({
        agent: "helper",
        schedule: "0 9 * * *",
        command: "date",
        delivery: announce("whatsapp.main", "+34600000000"),
      }),
    method: "POST",
    path: "/api/cron",
    body: {
      agent: "helper",
      schedule: "0 9 * * *",
      command: "date",
      delivery: {
        mode: "announce",
        channel: "whatsapp.main",
        to: "+34600000000",
        best_effort: true,
      },
    },
    reply: { job },
    result: job,
  },
  {
    call: (c) => c.cron.update("j1", { enabled: false }),
    method: "PATCH",
    path: "/api/cron/j1",
    body: { enabled: false },
    reply: { job },
    result: job,
  },
  { call: (c) => c.cron.delete("j1"), method: "DELETE", path: "/api/cron/j1" },
  { call: (c) => c.cron.run("j1"), method: "POST", path: "/api/cron/j1/run" },
  {
    call: (c) => c.cron.runs("j1", 5),
    method: "GET",
    path: "/api/cron/j1/runs",
    query: { limit: "5" },
    reply: { runs: [] },
    result: [],
  },
  { call: (c) => c.cron.settings(), method: "GET", path: "/api/cron/settings" },
  {
    call: (c) => c.cron.updateSettings({ enabled: false }),
    method: "PATCH",
    path: "/api/cron/settings",
    body: { enabled: false },
  },
  // events
  {
    call: (c) => c.events.history(),
    method: "GET",
    path: "/api/events/history",
    reply: { events: [{ type: "agent_end" }] },
    result: [{ type: "agent_end" }],
  },
  // files
  { call: (c) => c.files.list(), method: "GET", path: "/api/browse" },
  {
    call: (c) => c.files.makeDir("d"),
    method: "POST",
    path: "/api/browse/mkdir",
    body: { path: "d" },
  },
  {
    call: (c) => c.files.removeDir("d"),
    method: "DELETE",
    path: "/api/browse/rmdir",
    body: { path: "d" },
  },
  // memory
  {
    call: (c) => c.memory.search({ query: "orders", agent: "helper" }),
    method: "GET",
    path: "/api/memory",
    query: { query: "orders", agent: "helper" },
    reply: { entries: [] },
    result: [],
  },
  {
    call: (c) => c.memory.store("k", "v"),
    method: "POST",
    path: "/api/memory",
    body: { key: "k", content: "v", category: null, agent: null },
  },
  {
    call: (c) => c.memory.forget("a/b", "helper"),
    method: "DELETE",
    path: "/api/memory/a%2Fb",
    query: { agent: "helper" },
    reply: { deleted: true },
    result: true,
  },
  // pairing
  {
    call: (c) => c.pairing.pair("123456", "laptop"),
    method: "POST",
    path: "/api/pair",
    body: { code: "123456", device_name: "laptop", device_type: null },
  },
  {
    call: (c) => c.pairing.pairLegacy("123456"),
    method: "POST",
    path: "/pair",
    headers: { "x-pairing-code": "123456" },
  },
  { call: (c) => c.pairing.initialCode(), method: "GET", path: "/pair/code" },
  {
    call: (c) => c.pairing.newCode(),
    method: "POST",
    path: "/api/pairing/initiate",
    reply: { pairing_code: "654321" },
    result: "654321",
  },
  { call: (c) => c.pairing.adminCode(), method: "GET", path: "/admin/paircode" },
  {
    call: (c) => c.pairing.adminNewCode("all"),
    method: "POST",
    path: "/admin/paircode/new",
    query: { rotate: "all" },
  },
  {
    call: (c) => c.pairing.devices(),
    method: "GET",
    path: "/api/devices",
    reply: { devices: [] },
    result: [],
  },
  { call: (c) => c.pairing.revokeDevice("d1"), method: "DELETE", path: "/api/devices/d1" },
  {
    call: (c) => c.pairing.rotateDeviceToken("d1"),
    method: "POST",
    path: "/api/devices/d1/token/rotate",
    reply: { pairing_code: null },
    result: null,
  },
  {
    call: (c) => c.pairing.setCapabilities(["chat"]),
    method: "POST",
    path: "/api/devices/me/capabilities",
    body: { capabilities: ["chat"] },
    reply: { capabilities: ["chat"] },
    result: ["chat"],
  },
  // quickstart
  { call: (c) => c.quickstart.state(), method: "GET", path: "/api/quickstart/state" },
  {
    call: (c) => c.quickstart.fields("channel", "whatsapp"),
    method: "POST",
    path: "/api/quickstart/fields",
    body: { section: "channel", type_key: "whatsapp" },
  },
  {
    call: (c) => c.quickstart.validate({ a: 1 }),
    method: "POST",
    path: "/api/quickstart/validate",
    body: { a: 1 },
  },
  {
    call: (c) => c.quickstart.apply({ a: 1 }),
    method: "POST",
    path: "/api/quickstart/apply",
    body: { a: 1 },
  },
  {
    call: (c) => c.quickstart.dismiss("r1", "web"),
    method: "POST",
    path: "/api/quickstart/dismiss",
    body: { run_id: "r1", surface: "web", last_step: null },
  },
  // sessions
  {
    call: (c) => c.sessions.list(),
    method: "GET",
    path: "/api/sessions",
    reply: { sessions: [] },
    result: [],
  },
  {
    call: (c) => c.sessions.running(),
    method: "GET",
    path: "/api/sessions/running",
    reply: { sessions: [] },
    result: [],
  },
  {
    call: (c) => c.sessions.messages("gw_1"),
    method: "GET",
    path: "/api/sessions/gw_1/messages",
    reply: { messages: [] },
    result: [],
  },
  {
    call: (c) => c.sessions.addMessage("gw_1", "hi"),
    method: "POST",
    path: "/api/sessions/gw_1/messages",
    body: { content: "hi" },
  },
  { call: (c) => c.sessions.state("gw_1"), method: "GET", path: "/api/sessions/gw_1/state" },
  {
    call: (c) => c.sessions.rename("gw_1", "n"),
    method: "PUT",
    path: "/api/sessions/gw_1",
    body: { name: "n" },
  },
  { call: (c) => c.sessions.delete("gw_1"), method: "DELETE", path: "/api/sessions/gw_1" },
  {
    call: (c) => c.sessions.abort("gw_1"),
    method: "POST",
    path: "/api/sessions/gw_1/abort",
    reply: { status: "aborted" },
    result: true,
  },
  // skills
  {
    call: (c) => c.skills.bundles(),
    method: "GET",
    path: "/api/skills/bundles",
    reply: { bundles: [] },
    result: [],
  },
  {
    call: (c) => c.skills.list("main"),
    method: "GET",
    path: "/api/skills/bundles/main/skills",
    reply: { skills: [] },
    result: [],
  },
  {
    call: (c) => c.skills.create("main", "s", { description: "d" }, "body"),
    method: "POST",
    path: "/api/skills/bundles/main/skills",
    body: { name: "s", frontmatter: { description: "d" }, body: "body", no_scaffold: false },
  },
  {
    call: (c) => c.skills.read("main", "s"),
    method: "GET",
    path: "/api/skills/bundles/main/skills/s",
  },
  {
    call: (c) => c.skills.write("main", "s", {}, "b"),
    method: "PUT",
    path: "/api/skills/bundles/main/skills/s",
    body: { frontmatter: {}, body: "b" },
  },
  {
    call: (c) => c.skills.delete("main", "s"),
    method: "DELETE",
    path: "/api/skills/bundles/main/skills/s",
    query: { purge: "false" },
  },
  {
    call: (c) => c.skills.slashOptionKinds(),
    method: "GET",
    path: "/api/skills/slash-option-kinds",
    reply: { kinds: [] },
    result: [],
  },
  // sops
  {
    call: (c) => c.sops.list(),
    method: "GET",
    path: "/api/sops",
    reply: { sops: [] },
    result: [],
  },
  { call: (c) => c.sops.get("s"), method: "GET", path: "/api/sops/s/full" },
  {
    call: (c) => c.sops.create({ name: "s" }),
    method: "POST",
    path: "/api/sops",
    body: { name: "s" },
  },
  {
    call: (c) => c.sops.save("s", { name: "s" }),
    method: "PUT",
    path: "/api/sops/s",
    body: { name: "s" },
  },
  { call: (c) => c.sops.delete("s"), method: "DELETE", path: "/api/sops/s" },
  { call: (c) => c.sops.graph("s"), method: "GET", path: "/api/sops/s/graph" },
  {
    call: (c) => c.sops.graphDraft({ name: "s" }),
    method: "POST",
    path: "/api/sops/graph-draft",
    body: { sop: { name: "s" } },
  },
  {
    call: (c) => c.sops.wireDraft({ name: "s" }, { op: "connect" }),
    method: "POST",
    path: "/api/sops/wire-draft",
    body: { sop: { name: "s" }, edit: { op: "connect" } },
  },
  { call: (c) => c.sops.graphLegend(), method: "GET", path: "/api/sops/graph-legend" },
  { call: (c) => c.sops.triggerSources(), method: "GET", path: "/api/sops/trigger-sources" },
  {
    call: (c) => c.sops.run("s", '{"x":1}'),
    method: "POST",
    path: "/api/sops/s/run",
    body: { payload: '{"x":1}' },
    reply: { run_id: "r1" },
    result: "r1",
  },
  {
    call: (c) => c.sops.runs("s"),
    method: "GET",
    path: "/api/sops/runs",
    query: { sop: "s" },
    reply: { runs: [] },
    result: [],
  },
  { call: (c) => c.sops.runOverlay("s", "r1"), method: "GET", path: "/api/sops/s/runs/r1/overlay" },
  {
    call: (c) => c.sops.decide("s", "r1", Decision.approve()),
    method: "POST",
    path: "/api/sops/s/runs/r1/decide",
    body: "approve",
  },
  {
    call: (c) => c.sops.decide("s", "r1", Decision.deny("no")),
    method: "POST",
    path: "/api/sops/s/runs/r1/decide",
    body: { deny: { reason: "no" } },
  },
  {
    call: (c) => c.sops.decide("s", "r1", Decision.revise("again")),
    method: "POST",
    path: "/api/sops/s/runs/r1/decide",
    body: { revise: { guidance: "again" } },
  },
  {
    call: (c) => c.sops.cancel("s", "r1"),
    method: "POST",
    path: "/api/sops/s/runs/r1/cancel",
    body: { reason: null },
  },
  {
    call: (c) => c.sops.pending(),
    method: "GET",
    path: "/admin/sop/pending",
    reply: { pending: [] },
    result: [],
  },
  {
    call: (c) => c.sops.approve("r1"),
    method: "POST",
    path: "/admin/sop/approve",
    body: { run_id: "r1", reason: null },
    reply: { outcome: "resumed" },
    result: "resumed",
  },
  {
    call: (c) => c.sops.deny("r1", "no"),
    method: "POST",
    path: "/admin/sop/deny",
    body: { run_id: "r1", reason: "no" },
    reply: { outcome: "denied" },
    result: "denied",
  },
  // system
  { call: (c) => c.system.health(), method: "GET", path: "/health" },
  {
    call: (c) => c.system.runtimeHealth(),
    method: "GET",
    path: "/api/health",
    reply: { health: { pid: 1 } },
    result: { pid: 1 },
  },
  {
    call: (c) => c.system.status("helper"),
    method: "GET",
    path: "/api/status",
    query: { agent: "helper" },
  },
  { call: (c) => c.system.doctor(), method: "POST", path: "/api/doctor" },
  {
    call: (c) => c.system.tools(),
    method: "GET",
    path: "/api/tools",
    reply: { tools: [] },
    result: [],
  },
  {
    call: (c) => c.system.toolParamOptions("agent_aliases"),
    method: "POST",
    path: "/api/tools/param-options",
    body: { domain: "agent_aliases", agent: null, args: null },
    reply: { options: [] },
    result: [],
  },
  {
    call: (c) => c.system.integrations(),
    method: "GET",
    path: "/api/integrations",
    reply: { integrations: [] },
    result: [],
  },
  {
    call: (c) => c.system.integrationSettings(),
    method: "GET",
    path: "/api/integrations/settings",
    reply: { settings: {} },
    result: {},
  },
  {
    call: (c) => c.system.cliTools(),
    method: "GET",
    path: "/api/cli-tools",
    reply: { cli_tools: [] },
    result: [],
  },
  {
    call: (c) => c.system.tuis(),
    method: "GET",
    path: "/api/tuis",
    reply: { tuis: [] },
    result: [],
  },
  {
    call: (c) =>
      c.system.logs({ q: "boom", limit: 10, hide_internal: true, attributes: { channel: "x" } }),
    method: "GET",
    path: "/api/logs",
    query: { q: "boom", limit: "10", hide_internal: "true", channel: "x" },
  },
  {
    call: (c) => c.system.versionCheck(true),
    method: "GET",
    path: "/api/version/check",
    query: { force: "true" },
  },
  {
    call: (c) => c.system.upgrade(),
    method: "POST",
    path: "/api/version/upgrade",
    body: { version: null, auto_restart: false },
    reply: { handoff_id: "h1" },
    result: "h1",
  },
  {
    call: (c) => c.system.upgradeStatus("h1"),
    method: "GET",
    path: "/api/version/upgrade/status",
    query: { handoff_id: "h1" },
  },
  { call: (c) => c.system.reload(), method: "POST", path: "/admin/reload" },
  { call: (c) => c.system.shutdown(), method: "POST", path: "/admin/shutdown" },
  { call: (c) => c.system.openapi(), method: "GET", path: "/api/openapi.json" },
  // webauthn
  {
    call: (c) => c.webauthn.registerStart("u", "Ana"),
    method: "POST",
    path: "/api/webauthn/register/start",
    body: { user_id: "u", user_name: "Ana" },
  },
  {
    call: (c) => c.webauthn.registerFinish({ id: "k" }),
    method: "POST",
    path: "/api/webauthn/register/finish",
    body: { id: "k" },
  },
  {
    call: (c) => c.webauthn.authStart("u"),
    method: "POST",
    path: "/api/webauthn/auth/start",
    body: { user_id: "u" },
  },
  {
    call: (c) => c.webauthn.authFinish({ id: "k" }),
    method: "POST",
    path: "/api/webauthn/auth/finish",
    body: { id: "k" },
  },
  {
    call: (c) => c.webauthn.credentials("u"),
    method: "GET",
    path: "/api/webauthn/credentials",
    query: { user_id: "u" },
  },
  {
    call: (c) => c.webauthn.deleteCredential("u", "k"),
    method: "DELETE",
    path: "/api/webauthn/credentials/k",
    query: { user_id: "u" },
  },
  // webhook
  {
    call: (c) => c.webhook.send("hi", { agent: "helper", idempotencyKey: "k1" }),
    method: "POST",
    path: "/webhook",
    query: { agent: "helper" },
    body: { message: "hi" },
    headers: { "x-idempotency-key": "k1" },
    reply: { response: "hello", model: "m" },
    result: { duplicate: false, reply: { response: "hello", model: "m" } },
  },
  {
    call: (c) => c.webhook.send("hi"),
    method: "POST",
    path: "/webhook",
    body: { message: "hi" },
    reply: { status: "duplicate" },
    result: { duplicate: true },
  },
  {
    call: (c) => c.webhook.a2aSend("helper", "hi"),
    method: "POST",
    path: "/a2a/helper",
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "message/send",
      params: { message: { parts: [{ kind: "text", text: "hi" }] } },
    },
    reply: { result: { artifacts: [{ parts: [{ text: "a" }, { kind: "data" }, { text: "b" }] }] } },
    result: "a\nb",
  },
  {
    call: (c) => c.webhook.agentCard("helper"),
    method: "GET",
    path: "/a2a/helper/.well-known/agent-card.json",
  },
  { call: (c) => c.webhook.agentCatalog(), method: "GET", path: "/.well-known/agents-card.json" },
];

for (const c of CASES) {
  test(`${c.method} ${c.path}`, async () => {
    const { client, requests } = gateway(() => json(c.reply ?? {}));
    const result = await c.call(client);
    assert.equal(requests.length, 1);
    const [seen] = requests;
    assert.ok(seen);
    assert.equal(seen.method, c.method);
    assert.equal(seen.url.pathname, c.path);
    assert.deepEqual(query(seen), c.query ?? {});
    assert.equal(seen.headers.get("authorization"), "Bearer zc_test_token");
    if (c.body === undefined) {
      assert.equal(seen.body, undefined);
    } else {
      assert.equal(seen.headers.get("content-type"), "application/json");
      assert.deepEqual(JSON.parse(String(seen.body)), c.body);
    }
    for (const [name, value] of Object.entries(c.headers ?? {})) {
      assert.equal(seen.headers.get(name), value);
    }
    if ("result" in c) assert.deepEqual(result, c.result);
  });
}

test("POST /api/upload sends the image bytes", async () => {
  const { client, requests } = gateway(() => json({ path: "p", marker: "[IMAGE:p]" }));
  const upload = await client.files.uploadImage("helper", new Uint8Array([0x89, 0x50]));
  assert.equal(upload.marker, "[IMAGE:p]");
  const [seen] = requests;
  assert.equal(seen?.url.pathname, "/api/upload");
  assert.deepEqual(query(seen as never), { agent: "helper" });
  assert.equal(seen?.headers.get("content-type"), "application/octet-stream");
  assert.deepEqual(seen?.body, new Uint8Array([0x89, 0x50]));
});

test("GET /metrics returns the exposition text", async () => {
  const { client } = gateway(() => new Response("# HELP up\nup 1\n"));
  assert.equal(await client.system.metrics(), "# HELP up\nup 1\n");
});

test("an A2A JSON-RPC error is an ApiError with status 200", async () => {
  const { client } = gateway(() => json({ error: { code: -32000, message: "no such agent" } }));
  await assert.rejects(client.webhook.a2aSend("x", "hi"), {
    name: "ApiError",
    status: 200,
    reason: "no such agent",
  });
});

test("a call that misses its envelope field is a DecodeError", async () => {
  const { client } = gateway(() => json({ other: 1 }));
  await assert.rejects(client.cron.list(), { name: "DecodeError" });
});

test("a message the gateway no longer keeps is not found", async () => {
  const { client } = gateway(() => json({ channel: "email.box", error: "message not kept" }, 404));
  const err = await client.channels.redeliver("email.box", "gone").catch((e: unknown) => e);
  assert.ok(isNotFound(err));
});
