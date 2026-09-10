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

The subject of every criterion below is **the Dashboard**, meaning this
application as a person using a browser experiences it. "The platform" names the
backend this feature reads from and does not own; what this feature expects of
it is collected in section 9.

Two kinds of refusal appear below and must not be confused. A refusal that says
a person may not see something is **not diagnosable** — the platform answers every
such refusal identically on purpose, and `product.md` forbids the Dashboard from
guessing at a cause. A refusal about the *question* — a name the platform does
not offer, a period too long, an answer too large, a pace too quick, a service
not answering — is designed to be acted on, and section 7 is about those alone.

### 1. Reaching the analytics

- **1.1** While a person is acting in a tenant, the Dashboard shall offer that
  tenant's analytics to every tenant role the platform admits to them.
- **1.2** When the person switches to another tenant, the Dashboard shall show
  that tenant's analytics and no answer, figure or label belonging to the
  previous tenant.
- **1.3** If an answer for a tenant arrives after the person has switched away
  from it, the Dashboard shall discard that answer rather than show it.
- **1.4** If the platform refuses to answer for a tenant because the person may
  not see it, the Dashboard shall report the analytics as not available, in the
  same terms it uses for any other refusal of that kind.

### 2. The overview

- **2.1** When a person opens a tenant's analytics, the Dashboard shall show an
  overview without requiring them to compose anything.
- **2.2** The Dashboard shall show in the overview the quantity on hand of each
  product, each labelled by its code and its current name.
- **2.3** The Dashboard shall show in the overview the net quantity moved and the
  number of movements recorded on each day, separated by kind of movement.
- **2.4** The Dashboard shall make clear that the quantity on hand counts
  movements recorded before the chosen period as well as within it, so that it
  is not read as a figure for that period alone.
- **2.5** When the overview is first shown, the Dashboard shall cover the thirty
  days ending on the current day.
- **2.6** When a person chooses another period for the overview, the Dashboard
  shall show the overview for that period.
- **2.7** The Dashboard shall ask each of the overview's questions once for each
  showing, and shall not ask them again while the answers it holds are still
  the ones on screen.

### 3. The explorer

- **3.1** The Dashboard shall let a person compose a question from one or more
  measures, zero or more groupings, a period, and which moment to read by — the
  day a movement was recorded or the day it occurred.
- **3.2** The Dashboard shall offer as measures and groupings exactly those the
  platform answers, in the platform's own terms, and nothing else.
- **3.3** If a person has chosen no measure, the Dashboard shall not ask the
  question and shall say that a measure is needed.
- **3.4** If a person composes a period whose end falls before its start, or
  that is longer than the platform answers, the Dashboard shall not ask the
  question and shall say what is wrong, naming the longest period it answers.
- **3.5** The Dashboard shall show every answer's rows as a table, with a
  product or location labelled by both its code and its current name.
- **3.6** Where an answer can be drawn as a chart that shows every one of its
  rows, the Dashboard shall also show it as a chart.
- **3.7** Where an answer cannot be drawn that way, the Dashboard shall show the
  table alone, and shall not show a chart that omits or merges any of its rows.
- **3.8** When a person composes a question, the Dashboard shall make that
  composition part of the address, so that reloading the page or opening the
  address shows the same composition for the same tenant.
- **3.9** If an address names a composition the Dashboard cannot ask — a name
  the platform does not offer, or a period the platform does not answer — the
  Dashboard shall say what is wrong rather than silently changing the
  composition.
- **3.10** If an address names a tenant the person may not see, the Dashboard
  shall report the analytics as not available, exactly as 1.4 does, and shall
  show nothing of the composition's answer.

### 4. How current an answer is, and where it came from

- **4.1** The Dashboard shall show, beside every answer, the moment the data
  behind it is complete through, as the platform reported it.
- **4.2** The Dashboard shall not present an answer as more current than the
  moment the platform reported for it.
- **4.3** The Dashboard shall make available, for every answer, whether the
  platform answered it from what was prepared in advance or by reading the
  exported data again, and shall show that indication less prominently than the
  answer and than how current the answer is.
- **4.4** The Dashboard shall label every day it shows as the platform counts
  days, and shall make clear which calendar that is, so that a day is not read
  as the person's local day when it differs.

### 5. The three states of an answer

- **5.1** When the platform answers with rows, the Dashboard shall show them.
- **5.2** When the platform answers with no rows for a period, the Dashboard
  shall say that nothing was recorded in that period, and shall still show how
  current the answer is.
- **5.3** When the platform reports that a tenant's data has never been
  exported, the Dashboard shall say that the data has not arrived yet, and shall
  show it distinctly from a period in which nothing was recorded.
- **5.4** The Dashboard shall not show an empty chart or an empty table as the
  whole of its response to a tenant whose data has never been exported.

### 6. While a question is being answered

- **6.1** While a question is being answered, the Dashboard shall show that it
  is waiting for that answer.
- **6.2** While a question is being answered, the Dashboard shall keep the rest
  of the application usable, including switching tenant and signing out.
- **6.3** When a person changes a composition while an earlier one is still
  being answered, the Dashboard shall show only the answer to the latest
  composition.

### 7. Refusals about the question

- **7.1** If the platform refuses a question because it named something the
  platform does not offer, the Dashboard shall say that the question could not
  be answered and shall not present the refusal as the person's mistake.
- **7.2** If the platform refuses a question because its answer would be larger
  than the platform returns, the Dashboard shall say so, name the limit, and
  suggest narrowing the period or asking for fewer groupings.
- **7.3** If the platform refuses because the person has asked too many
  questions too quickly, the Dashboard shall say how long to wait and shall not
  ask again until that time has passed.
- **7.4** If the platform reports that analytics cannot be answered at the
  moment, the Dashboard shall say so in the analytics views and shall leave the
  rest of the application usable.
- **7.5** The Dashboard shall not show, in any refusal, detail the platform did
  not intend a person to read — such as a location, a statement, or an
  identifier belonging to another tenant.

### 8. Figures the Dashboard does not make

- **8.1** The Dashboard shall show only figures the platform returned, and shall
  not derive a figure of its own — a total, an average, a difference — from the
  rows of an answer.

### 9. What this feature expects of the platform, and does not own

- **9.1** The Dashboard shall depend on the platform to answer a composed
  question for a tenant — measures, groupings, a period and a moment to read by
  — with rows, the moment they are complete through, and whether they were
  prepared.
- **9.2** The Dashboard shall depend on the platform to tell apart a tenant whose
  data was never exported from a period with nothing recorded, and shall not
  infer either from an empty answer.
- **9.3** The Dashboard shall treat the platform as the only authority on which
  measures and groupings exist and what they are called, and shall define no
  metric and no name of its own.
- **9.4** The Dashboard shall treat who may see a tenant's analytics as the
  platform's decision, and shall rely on nothing it hides or omits as
  protection.
- **9.5** The Dashboard shall treat when data is exported, and when a prepared
  answer is rebuilt, as outside its control, and shall offer no control over
  either.

### 10. Deliberately excluded

Stated so that the boundary is not misread as an oversight:

- **10.1** The Dashboard shall obtain analytics only by asking composed
  questions, and shall not use the platform's earlier way of answering movement
  history, so that there is one analytical contract rather than two to keep in
  step.
- **10.2** The Dashboard shall provide no way to change data from the analytics.
  They are read-only; inventory is written by machine clients elsewhere.
- **10.3** The Dashboard shall provide no way to trigger an export or a rebuild
  of what is prepared.
- **10.4** The Dashboard shall present no figure as real-time. An answer is as
  current as the last export, and the Dashboard states that rather than hiding
  it.
