import { useMemo, useState } from "react";
import { t, Md, useData, pct, num, pp, Stat, Note, Th, Table } from "./lib.jsx";
import Shell from "./Shell.jsx";

const FILES = ["overview", "timeline", "signup", "writers", "links", "employer-ids", "fields", "institutions"];
const sum = (a) => a.reduce((x, y) => x + y, 0);

function useAll() {
  const d = Object.fromEntries(FILES.map((f) => [f, useData(`${f}.json`)])); // eslint-disable-line react-hooks/rules-of-hooks
  if (FILES.some((f) => d[f] === null)) return null;
  if (FILES.some((f) => d[f] === undefined)) return undefined;
  return d;
}

// Profiles created before 2022, as a share of a group's profiles with a creation year.
function oldShare(years, g) {
  const ys = Object.entries(years);
  const all = sum(ys.map(([, v]) => v[g].profiles));
  return all ? sum(ys.filter(([y]) => +y < 2022).map(([, v]) => v[g].profiles)) / all : null;
}

function Lede({ d }) {
  const { overview: ov, timeline } = d;
  const m = ov.groups.member, n = ov.groups.none;
  const years = Object.values(timeline.years).filter((y) => y.member.avgOverall != null && y.none.avgOverall != null);
  // Differences rounded to the tenth of a point shown in the table; a -0.0 is not "less complete".
  const diffs = years.map((y) => Math.round((y.member.avgOverall - y.none.avgOverall) * 1000) / 10);
  const here = tallyWriters(d.writers.groups, "member", "here", WRITER_PERIODS[0][1]);
  return (
    <>
      <h1>{t("title")}</h1>
      <p className="lede"><Md>{t("lede", {
        profiles: num(m.profiles + n.profiles), institutions: num(m.institutions + n.institutions), date: ov.harvest.to,
        pm: pct(m.avgOverall), pn: pct(n.avgOverall), years: diffs.length, pOwn: pct(here.share("institution")),
        lower: diffs.filter((x) => x < 0).length, maxAbs: Math.max(...diffs.map(Math.abs)).toFixed(1),
      })}</Md></p>
      <div className="stat-grid">
        <Stat value={num(m.profiles + n.profiles)} label={t("stat.profiles")} />
        <Stat value={pct(m.avgOverall)} label={t("stat.members")} />
        <Stat value={pct(n.avgOverall)} label={t("stat.none")} />
        <Stat value={`${pct(m.empty)} / ${pct(n.empty)}`} label={t("stat.empty")} />
      </div>
    </>
  );
}

function ByYear({ d }) {
  const years = Object.entries(d.timeline.years).sort(([a], [b]) => a - b);
  return (
    <section id="year">
      <h2>{t("h.year")}</h2>
      <Note>{t("year.note", { mOld: pct(oldShare(d.timeline.years, "member")), nOld: pct(oldShare(d.timeline.years, "none")) })}</Note>
      <Table>
        <thead><tr>
          <Th>{t("year.col.year")}</Th><Th r>{t("year.col.profiles")}</Th><Th r>{t("year.col.m")}</Th>
          <Th r>{t("year.col.n")}</Th><Th r tip={t("year.col.diff.tip")}>{t("year.col.diff")}</Th>
        </tr></thead>
        <tbody>
          {years.map(([y, v]) => (
            <tr key={y}>
              <td>{y}</td><td className="r">{num(v.member.profiles)} / {num(v.none.profiles)}</td>
              <td className="r">{pct(v.member.avgOverall)}</td><td className="r">{pct(v.none.avgOverall)}</td>
              <td className="r">{pp(v.member.avgOverall, v.none.avgOverall)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function Signup({ d }) {
  const tally = (g, y) => {
    const k = Object.values(d.signup.groups[g][y] || {});
    const e = sum(k.map((c) => c.entries));
    return { e, s: e ? sum(k.map((c) => c.atSignup)) / e : null };
  };
  // Years before 2022 hold few entries (few carried a ROR id then); they are pooled into one row.
  const all = [...new Set([...Object.keys(d.signup.groups.member), ...Object.keys(d.signup.groups.none)])].map(Number);
  const pool = (g, keep) => {
    const parts = all.filter(keep).map((y) => tally(g, y));
    const e = sum(parts.map((p) => p.e));
    return { e, s: e ? sum(parts.map((p) => p.s * p.e)) / e : null };
  };
  const rows = [[`≤ 2021`, (y) => y <= 2021], ...all.filter((y) => y >= 2022).sort().map((y) => [String(y), (x) => x === y])];
  return (
    <section id="signup">
      <h2>{t("h.signup")}</h2>
      <Note>{t("signup.note")}</Note>
      <Table>
        <thead><tr>
          <Th>{t("signup.col.year")}</Th>
          <Th r>{t("signup.col.entries")}</Th><Th r>{t("signup.col.signup")}</Th>
        </tr></thead>
        <tbody>
          {rows.map(([label, keep]) => {
            const m = pool("member", keep), n = pool("none", keep);
            return (
              <tr key={label}>
                <td>{label}</td>
                <td className="r">{num(m.e)} / {num(n.e)}</td>
                <td className="r">{pct(m.s)} / {pct(n.s)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}

const WRITER_KINDS = ["researcher", "linked", "institution", "other"];
const WRITER_PERIODS = [["all", () => true], ["early", (y) => y <= 2021], ["mid", (y) => y === 2022 || y === 2023], ["late", (y) => y >= 2024]];

/** Entries of a section in a group, by kind of writer, over the years `keep` accepts ("unknown" only in all years). */
function tallyWriters(groups, g, sec, keep) {
  const ys = Object.entries(groups[g][sec] || {}).filter(([y]) => (y === "unknown" ? keep === WRITER_PERIODS[0][1] : keep(+y)));
  const by = (k) => sum(ys.map(([, v]) => v[k] || 0));
  const n = sum(ys.map(([, v]) => sum(Object.values(v))));
  return { n, share: (k) => (n ? by(k) / n : null) };
}

function Writers({ d }) {
  const w = d.writers;
  const [period, setPeriod] = useState("all");
  const keep = WRITER_PERIODS.find(([p]) => p === period)[1];
  const allM = sum(w.sections.map((s) => tallyWriters(w.groups, "member", s, WRITER_PERIODS[0][1]).n));
  const allN = sum(w.sections.map((s) => tallyWriters(w.groups, "none", s, WRITER_PERIODS[0][1]).n));
  const delegates = sum(["member", "none"].flatMap((g) => w.sections.flatMap((s) => Object.values(w.groups[g][s] || {}).map((v) => v.delegate || 0))));
  const ws = w.members.writes, wo = w.members.other;
  const years = Object.keys(ws.years).filter((y) => ws.years[y].avgOverall != null && wo.years[y]?.avgOverall != null);
  const diffs = years.map((y) => Math.round((ws.years[y].avgOverall - wo.years[y].avgOverall) * 1000) / 10);
  // The other members' yearly means, weighted by the writing members' profiles per year.
  const wsN = sum(years.map((y) => ws.years[y].profiles));
  const woAtWsMix = sum(years.map((y) => wo.years[y].avgOverall * ws.years[y].profiles)) / wsN;
  const wsMean = sum(years.map((y) => ws.years[y].avgOverall * ws.years[y].profiles)) / wsN;
  const ownShare = (a, b) => (b ? a / b : null);
  const writing = d.institutions.institutions
    .filter((r) => r.own && ["here", "affiliations", "works"].some((s) => ownShare(r.own[s], r.own[`${s}Entries`]) >= w.ownMin))
    .sort((a, b) => ownShare(b.own.works, b.own.worksEntries) - ownShare(a.own.works, a.own.worksEntries));
  return (
    <section id="writers">
      <h2>{t("h.writers")}</h2>
      <Note>{t("writers.note", { delegates: num(delegates), entries: num(allM + allN) })}</Note>
      <div className="filters">
        <label>{t("writers.filter")}{" "}
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {WRITER_PERIODS.map(([p]) => <option key={p} value={p}>{t(`writers.period.${p}`)}</option>)}
          </select>
        </label>
      </div>
      <Table>
        <thead><tr>
          <Th>{t("writers.col.section")}</Th><Th r>{t("writers.col.entries")}</Th>
          {WRITER_KINDS.map((k) => <Th r key={k} tip={t(`writer.${k}.tip`)}>{t(`writer.${k}`)}</Th>)}
        </tr></thead>
        <tbody>
          {w.sections.map((s) => {
            const m = tallyWriters(w.groups, "member", s, keep), n = tallyWriters(w.groups, "none", s, keep);
            return (
              <tr key={s}>
                <td data-tip={t(`writers.sec.${s}.tip`)}>{t(`writers.sec.${s}`)}</td>
                <td className="r">{num(m.n)} / {num(n.n)}</td>
                {WRITER_KINDS.map((k) => <td className="r" key={k}>{pct(m.share(k))} / {pct(n.share(k))}</td>)}
              </tr>
            );
          })}
        </tbody>
      </Table>

      <h3>{t("h.writers.own")}</h3>
      <Note>{t("writers.own.note", { ownMin: pct(w.ownMin), writes: ws.institutions, members: ws.institutions + wo.institutions, others: writing.filter((r) => r.membership === "none").length })}</Note>
      <Table>
        <thead><tr>
          <Th>{t("inst.col.name")}</Th><Th>{t("inst.col.membership")}</Th>
          <Th r>{t("writers.own.col.here")}</Th><Th r>{t("writers.own.col.affiliations")}</Th><Th r>{t("writers.own.col.works")}</Th>
        </tr></thead>
        <tbody>
          {writing.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{t(`membership.${r.membership}`)}</td>
              <td className="r">{pct(ownShare(r.own.here, r.own.hereEntries))}</td>
              <td className="r">{pct(ownShare(r.own.affiliations, r.own.affiliationsEntries))}</td>
              <td className="r">{pct(ownShare(r.own.works, r.own.worksEntries))}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h3>{t("h.writers.compare")}</h3>
      <Note>{t("writers.compare.note", {
        pw: pct(ws.avgOverall), po: pct(wo.avgOverall), years: diffs.length, higher: diffs.filter((x) => x > 0).length,
        pwMix: pct(wsMean), poMix: pct(woAtWsMix),
      })}</Note>
      <Table>
        <thead><tr>
          <Th>{t("writers.compare.col.group")}</Th><Th r>{t("writers.orgs.col.inst")}</Th><Th r>{t("groups.col.profiles")}</Th>
          <Th r>{t("groups.col.all")}</Th><Th r>{t("groups.col.empty")}</Th>
        </tr></thead>
        <tbody>
          {[["writes", ws], ["other", wo]].map(([k, v]) => (
            <tr key={k}>
              <td>{t(`writers.compare.${k}`)}</td><td className="r">{v.institutions}</td><td className="r">{num(v.profiles)}</td>
              <td className="r">{pct(v.avgOverall)}</td><td className="r">{pct(v.empty)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h3>{t("h.writers.orgs")}</h3>
      <Note>{t("writers.orgs.note")}</Note>
      <Table>
        <thead><tr><Th>{t("writers.orgs.col.name")}</Th><Th r>{t("writers.orgs.col.entries")}</Th><Th r>{t("writers.orgs.col.inst")}</Th></tr></thead>
        <tbody>
          {w.organisations.map((o) => (
            <tr key={o.name}><td>{o.name.trim()}</td><td className="r">{num(o.entries)}</td><td className="r">{o.institutions}</td></tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function Links({ d }) {
  const { links, groups } = d.links;
  const share = (g, l) => groups[g][l].profiles / sum(Object.values(groups[g]).map((c) => c.profiles));
  return (
    <section id="links">
      <h2>{t("h.links")}</h2>
      <Note>{t("links.note")}</Note>
      <Table>
        <thead><tr>
          <Th>{t("links.col.link")}</Th><Th r>{t("links.col.share")}</Th><Th r>{t("links.col.m")}</Th><Th r>{t("links.col.n")}</Th>
        </tr></thead>
        <tbody>
          {links.filter((l) => groups.member[l].profiles + groups.none[l].profiles >= 5).map((l) => (
            <tr key={l}>
              <td data-tip={t(`link.${l}.tip`)}>{t(`link.${l}`)}</td>
              <td className="r">{pct(share("member", l))} / {pct(share("none", l))}</td>
              <td className="r">{pct(groups.member[l].avgOverall)}</td><td className="r">{pct(groups.none[l].avgOverall)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

const PERIODS = [["early", (y) => y <= 2021], ["mid", (y) => y === 2022 || y === 2023], ["late", (y) => y >= 2024]];
function Ids({ d }) {
  const share = (g, keep) => {
    const ys = Object.entries(d["employer-ids"].groups[g]).filter(([y]) => keep(+y)).map(([, v]) => v);
    const e = sum(ys.map((v) => v.entries));
    return [e ? sum(ys.map((v) => v.ror)) / e : null, e];
  };
  return (
    <section id="ids">
      <h2>{t("h.ids")}</h2>
      <Note>{t("ids.note")}</Note>
      <Table>
        <thead><tr><Th>{t("ids.col.period")}</Th><Th r>{t("group.member")}</Th><Th r>{t("group.none")}</Th></tr></thead>
        <tbody>
          {PERIODS.map(([p, keep]) => {
            const [m, me] = share("member", keep), [n, ne] = share("none", keep);
            return (
              <tr key={p}>
                <td>{t(`ids.period.${p}`)}</td>
                <td className="r">{pct(m)} <span className="muted">({num(me)})</span></td>
                <td className="r">{pct(n)} <span className="muted">({num(ne)})</span></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}

const CATEGORY_OF = {
  biography: "identity", keywords: "identity", country: "identity", urls: "identity",
  employment_dated: "employment", employment_ror_elsewhere: "employment", education: "education",
  has_works: "works", works_5plus: "works", works_with_doi: "works", funding: "funding", peer_review: "peer_review",
};
function Checks({ d }) {
  const { checks, categories, weights } = d.fields;
  return (
    <section id="checks">
      <h2>{t("h.checks")}</h2>
      <Note>{t("checks.note")}</Note>
      <Table>
        <thead><tr><Th>{t("checks.col.check")}</Th><Th r>{t("checks.col.m")}</Th><Th r>{t("checks.col.n")}</Th></tr></thead>
        <tbody>
          {Object.keys(categories).map((c) => [
            <tr key={c}>
              <td><b>{t(`cat.${c}`)}</b> <span className="muted">({pct(weights[c])})</span></td>
              <td className="r"><b>{pct(categories[c].member)}</b></td><td className="r"><b>{pct(categories[c].none)}</b></td>
            </tr>,
            ...Object.keys(checks).filter((k) => CATEGORY_OF[k] === c).map((k) => (
              <tr key={k}>
                <td style={{ paddingLeft: 22 }}>{t(`check.${k}`)}</td>
                <td className="r">{pct(checks[k].member.share)}</td><td className="r">{pct(checks[k].none.share)}</td>
              </tr>
            )),
          ])}
        </tbody>
      </Table>
    </section>
  );
}

function Groups({ d }) {
  const g = d.overview.groups;
  return (
    <section id="groups">
      <h2>{t("h.groups")}</h2>
      <Note>{t("groups.note", { list: d.overview.memberList })}</Note>
      <Table>
        <thead><tr>
          <Th>{t("groups.col.group")}</Th><Th r>{t("groups.col.inst")}</Th><Th r>{t("groups.col.profiles")}</Th>
          <Th r>{t("groups.col.all")}</Th><Th r tip={t("groups.col.staff.tip")}>{t("groups.col.staff")}</Th><Th r>{t("groups.col.empty")}</Th>
        </tr></thead>
        <tbody>
          {["member", "consortium", "direct", "none"].map((k) => (
            <tr key={k}>
              <td style={k === "consortium" || k === "direct" ? { paddingLeft: 22 } : undefined}>{t(`group.${k}`)}</td>
              <td className="r">{g[k].institutions} / {g[k].sampled}</td><td className="r">{num(g[k].profiles)}</td>
              <td className="r">{pct(g[k].avgOverall)}</td><td className="r">{pct(g[k].staff.avgOverall)}</td><td className="r">{pct(g[k].empty)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function Institutions({ d }) {
  const [continent, setContinent] = useState("");
  const rows = d.institutions.institutions;
  const continents = useMemo(() => [...new Set(rows.map((r) => r.continent))].sort(), [rows]);
  const shown = rows.filter((r) => !continent || r.continent === continent)
    .sort((a, b) => a.continent.localeCompare(b.continent) || a.name.localeCompare(b.name));
  return (
    <section id="institutions">
      <h2>{t("h.institutions")}</h2>
      <Note>{t("inst.note")}</Note>
      <div className="filters">
        <label>{t("inst.filter")}{" "}
          <select value={continent} onChange={(e) => setContinent(e.target.value)}>
            <option value="">{t("inst.all")}</option>
            {continents.map((c) => <option key={c} value={c}>{t(`continent.${c}`)}</option>)}
          </select>
        </label>
      </div>
      <Table>
        <thead><tr>
          <Th>{t("inst.col.name")}</Th><Th>{t("inst.col.country")}</Th><Th>{t("inst.col.membership")}</Th>
          <Th r>{t("inst.col.found")}</Th><Th r>{t("inst.col.scored")}</Th><Th r>{t("inst.col.all")}</Th><Th r>{t("inst.col.empty")}</Th>
        </tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td><a href={r.ror}>{r.name}</a></td><td>{r.country}</td><td>{t(`membership.${r.membership}`)}</td>
              <td className="r">{num(r.found)}</td><td className="r">{num(r.profiles)}</td>
              <td className="r">{r.profiles ? pct(r.avgOverall) : ""}</td><td className="r">{r.profiles ? pct(r.empty) : ""}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function Sample() {
  return (
    <section id="sample">
      <h2>{t("h.sample")}</h2>
      {[1, 2, 3, 4, 5].map((i) => <p key={i} className="muted note"><Md>{t(`sample.${i}`)}</Md></p>)}
    </section>
  );
}

const DOWNLOADS = ["institutions.csv", ...FILES.map((f) => `${f}.json`), "continents.json"];
function Data() {
  return (
    <section id="data">
      <h2>{t("h.data")}</h2>
      <Note>{t("data.note")}</Note>
      <div className="export-buttons">
        {DOWNLOADS.map((f) => <a key={f} className="export-btn" href={`./data/${f}`} download>{f}</a>)}
      </div>
      <p className="muted note">{t("data.license")}</p>
    </section>
  );
}

export default function App() {
  const d = useAll();
  return (
    <Shell>
      {d === undefined && <p className="muted">{t("loading")}</p>}
      {d === null && <p className="muted">{t("failed")}</p>}
      {d && (
        <>
          <Lede d={d} />
          <ByYear d={d} /><Signup d={d} /><Writers d={d} /><Links d={d} /><Ids d={d} /><Checks d={d} />
          <Groups d={d} /><Institutions d={d} /><Sample /><Data />
        </>
      )}
    </Shell>
  );
}
