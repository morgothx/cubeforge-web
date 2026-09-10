# Research — dashboard-analytics

*Discovery type: light, with one escalation.* This feature extends a finished
shell. Routing, the session, the request layer, the refusal vocabulary, the
query client and the test harness all exist, and the job is to fit into them.
The escalation is the vocabulary. Nothing the platform exposes today says which
measures and groupings exist, and resolving that turned out to need a route in
`cubeforge-api`. That route is a prerequisite this feature states and does not
own.

## Scope of discovery

1. The modelled question route, read from source rather than from the
   requirements' summary of it.
2. What the shell already provides, and what it would have to change.
3. Where the explorer gets its vocabulary.
4. Whether charting is a solved problem worth adopting.
5. The risks the requirements imply but do not name.

---

## 1. The modelled question route, read from source

Verified in `cubeforge-api` on 2026-09-10, at `1354e92`, in
`analytics-questions.controller.ts`, `dto/analytics.dto.ts`,
`domain/semantic/{vocabulary,question,modelled-answer}.ts`,
`adapters/semantic/{member-mapping,cube-model}.ts`,
`domain-error.filter.ts`, `analytics-failure.filter.ts` and
`throttling-buckets.ts`.

### Request

`POST /tenants/:tenantId/analytics/questions` answers `200`, not `201`: it is a
read sent as a `POST` because its body carries lists.

| Field | Shape | Notes |
|---|---|---|
| `measures` | `string[]`, at least one | Refused at the edge when empty, and again in the domain |
| `groupings` | `string[]`, optional | Absent means one total row |
| `from`, `to` | `YYYY-MM-DD` | Inclusive, at most 366 days apart, `to` not before `from` |
| `by` | `'recorded' \| 'occurred'`, optional | Defaults to `recorded` |

The global pipe refuses any property nothing declares, so a body naming a
tenant is refused rather than ignored.

### Answer

```ts
type ModelledQuestionResponse =
  | {
      state: 'answered';
      completeThrough: string;             // ISO instant, UTC
      servedFrom: 'prepared' | 'exported-objects';
      rows: Record<string, string | number | null>[];
    }
  | { state: 'never-exported' };
```

**Finding: row keys are the platform's column names, not always the grouping
names.** The mapping is in `member-mapping.ts`:

| Asked for | Columns in each row |
|---|---|
| each measure | the measure's name |
| `recorded_day`, `occurred_day`, `kind` | the grouping's name |
| `product` | `product_code`, `product_name` |
| `location` | `location_code`, `location_name` |

So a client cannot turn a composition into row columns by echoing the names it
asked for. It needs to know that `product` contributes two columns, and which
of those two is the code.

**Finding: measures may arrive as strings.** On the emulator every column
arrives as `varchar`. The API's own integration suite reads measure values
through `Number(...)`. `valueOf` in `cube-model.ts` passes numbers and strings
through and turns only the empty string into `null`. The client must read a
measure as a number without guessing: a value that is neither a number nor a
decimal string makes the answer unreadable. It must never become a zero.

**Finding: a day arrives as the engine's timestamp for that day.** The value is
Cube's time-dimension format, `YYYY-MM-DDT00:00:00.000`, in the query's zone,
which the platform pins to UTC. `dialectFor` refuses any other zone. The client
reads the leading `YYYY-MM-DD` and nothing else.

**Finding: `null` is a real value.** A product with no movement in the period
still appears when it is asked alongside `on_hand_quantity`, with
`net_quantity: null`. That is measured in `semantic-questions.integration-spec`,
at "W-1 has no net quantity here at all". An absent measure is not zero, and
drawing it as zero would be a figure the platform did not return.

### Refusals

| Case | Status | Body | Wait signal |
|---|---|---|---|
| Shape wrong (the DTO) | `400` | `{statusCode, message: string[], error}` — **no `field`** | — |
| Unknown measure or grouping | `400` | `{statusCode, message, field}`; `field` is `measures`, `groupings` or `measures and groupings` | — |
| Period reversed or too long | `400` | `field: 'period'`, message names the limit | — |
| More than 5,000 rows | `400` | `field: 'question'`, message `question would answer with more than 5000 rows; narrow the period or ask for fewer groupings` | — |
| More than 10 questions per minute, per caller | `429` | Nest's throttler body | **`Retry-After: <seconds>`**, plain, set deliberately by `BucketThrottlerGuard` |
| Semantic layer or storage unavailable | `503` | `{statusCode, message: 'the answer is unavailable', reason}` | — |
| Not a member, a machine, or no such tenant | `404` | the one wordless body | — |

**Finding: the wait is on the wire and the client throws it away.**
`http.ts` classifies a `429` from its status and body. It never reads a header,
so `Retry-After` is dropped. Requirement 7.3 cannot be met without reading it.

**Finding: the over-bound refusal already says everything 7.2 asks for.** It
names the limit and suggests both remedies. The shell's `rejected` kind carries
the backend's message as written (shell requirement 8.2). So the client renders
7.2 without holding a copy of 5,000.

**Finding: the unknown-name refusal would be rendered as the person's
mistake.** `RefusalNotice` tints a `rejected` refusal and places it against a
field, because in the shell every `400` is about something the person typed.
Here an unknown name means the dashboard and the platform disagree about the
vocabulary, which requirement 7.1 forbids blaming on the person. It needs its
own kind.

**Finding: the `503` body carries `reason`, a closed set of words the API wrote
itself.** `classify` already discards everything but `message` and `field`, and
maps any `5xx` to `unreachable`. Nothing new is needed for 7.5 here.

### The calendar

Every day the platform counts is a UTC day. The watermark, the export
partition, the model's time dimensions and the dialect are all pinned to UTC,
and the dialect refuses any other zone rather than answering wrongly. A person
in Bogotá at 20:00 on the 9th is already in the platform's 10th. That is the
case requirement 4.4 exists for.

### On hand

`on_hand_quantity` is a `sum` with `rolling_window: trailing: unbounded`. The
API measures that it counts movements recorded **before** the period. With one
day as the period, a product that moved only the day before still shows its
whole on-hand. **Unmeasured:** whether it also counts movements recorded
*after* the period ends. A trailing window over a bounded date range should
stop at the range's end, but no test puts a movement after the period. The
design's wording claims only what is measured — see Risks.

---

## 2. What the shell provides, and what it has to give

| Shell piece | Used as is | Changed |
|---|---|---|
| `request`, the refresh-and-retry path | Yes | Passes `Retry-After` to `classify` |
| `Refusal`, `classify`, `describeRefusal` | Yes | `throttled` gains an optional wait; a `not-offered` kind is added |
| `RefusalNotice` | Yes | None. Retry stays offered for `unreachable` alone |
| Query client, retries off | Yes | None. Analytics queries set their own freshness per query |
| `TenantRoute`, `useSelectedTenant` | Yes | None. An unreachable tenant is caught before any question is asked |
| `permissions.ts` | Extended | `analytics:read`, all three roles |
| `SectionNav` | Changed | Analytics becomes a link. It was a disabled row marked "Soon" |
| `TenantSwitcher` | Changed | Keeps the section when switching tenant. It always went to `/members` |
| `AppRoutes`, `served-addresses.test` | Extended | Two addresses |
| `architecture.test` | Extended | One layer, `src/analytics/` |
| `test/handlers.ts` | Extended | Two routes, and two refusal builders |

**Finding: the switcher breaks requirement 1.2 as written.** Every row links to
`/t/<tenant>/members`. Switching from Acme's analytics to Globex's would land
on Globex's members, and the person would have to find the analytics again.

**Finding: three tests hold the "Soon" row to being inert.** They are in
`AppLayout.test.tsx` under "the analytics section". That was a commitment
frontend-shell made for its own requirement 10.3, "no metric, chart or
analytical query exists". This feature supersedes 10.3, and those tests are
rewritten rather than deleted: the row becomes a link for every role.

---

## 3. Where the vocabulary comes from

The API declares `MEASURES` and `GROUPINGS` in `domain/semantic/vocabulary.ts`
and exposes neither. The only place they reach a caller is the prose of the
unknown-name refusal.

| Option | Holds 3.2 "exactly those the platform answers" | Cost |
|---|---|---|
| Mirror in `src/api`, like `ROLES` | Only while in sync. A name the API **adds** is silently not offered | None upstream |
| Parse the refusal's prose | Breaks on any rewording | Obviously wrong |
| **A vocabulary route in `cubeforge-api`** | By construction | A small spec in the other repository, before the explorer can be finished |

**Decided by Camilo on 2026-09-10: the vocabulary route.** The mirror has
precedent in `ROLES`. But `ROLES` guards a UI hint, and requirement 9.3 makes
the platform the only authority on what exists. A list that can fall behind
without anything failing does not meet that. The requirements also framed the
dashboard as the vocabulary's first real consumer, the thing that turns its gaps
from theoretical to found. This is the first gap it found.

### What the route has to carry

Everything the client would otherwise hold as a copy of a platform fact:

- **The names**, measures and groupings (3.2).
- **Per grouping, what its columns are and what kind of thing it is.** A day, a
  plain category, or an entity labelled by code and name (3.5, 4.4). Without
  this, the row-key finding above forces the client to hard-code `product_code`.
- **Per measure, whether it counts movements from before the period** (2.4). Two
  answers belong to the platform here: that on hand behaves this way, and that no
  other measure does.
- **The moments a question may be read by** (3.1).
- **The longest period answered, in days** (3.4). It must be named *before* a
  question is asked, so the `400` cannot supply it.
- **The calendar days are counted in** (4.4).

**Deliberately not carried: the row bound.** The over-bound refusal already
names it (finding above). Carrying it twice would give the platform two places
to say 5,000.

The shape the design proposes is in `design.md` under "Upstream contract". The
API spec owns the route and may settle a different shape. If it does, that is a
revalidation trigger for this design, not a silent change.

### Consequences for sequencing

The web tasks can be written and run against MSW handlers for the proposed
shape. An explorer shown against the running stack cannot exist until the route
does. The honest order is: approve this design, specify and build the route in
`cubeforge-api`, then generate this feature's tasks against the settled shape.

---

## 4. Build vs. adopt

### Charting — **build one SVG bar chart**

Recharts 3, Chart.js through `react-chartjs-2`, visx and ECharts were
considered.

| Concern | Recharts | Chart.js | visx | Own SVG |
|---|---|---|---|---|
| Testable in jsdom | Needs `ResponsiveContainer` bypassed or `ResizeObserver` faked; jsdom has no layout | **No.** Canvas, and jsdom has none; marks cannot be counted | Yes, but it is primitives to assemble anyway | Yes: one element per mark |
| Requirement 3.7 "no chart omits or merges a row" | Asserting it means reaching into the library's output | Not assertable | Assertable | A mark per row is the component's contract |
| Requirement 8.1 "no derived figure" | Stacking, interpolated lines and computed ticks are defaults to switch off | The same | Nothing is default | Nothing to switch off |
| Bundle | Large for one chart shape | Large | Moderate | None |
| Theme | Props per series | Config per series | CSS | daisyUI tokens directly |

The requirements need one shape: bars on a zero baseline, grouped side by side
into series, over ordered categories that may be days. Negative values have to
work, because net quantity is signed. Every library above can draw it. None of
them helps with the parts that are actually hard here: the rule for when a chart
may be drawn at all (3.6, 3.7), and drawing nothing the platform did not return
(8.1). Adopting one would buy axes and tooltips and then spend effort turning
off the defaults — stacking, interpolation, computed ticks — that break 8.1.

**Rejected alternatives recorded:** Chart.js for testability, and Recharts and
ECharts for weight and for defaults that fight 8.1. visx comes closest, and is
rejected because its scales are the twenty lines this feature needs, not a
library's worth.

### Composition in the address — **build, on `react-router`'s search params**

This is a codec over `URLSearchParams`, with no schema library. The composition
has five fields. Validating them needs the vocabulary, which only arrives at
runtime, so a static schema would still hand off to hand-written checks.

### Countdown and hold — **build**

Holding questions until a `Retry-After` has passed is a timestamp and a ticker.
TanStack Query's `retryDelay` is the wrong tool: this design keeps retries off
at the query layer (shell 3.4), and 7.3 asks for no new question, not a delayed
one.

---

## 5. Generalizations found

1. **The overview is two compositions chosen in advance.** On hand by product,
   and net quantity and count by recorded day and kind, each over the overview's
   period. The same check, the same asking, the same rendering and the same
   refusals apply to both views. The explorer adds only a composer and an
   address codec.
2. **One check for every composition, wherever it came from.** A draft the
   person is composing (3.3, 3.4), an address someone opened (3.9) and a curated
   composition (2.1) are all checked by the same function against the same
   vocabulary. A curated composition the platform stopped offering is caught
   there, before any question is spent on it.
3. **The on-hand note is a property of a measure, not of a screen.** Requirement
   2.4 is written for the overview. The same misreading happens in the explorer
   the moment someone chooses `on_hand_quantity`. So the note is attached to any
   measure the vocabulary declares as counting from before the period, wherever
   it appears.
4. **Day labelling (4.4) and the default period (2.5) share one calendar.**
   "Today" is the platform's today, in the zone the vocabulary names. Otherwise
   a person west of UTC in the evening gets a default period that ends a day
   before the data does.

## 6. Simplifications applied

- **No abort signal on questions.** An abandoned answer is discarded by its key,
  which carries the tenant and the composition, and that is what 1.3 and 6.3
  need. Passing the signal buys nothing the key does not. Under StrictMode's
  mount-unmount-mount it would cancel and re-send, spending two of ten questions
  per minute in development. The question has already been spent on the server
  by the time it could be aborted anyway.
- **No placeholder data between compositions.** Keeping the previous answer on
  screen while the next is fetched is the usual polish. It is exactly what 1.2
  forbids across tenants, and what 6.3 makes ambiguous across compositions. The
  waiting state replaces the answer.
- **No draft in the address.** The address holds the composition that was
  *asked*, and the composer holds the draft. Writing every checkbox into the
  address would ask a question per click, and ten clicks a minute exhausts the
  allowance.
- **One chart shape.** Grouped bars. No lines, because a line between two days
  asserts a value on the days between them. No stacking, because a stacked bar
  shows a total nobody returned (8.1).
- **No totals row, no axis ticks.** The value axis is labelled with the largest
  and smallest values the answer returned, plus the zero baseline. Every figure
  on screen is one the platform sent (8.1).

## 7. Risks

- **The upstream route may settle a different shape.** Mitigated by stating the
  proposed contract as this design's expectation and listing it as a
  revalidation trigger. The web tasks isolate it in `types.ts` and one endpoint.
- **On hand after the period end is unmeasured.** The wording for 2.4 claims
  that on hand counts movements from before the period, which is measured. It
  does not claim it stops at the period's end. That should be measured against
  the running stack before the overview's evidence is taken. If on hand turns
  out to count past the end, it is a defect in the model, not in this feature.
- **Ten questions a minute is tight for a person exploring.** The overview
  spends two per showing and the explorer one per asked composition. Reloading
  the overview five times in a minute exhausts the allowance. That is the
  platform's decision (9.5 in spirit). The design's part is to spend nothing
  unasked (2.7) and to make the wait legible (7.3).
- **Measures as strings is an emulator artefact the client must survive.** It
  is read strictly, never coerced. If the production engine sends numbers, the
  reader accepts both.
- **A day value format change in the engine** would make every day
  unreadable. Reading the leading `YYYY-MM-DD` tolerates the time suffix
  disappearing. Anything else fails closed: the answer is reported unreadable,
  never mis-dated.

## 8. Gaps left for implementation

- The exact chartability bounds: the most categories on one axis and the most
  series in one group. They are legibility constants of the dashboard, and the
  first real answer is the right place to tune them.
- Whether the tenant landing at `/` should become the analytics overview. The
  requirements do not ask for it, so it stays on members.
- The wording of every sentence. The design fixes what each must and must not
  claim, and the words are written against those rules in the tasks.
