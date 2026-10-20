// What this repository publishes is the aggregated output of a private pipeline. These checks fail
// before a push could publish anything else.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA, pick, MIN_PROFILES } from "../scripts/export.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const tracked = () => execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean);
const GROUPS = ["member", "consortium", "direct", "none"];

test("nothing private is tracked or about to be", () => {
  const bad = tracked().filter((f) => /^(_private|_ref)\//.test(f) || f === "CLAUDE.md" || /records\.jsonl|profiles\.json$|profiles-export/.test(f));
  assert.deepEqual(bad, []);
});

test("the only scripts are the published ones", () => {
  const scripts = tracked().filter((f) => /\.(mjs|js|jsx|sh|py)$/.test(f) && !f.startsWith("web/"));
  assert.deepEqual(scripts.sort(), ["scripts/export.mjs", "scripts/numbers.mjs", "tests/claims.test.mjs", "tests/privacy.test.mjs"]);
});

test("the published files are exactly the exported ones", () => {
  assert.deepEqual(readdirSync(join(ROOT, "data")).sort(), [...Object.keys(SCHEMA), "institutions.csv"].sort());
});

test("published data holds only the fields the export allows", () => {
  for (const [file, spec] of Object.entries(SCHEMA)) {
    const value = read(file);
    if (file === "institutions.json") value.institutions = value.institutions.map(({ suppressed, ...r }) => r);
    const dropped = new Set();
    pick(value, spec, file, dropped);
    assert.deepEqual([...dropped], [], `${file} has fields outside the schema`);
  }
});

test("no ORCID iD appears anywhere in the published data", () => {
  for (const f of readdirSync(join(ROOT, "data"))) {
    assert.ok(!/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/.test(readFileSync(join(ROOT, "data", f), "utf8")), f);
  }
});

test(`no institution with 1 to ${MIN_PROFILES - 1} profiles shows figures`, () => {
  for (const r of read("institutions.json").institutions.filter((r) => r.profiles > 0 && r.profiles < MIN_PROFILES)) {
    assert.equal(r.suppressed, true, r.id);
    assert.equal(r.avgOverall, null, r.id);
    assert.equal(r.links, null, r.id);
  }
});

test("no hidden institutions of 1 to 4 profiles can be worked out from a continent's figure", () => {
  const rows = read("institutions.json").institutions;
  for (const key of new Set(rows.map((r) => `${r.continent}|${r.membership}`))) {
    const hidden = rows.filter((r) => `${r.continent}|${r.membership}` === key && r.suppressed).reduce((s, r) => s + r.profiles, 0);
    assert.ok(hidden === 0 || hidden >= MIN_PROFILES, `${key}: ${hidden} hidden profiles`);
  }
});

test(`no mean over 1 to ${MIN_PROFILES - 1} profiles is shown`, () => {
  const cells = [
    ...Object.values(read("timeline.json").years).flatMap((y) => GROUPS.map((g) => y[g])),
    ...GROUPS.flatMap((g) => Object.values(read("links.json").groups[g])),
    ...Object.values(read("continents.json").continents).flatMap((c) => GROUPS.map((g) => c[g])),
  ];
  for (const c of cells.filter((c) => c.profiles > 0 && c.profiles < MIN_PROFILES)) {
    assert.equal(c.avgOverall, null);
    assert.equal(c.empty, null);
  }
});
