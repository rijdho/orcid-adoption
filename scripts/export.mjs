// Publish the aggregated results of the private pipeline.
//
// The pipeline runs on the maintainer's computer and writes its output to _private/data/out/.
// This script is the only way anything reaches data/, the published dataset: it copies the fields
// named in SCHEMA below and nothing else. A field the pipeline adds later is left out (and listed)
// until it is named here; a value of the wrong type stops the export.
// It then writes institutions.csv for analysis.
//
// Usage: node scripts/export.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── What may be published ──────────────────────────────────────────────────────
// Leaves: "num", "str", "bool", "num?" / "str?" (may be null), "strs" (array of strings).
// { key: spec } names the keys allowed; { "*": spec } is a map with any keys; [spec] an array.
const MEAN = { profiles: "num", avgOverall: "num?", empty: "num?" };
// Groups by ORCID membership on the day of the harvest: member (the next two together), consortium, direct, none.
const BY_GROUP = (spec) => ({ member: spec, consortium: spec, direct: spec, none: spec });

export const SCHEMA = {
  "overview.json": {
    generatedAt: "str", harvest: { from: "str", to: "str" }, memberList: "str", maxPerInstitution: "num",
    groups: BY_GROUP({ sampled: "num", institutions: "num", truncated: "num", ...MEAN, staff: MEAN }),
  },
  "links.json": { generatedAt: "str", links: "strs", staffLinks: "strs", groups: BY_GROUP({ "*": MEAN }) },
  "continents.json": { generatedAt: "str", continents: { "*": BY_GROUP({ institutions: "num", ...MEAN }) } },
  "timeline.json": { generatedAt: "str", years: { "*": BY_GROUP(MEAN) } },
  "fields.json": {
    generatedAt: "str",
    weights: { "*": "num" },
    checks: { "*": BY_GROUP({ share: "num?", applicable: "num" }) },
    categories: { "*": BY_GROUP("num?") },
  },
  // Employment entries with the institution, by the year they were added and their dates:
  // how many, how many in the same hour as the account was created, how many written by a system.
  "signup.json": { generatedAt: "str", groups: BY_GROUP({ "*": { "*": { entries: "num", atSignup: "num", byClient: "num" } } }) },
  // Employment entries at other organisations, by the year they were added: how many carry a ROR id.
  "employer-ids.json": { generatedAt: "str", groups: BY_GROUP({ "*": { entries: "num", ror: "num" } }) },
  "institutions.json": {
    generatedAt: "str",
    institutions: [{
      id: "str", name: "str", country: "str", continent: "str", membership: "str", ror: "str",
      found: "num", profiles: "num", truncated: "bool", avgOverall: "num?", empty: "num?", links: { "*": "num" },
      // Employment entries with the institution, other affiliations and works in its profiles: all, and written by its own system.
      own: { here: "num", hereEntries: "num", affiliations: "num", affiliationsEntries: "num", works: "num", worksEntries: "num" },
    }],
  },
  // Who wrote the entries: groups[group][section][year added][kind] = entries. The organisations
  // that wrote the most, by name (never the client id, some of which have the form of an ORCID iD).
  // Members whose own system wrote at least ownMin of their employment entries, other affiliations or works, and the rest.
  "writers.json": {
    generatedAt: "str", kinds: "strs", sections: "strs", ownMin: "num",
    groups: BY_GROUP({ "*": { "*": { "*": "num" } } }),
    organisations: [{ name: "str", institutions: "num", entries: "num", sections: { "*": "num" } }],
    members: { writes: { institutions: "num", ...MEAN, years: { "*": MEAN } }, other: { institutions: "num", ...MEAN, years: { "*": MEAN } } },
  },
};

// ── Copy by schema ─────────────────────────────────────────────────────────────
export function pick(value, spec, path, dropped) {
  if (typeof spec === "string") {
    const optional = spec.endsWith("?");
    const kind = spec.replace("?", "");
    if (value == null) {
      if (optional) return null;
      throw new Error(`${path}: missing (${spec})`);
    }
    if (kind === "num" && typeof value === "number" && Number.isFinite(value)) return value;
    if (kind === "str" && typeof value === "string") return value;
    if (kind === "bool" && typeof value === "boolean") return value;
    if (kind === "strs" && Array.isArray(value) && value.every((v) => typeof v === "string")) return value;
    throw new Error(`${path}: expected ${spec}, got ${JSON.stringify(value).slice(0, 60)}`);
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) throw new Error(`${path}: expected an array`);
    return value.map((v, i) => pick(v, spec[0], `${path}[${i}]`, dropped));
  }
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: expected an object`);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const s = spec[k] ?? spec["*"];
    if (s === undefined) { dropped.add(`${path.replace(/\[\d+\]/g, "[]")}.${k}`); continue; }
    out[k] = pick(v, s, `${path}.${k}`, dropped);
  }
  for (const k of Object.keys(spec)) {
    if (k !== "*" && !(k in value) && !String(spec[k]).endsWith("?")) throw new Error(`${path}.${k}: missing`);
  }
  return out;
}

// ── Small groups ───────────────────────────────────────────────────────────────
// With fewer than MIN_PROFILES profiles, a mean would describe identifiable people, so it is
// blanked. Institutions: below the threshold the averages and link counts are blanked and the row
// is marked suppressed; its profiles still count in the continent and group figures. Since a
// continent's figure minus the institutions shown would give the hidden ones, when the hidden rows
// of a continent and membership status hold 1 to 4 profiles, the smallest shown rows there are
// blanked too (the member group is the sum of consortium and direct, so it needs no rule of its own).
// Year cells (timeline, link classes) below the threshold are blanked as well.
export const MIN_PROFILES = 5;
const blankRow = (r) => ({ ...r, avgOverall: null, empty: null, links: null, own: null, suppressed: true });
const blankMean = (m) => (m.profiles < MIN_PROFILES ? { ...m, avgOverall: null, empty: null } : m);

export function suppressInstitutions(rows) {
  const out = rows.map((r) => (r.profiles > 0 && r.profiles < MIN_PROFILES ? blankRow(r) : { ...r, suppressed: false }));
  for (const key of new Set(out.map((r) => `${r.continent}|${r.membership}`))) {
    const cell = out.filter((r) => `${r.continent}|${r.membership}` === key && r.profiles > 0);
    for (;;) {
      const hidden = cell.filter((r) => r.suppressed).reduce((a, r) => a + r.profiles, 0);
      if (hidden === 0 || hidden >= MIN_PROFILES) break;
      const shown = cell.filter((r) => !r.suppressed).sort((a, b) => a.profiles - b.profiles);
      if (!shown.length) break;
      Object.assign(shown[0], blankRow(shown[0]));
    }
  }
  return out;
}

const mapValues = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
const byGroup = (o, f) => mapValues(o, f);

// ── CSV ────────────────────────────────────────────────────────────────────────
const cell = (v) => {
  if (v == null) return "";
  const s = typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";

function institutionsCsv(rows, links) {
  const header = ["id", "name", "country", "continent", "orcid_membership", "ror", "profiles_found", "profiles_scored",
    "truncated", "completeness", "empty_share", "suppressed", ...links.map((l) => `link_${l.replace("-", "_")}`),
    "employment_here_entries", "employment_here_by_own_system", "other_affiliations", "other_affiliations_by_own_system", "works", "works_by_own_system"];
  return csv(header, rows.map((r) => [r.id, r.name, r.country, r.continent, r.membership, r.ror, r.found, r.profiles,
    r.truncated, r.avgOverall, r.empty, r.suppressed, ...links.map((l) => r.links?.[l]),
    r.own?.hereEntries, r.own?.here, r.own?.affiliationsEntries, r.own?.affiliations, r.own?.worksEntries, r.own?.works]));
}

// ── Run ────────────────────────────────────────────────────────────────────────
function run() {
  const src = join(ROOT, "_private", "data", "out");
  const dst = join(ROOT, "data");
  if (!existsSync(src)) throw new Error(`${src} not found: run the private pipeline first`);
  mkdirSync(dst, { recursive: true });
  const dropped = new Set();
  const out = {};
  for (const [file, spec] of Object.entries(SCHEMA)) {
    out[file] = pick(JSON.parse(readFileSync(join(src, file), "utf8")), spec, file, dropped);
  }
  out["institutions.json"].institutions = suppressInstitutions(out["institutions.json"].institutions);
  out["timeline.json"].years = mapValues(out["timeline.json"].years, (y) => byGroup(y, blankMean));
  out["links.json"].groups = byGroup(out["links.json"].groups, (g) => mapValues(g, blankMean));
  out["continents.json"].continents = mapValues(out["continents.json"].continents, (c) => byGroup(c, blankMean));
  for (const side of Object.values(out["writers.json"].members)) side.years = mapValues(side.years, blankMean);
  for (const file of Object.keys(SCHEMA)) writeFileSync(join(dst, file), JSON.stringify(out[file], null, 2) + "\n");
  writeFileSync(join(dst, "institutions.csv"), institutionsCsv(out["institutions.json"].institutions, out["links.json"].links));
  console.log(`${Object.keys(SCHEMA).length} JSON files and institutions.csv written to data/`);
  if (dropped.size) console.log(`  left out (not in SCHEMA): ${[...dropped].sort().join(", ")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
