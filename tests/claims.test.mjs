// The figures on the site are computed from data/*.json when the page is shown, so no figure is
// typed into the text. What can still go wrong is that the files disagree with each other, or
// that a text carries a number of its own. These checks fail before a push could publish either.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const GROUPS = ["member", "consortium", "direct", "none"];
const inGroup = (r, g) => (g === "member" ? r.membership !== "none" : r.membership === g);
const ov = read("overview.json"), links = read("links.json"), insts = read("institutions.json").institutions;
const cont = read("continents.json").continents, tl = read("timeline.json").years, fields = read("fields.json");

for (const g of GROUPS) {
  const mine = insts.filter((r) => inGroup(r, g));

  test(`${g}: institutions and profiles add up across files`, () => {
    assert.equal(ov.groups[g].sampled, mine.length);
    assert.equal(ov.groups[g].institutions, mine.filter((r) => r.profiles > 0).length);
    assert.equal(ov.groups[g].truncated, mine.filter((r) => r.profiles > 0 && r.truncated).length);
    assert.equal(ov.groups[g].profiles, sum(mine.map((r) => r.profiles)));
    assert.equal(ov.groups[g].profiles, sum(Object.values(links.groups[g]).map((l) => l.profiles)));
    assert.equal(ov.groups[g].profiles, sum(Object.values(cont).map((c) => c[g].profiles)));
    assert.equal(ov.groups[g].institutions, sum(Object.values(cont).map((c) => c[g].institutions)));
    assert.ok(sum(Object.values(tl).map((y) => y[g].profiles)) <= ov.groups[g].profiles);
  });

  test(`${g}: current staff is the staff link classes`, () => {
    assert.equal(ov.groups[g].staff.profiles, sum(links.staffLinks.map((l) => links.groups[g][l].profiles)));
  });

  test(`${g}: each institution's link counts add up to its profiles`, () => {
    for (const r of mine.filter((r) => r.links)) assert.equal(sum(Object.values(r.links)), r.profiles, r.id);
  });

  test(`${g}: no more profiles scored than the cap, nor than found`, () => {
    for (const r of mine) {
      assert.ok(r.profiles <= ov.maxPerInstitution && r.profiles <= r.found, r.id);
      if (r.profiles > 0) assert.equal(r.truncated, r.found > ov.maxPerInstitution, r.id);
    }
  });

  test(`${g}: the group mean is the profile-weighted mean of the link classes`, () => {
    const ls = Object.values(links.groups[g]).filter((l) => l.avgOverall != null);
    const w = sum(ls.map((l) => l.avgOverall * l.profiles)) / sum(ls.map((l) => l.profiles));
    assert.ok(Math.abs(w - ov.groups[g].avgOverall) < 0.001);
  });
}

const wr = read("writers.json");
const entries = (g, sec) => sum(Object.values(wr.groups[g][sec] || {}).flatMap((y) => Object.values(y)));
const ownEntries = (g, sec) => sum(Object.values(wr.groups[g][sec] || {}).map((y) => y.institution || 0));
test("who wrote the entries: the files agree", () => {
  for (const g of GROUPS) {
    const mine = insts.filter((r) => inGroup(r, g));
    for (const sec of ["here", "affiliations", "works"]) {
      assert.equal(entries(g, sec), sum(mine.map((r) => r.own[`${sec}Entries`])), `${g} ${sec}`);
      assert.equal(ownEntries(g, sec), sum(mine.map((r) => r.own[sec])), `${g} ${sec} own`);
    }
  }
  for (const sec of wr.sections) assert.equal(entries("member", sec), entries("consortium", sec) + entries("direct", sec), sec);
  for (const y of Object.values(wr.groups.member).flatMap((s) => Object.values(s))) {
    for (const k of Object.keys(y)) assert.ok(wr.kinds.includes(k), k);
  }
  const writes = (r) => ["here", "affiliations", "works"].some((s) => r.own[s] > 0 && r.own[s] >= wr.ownMin * r.own[`${s}Entries`]);
  const members = insts.filter((r) => r.membership !== "none" && r.profiles > 0);
  assert.equal(wr.members.writes.institutions, members.filter(writes).length);
  assert.equal(wr.members.writes.institutions + wr.members.other.institutions, ov.groups.member.institutions);
  assert.equal(wr.members.writes.profiles + wr.members.other.profiles, ov.groups.member.profiles);
});

test("member is consortium and direct together", () => {
  for (const k of ["sampled", "institutions", "profiles"]) {
    assert.equal(ov.groups.member[k], ov.groups.consortium[k] + ov.groups.direct[k], k);
  }
  assert.equal(ov.groups.member.sampled + ov.groups.none.sampled, insts.length);
  assert.ok(insts.every((r) => ["consortium", "direct", "none"].includes(r.membership)));
});

test("the definitions the texts state match the data", () => {
  assert.equal(Object.keys(fields.checks).length, 12, "12 checks");
  assert.equal(Object.keys(fields.categories).length, 6, "6 categories");
  assert.deepEqual(Object.keys(fields.weights).sort(), Object.keys(fields.categories).sort());
  assert.ok(Math.abs(Object.values(fields.weights).reduce((a, b) => a + b, 0) - 1) < 1e-9, "weights add up to 1");
  assert.equal(insts.length, 120, "120 institutions");
  assert.equal(new Set(insts.map((r) => r.continent)).size, 6, "6 continents");
});

// Numbers a text may carry: definitions checked above or fixed by the code. Any other figure in
// the page's text is typed by hand and fails here; it belongs in the data.
const ALLOWED = new Set(["1", "2", "3", "4", "5", "6", "10", "12", "20", "100", "120", "2500", "2,500",
  "2021", "2022", "2023", "2024", "4.0"]);
test("no text on the page carries a figure of its own", () => {
  const file = join(ROOT, "web", "src", "text.js");
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8").replace(/\{[^}]*\}/g, "").replace(/https?:\/\/\S+/g, "");
  for (const n of text.match(/\d+(?:[.,]\d+)?/g) || []) assert.ok(ALLOWED.has(n), `text.js: ${n}`);
});
