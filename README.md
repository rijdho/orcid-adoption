# ORCID profiles at member and non-member institutions

Are ORCID profiles more complete at institutions that are ORCID members? This project scores the
public ORCID profiles found through the ROR ids of 120 research institutions, 20 per continent, and
compares members with the other institutions: overall, year by year of account creation, and by who
wrote each entry in the profiles.

🔗 **Live:** https://rijdho.github.io/orcid-adoption/

Available in **English**.

Part of the [Metaudits](https://rijdho.github.io/metaudits-home/) family.

## What it measures

- **Membership.** Each institution's ORCID membership on the day of collection, from ORCID's member
  list: through a consortium, direct, or none. The list gives the current membership period, not
  when an institution first joined.
- **Profiles.** For each institution, the ORCID profiles that the ORCID Public API's search finds
  through its ROR id, at most 2,500 per institution in the order the search returns them.
- **Completeness.** A weighted score of 12 checks in 6 categories: identity, employment, education,
  works, funding and peer review. Profiles are also compared by the year the account was created and
  by their strongest link to the institution (employed there now, employment without dates, employed
  there before, studied there, other).
- **Who writes the entries.** Every entry in an ORCID record names who wrote it: the researcher, a
  person the researcher trusted to edit the record, or the system of an organisation that writes
  through ORCID's member API. Entries that a system wrote after the researcher chose them in a
  search-and-link tool (Scopus, Web of Science and others) record the researcher as the one who made
  the link, and are counted as linked by the researcher. Systems that belong to the sampled
  institutions were matched to them by hand.
- **Sign-up affiliations.** For each employment entry with the institution, whether it was written
  within an hour of the account's creation.

ORCID's search finds a profile through a public affiliation of any kind that carries the
institution's ROR id. Affiliations that name the institution without its ROR id (by name only, or
with another identifier such as Ringgold) are not found; few entries added before 2022 carry one, so
recent accounts weigh more in the sample than in the whole population. The institutions were
chosen, not drawn at random, so the comparison describes them and does not show that membership has
no effect anywhere.

## Data

The aggregated results are in [`data/`](data/) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The page offers them for download as well.

### `institutions.csv`

One row per institution.

| Column | Meaning |
|---|---|
| `id`, `name`, `country`, `continent`, `ror` | the institution and its ROR id |
| `orcid_membership` | `consortium`, `direct` or `none`, on the day of collection |
| `profiles_found` | profiles the search counted (for the University of Adelaide, which has two ROR ids, the counts of both searches added) |
| `profiles_scored` | profiles scored, at most 2,500 |
| `truncated` | `true` when the search found more than 2,500 profiles |
| `completeness` | mean profile completeness, 0 to 1 |
| `empty_share` | share of profiles that list no works |
| `suppressed` | `true` when the figures are left empty (see below) |
| `link_*` | profiles by their strongest link to the institution (below) |
| `employment_here_entries`, `employment_here_by_own_system` | employment entries with the institution's ROR id, and how many its own system wrote |
| `other_affiliations`, `other_affiliations_by_own_system` | every other affiliation entry, and how many the institution's own system wrote |
| `works`, `works_by_own_system` | works (each counted once, in the version the profile shows), and how many the institution's own system wrote |

The `link_*` columns, strongest first:

| Column | The profile's strongest affiliation with the institution |
|---|---|
| `link_current` | employment with a start date and no end date, or an end on or after the day the data were collected |
| `link_undated_recent` | employment without dates, added to ORCID in the year of collection or the two before |
| `link_undated_old` | employment without dates, added earlier |
| `link_past` | employment that ended before the data were collected (an end in the year of collection without a month counts as past) |
| `link_education` | education or qualification only |
| `link_other` | invited position, distinction, membership or service only |
| `link_none` | no public affiliation with the institution's ROR id |

### JSON files

The files the page reads, each split by membership group: `member` (`consortium` and `direct`
together), `consortium`, `direct` and `none`. They hold group figures (`overview.json`), completeness by year of account
creation (`timeline.json`), by link class (`links.json`), by continent (`continents.json`), the 12
checks and 6 categories with their weights (`fields.json`), employment entries with the institution
by year added and how many were written at sign-up (`signup.json`), employment entries elsewhere identified by ROR (`employer-ids.json`),
who wrote the entries by section and year added (`writers.json`), and the institutions
(`institutions.json`).

### What is not published

Data on individual ORCID profiles, and the client ids of the systems that write to them (only the
organisations' names). An institution with fewer than 5 profiles would be listed without figures,
and so would the smallest institutions of its continent and membership status when the hidden ones
hold 1 to 4 profiles; means over fewer than 5 profiles are left empty. To request profile-level data
for research, contact the author through [rijdho.github.io](https://rijdho.github.io).

## How it is updated

The harvest and scoring run on the maintainer's computer and are not part of this repository. Their
output passes through [`scripts/export.mjs`](scripts/export.mjs), which publishes only the fields it
names, blanks small groups and writes the CSV table. `npm test` checks that nothing else is published
(`tests/privacy.test.mjs`) and that the published files agree with each other and the page's texts
carry no figure of their own (`tests/claims.test.mjs`). [`NUMBERS.md`](NUMBERS.md) lists every
figure the site shows; it is regenerated before each update, so its git history shows what changed.
GitHub Pages rebuilds the site from `data/` on every push to `main`.

```bash
npm run export      # maintainer only: needs the private pipeline output
npm run numbers     # NUMBERS.md: every figure the site shows
npm test            # allowed fields, no small groups, no private files, figures consistent
cd web && npm ci && npm test && npm run dev
```

## Sources

The [ORCID Public API](https://info.orcid.org/documentation/features/public-api/) (profiles),
[ROR](https://ror.org) (institution ids) and
[ORCID's member list](https://orcid.org/members) (membership).

## License

Code under the [MIT License](LICENSE); the data in `data/` and the texts under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Inter (the font) under the SIL Open Font
License 1.1. See [`NOTICE`](NOTICE).
