# Requirements — dashboard-analytics

## Project Description (Input)

### Who has the problem

- **A member of a tenant who wants to know how their stock is moving.** They
  can sign in, choose a tenant and see who else belongs to it. They cannot see a
  single number about the inventory that tenant exists to track. The platform is
  an analytics product whose dashboard holds no analytics.
- **The reviewer the whole project is written for.** Two backend features —
  `athena-analytics-query` and `cube-semantic-layer` — answer analytical
  questions over exported data, confined per tenant, labelled with how current
  they are and with where the answer came from. Every one of those properties is
  demonstrated by a test suite and by nothing a person can look at. A claim about
  embedded BI that only `curl` can reach is a weaker claim than the project
  exists to make.
- **The semantic layer itself.** It was built to be a chart's contract: a
  vocabulary in the platform's own words, three distinct answer states, a stated
  completeness, and provenance. Nothing has held it to that yet. A vocabulary no
  interface has ever asked for is a vocabulary whose gaps are still theoretical.

### Current situation

- **The dashboard is the shell around the analytics, not the analytics.**
  `frontend-shell` built signing in, tenant choice, role-aware navigation and
  the members screen; `dashboard-appearance` gave it a visual identity. The only
  tenant screen is `/t/:tenantId/members`. No chart, metric or query exists, and
  no charting library is installed.
- **`.kiro/design-brief.md` is out of date on one point.** Written 2026-08-20, it
  says the semantic layer "is configured in infrastructure but has no models".
  That is no longer true: the API now serves a modelled question route, validated
  end to end against the running stack.
- **The backend contract is settled.** The dashboard would consume
  `POST /tenants/:tenantId/analytics/questions`, which accepts a composition and
  answers it:
  - **Measures:** `net_quantity`, `movement_count`, `on_hand_quantity`.
  - **Groupings:** `recorded_day`, `occurred_day`, `kind`, `product`,
    `location`. A product and a location arrive labelled by code **and** current
    name.
  - **A period** of two days, at most 366 apart, and **which moment to read by**
    — the day a movement was recorded or the day it occurred, which differ when
    data is backdated.
  - **Three answer states:** answered with rows, answered with none (a quiet
    period), and never exported (a tenant whose data has not arrived). The last
    two draw the same empty chart and mean opposite things.
  - **Every answer states `completeThrough`** — the moment its data is complete
    through, which can be earlier than now — and **`servedFrom`**, whether it came
    from a prepared rollup or from the exported objects.
  - **Refusals the caller can act on:** an unknown name, naming what is offered;
    a period longer than the platform answers, naming the limit; an answer
    larger than 5,000 rows; more than ten questions a minute, saying how long to
    wait; and the semantic layer being unreachable, which refuses these questions
    and nothing else.
  - **All three tenant roles may ask.** Machine credentials may not.

### What should change

- **A tenant member can see their inventory analytics in the dashboard**, through
  two kinds of view:
  - **Curated views** answering what a dashboard asks constantly — on hand, and
    movements over time split by kind — each one a composed question chosen in
    advance, so the product has something to show the moment it opens.
  - **An explorer** where the person composes a question themselves from the
    offered measures, groupings, period and moment to read by. This is what
    shows the semantic layer is a vocabulary rather than a set of fixed charts.
- **The modelled route is the only analytical source.** The dashboard consumes
  `POST /tenants/:tenantId/analytics/questions` and nothing else for analytics.
- **The answer's honesty survives into the interface.** The three states stay
  visibly distinct: a quiet period reads as a quiet period, and a tenant that was
  never exported reads as data not yet arrived rather than as an empty chart. How
  current an answer is appears beside it, because a number shown without its date
  is read with more confidence than it has earned.
- **Refusals reach the person as something they can do something about** — a
  name corrected, a period shortened, a moment waited out — rather than as a
  generic failure.
- **The analytics follow the tenant and role context the shell already
  manages.** Switching tenant switches whose data is shown, with nothing from the
  previous tenant left on screen.

### Deliberately out of scope

- **The step-7 analytical route** (`GET /tenants/:tenantId/analytics/movements`).
  It was the demonstration precursor to the semantic layer; consuming both would
  mean two analytical contracts to keep in step.
- **Changing any data.** Analytics are read-only. Inventory is written by machine
  clients through the sync API, and nothing here edits it.
- **Triggering an export or a rebuild.** The export is an operator command, and a
  prepared answer rebuilds on its own when the export moves the watermark.
- **Real-time figures.** The semantic layer reads exported objects only, by
  design, so an answer is as current as the last export. The interface states
  that rather than hiding it.

## Requirements

*To be generated by `/kiro-spec-requirements dashboard-analytics`.*
