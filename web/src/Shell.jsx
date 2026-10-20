import { useState } from "react";
import { t, Md, SECTIONS } from "./lib.jsx";

// The concept DOI on Zenodo (it resolves to the latest version), shown at the foot of the rail.
const DOI = "10.5281/zenodo.23498577";
const SECTION_TITLE = { year: "h.year", signup: "h.signup", writers: "h.writers", links: "h.links", ids: "h.ids", checks: "h.checks",
  groups: "h.groups", institutions: "h.institutions", sample: "h.sample", data: "h.data" };

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const s = localStorage.getItem("oa-theme");
      if (s === "dark" || s === "light") return s;
    } catch { /* storage blocked */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const toggle = () => setTheme((s) => {
    const next = s === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("oa-theme", next); } catch { /* storage blocked */ }
    return next;
  });
  return [theme, toggle];
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);

/** The house shell: a rail of section links, a command bar and the content. */
export default function Shell({ children }) {
  const [theme, toggle] = useTheme();
  const [railOpen, setRailOpen] = useState(false);
  const toLabel = t(theme === "dark" ? "theme.toLight" : "theme.toDark");
  return (
    <div className={`app${railOpen ? " rail-open" : ""}`}>
      <aside className="rail">
        <div className="brand-mark">
          <a className="brand-glyph" style={{ "--glyph": "'OA'" }} href="./" tabIndex={-1} aria-hidden="true" />
          <div>
            <p className="brand-name"><a href="./">{t("short")}</a></p>
            <a className="brand-sub" href="https://rijdho.github.io">rijdho.github.io</a>
            <p className="brand-family"><Md>{t("family")}</Md></p>
          </div>
        </div>
        <p className="nav-label">{t("menu")}</p>
        <nav aria-label={t("menu")}>
          {SECTIONS.map((id, i) => (
            <a key={id} className="nav-item" href={`#${id}`} onClick={() => setRailOpen(false)}>
              <span className="nav-step" aria-hidden="true">{i + 1}</span><span>{t(SECTION_TITLE[id])}</span>
            </a>
          ))}
        </nav>
        {/* The credits stand here only (house-style README, "The house credits"). */}
        <div className="rail-foot">
          <Md>{t("by")}</Md><br />
          {t("license.code")}<br />{t("license.data")}<br /><Md>{t("source")}</Md><br />
          <a href={`https://doi.org/${DOI}`} target="_blank" rel="noopener noreferrer">DOI {DOI}</a>
        </div>
      </aside>
      {railOpen && <button className="rail-backdrop" type="button" aria-label={t("menu.close")} onClick={() => setRailOpen(false)} />}
      <div className="main-col">
        <div className="cmdbar">
          <button className="menu-btn" type="button" onClick={() => setRailOpen(true)} aria-label={t("menu")}><MenuIcon /></button>
          <div className="cmd-title">{t("short")}</div>
          <div className="cmd-spacer" />
          <button className="icon-btn" type="button" onClick={toggle} title={toLabel} aria-label={toLabel}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
