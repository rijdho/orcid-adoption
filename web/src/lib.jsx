import { useEffect, useState } from "react";
import { T } from "./text.js";

export const SECTIONS = ["year", "signup", "writers", "links", "ids", "checks", "groups", "institutions", "sample", "data"];

/** A sentence from text.js with its {placeholders} filled. */
export const t = (key, vars = {}) => (T[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

/** **bold** and [text](url) as React nodes. */
export function Md({ children }) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((https?:\/\/[^)]+)\)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(children))) {
    if (m.index > last) parts.push(children.slice(last, m.index));
    parts.push(m[1] ? <b key={i++}>{m[1]}</b> : <a key={i++} href={m[3]}>{m[2]}</a>);
    last = re.lastIndex;
  }
  parts.push(children.slice(last));
  return <>{parts}</>;
}

export function useData(path) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`./data/${path}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [path]);
  return data;
}

const nf1 = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const pct = (x) => (x == null ? t("na") : nf1.format(x));
export const num = (n) => (n == null ? t("na") : n.toLocaleString("en"));
/** A difference of two shares in percentage points, signed. */
export const pp = (a, b) => (a == null || b == null ? t("na") : `${a - b > 0 ? "+" : ""}${((a - b) * 100).toFixed(1)}`);

export function Stat({ value, label }) {
  return (
    <div className="stat">
      <div className="num">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function Note({ children }) {
  return <p className="muted note"><Md>{children}</Md></p>;
}

/** A table header cell with an optional tooltip; `r` right-aligns a numeric column. */
export function Th({ children, tip, r }) {
  return <th className={r ? "r" : undefined} data-tip={tip || undefined}>{children}</th>;
}

export function Table({ children }) {
  return <div className="table-wrap"><table>{children}</table></div>;
}
