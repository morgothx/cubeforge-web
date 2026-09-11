# Implementation Tasks — dashboard-analytics

Ordering follows Foundation → Core → Integration → Validation. Task N implicitly
depends on everything before it; `_Depends:_` marks only non-obvious or
cross-group dependencies. `(P)` marks tasks safe to run concurrently with their
immediate peers.

The order is the design's argument restated.

1. **The contract and the harness come first.** Every later test meets the
   platform through them.
2. **Next, the pure modules.** They decide what may be asked, how an answer is
   read, and whether it may be drawn, and they are tested without a screen.
3. **Only then the components that render.** They are built on decisions that
   already hold.
4. **The screens last.** A screen is where every earlier decision meets the
   others, which is why it cannot come first.

Two tasks are the ones this feature exists to get right. Both must be shown
failing before they are believed:

- **The chart plan's one-mark-per-row invariant** (2.4). A chart that drops a
  row is the one failure nobody looking at it can see.
- **The discarded late answer** (5.4). An answer from the tenant the person
  just left must never reach the screen.

The vocabulary route this feature consumes exists in `cubeforge-api`
(`analytics-vocabulary`, validated GO on 2026-09-11). Its published body is
the one the design proposed, field for field.

## 1. Foundation

- [x] 1.1 Write down the platform's analytics shapes, and teach the harness to
      answer them
  - The vocabulary, the question body and the answer are recorded as the
    platform sends them. Names are plain strings, because a union of names
    would be the copy of the vocabulary this design exists not to keep. The
    grouping shape and `servedFrom` are closed unions, because each member
    renders differently.
  - The harness gains the vocabulary route and the question route, with
    fixtures in the platform's real forms:
    - measures arrive as decimal strings;
    - days arrive as the engine's `YYYY-MM-DDT00:00:00.000`;
    - absence arrives as `null`;
    - the fixture vocabulary is the API's published body.
  - The question handler refuses an unknown name with the platform's exact body
    and `field`, answers the overview's two compositions and a generic one, and
    can be told to answer `never-exported`.
  - Two refusal builders are added: one that paces a caller (`429` with a plain
    `Retry-After`) and one that says the answer is unavailable (`503` carrying
    a `reason`). The mock shapes stay in one place per endpoint.
  - Done when a harness test drives both routes through the real request path.
    It must show that:
    - requests to each route can be counted;
    - the fixture vocabulary equals the body `cubeforge-api` publishes, copied
      from its literal contract test.
  - _Requirements: 9.1, 9.2_
  - _Boundary: Types, test harness_

- [x] 1.2 Carry the platform's wait, and a refused name that blames nobody
  - `Retry-After` is read where every other response detail is read, and it
    reaches the `throttled` refusal as whole seconds. The value must be a
    positive integer. Absent, zero, a date or garbage carries nothing, and the
    credential sentence the shell already shows stays unchanged.
  - A new refusal kind says a question could not be answered because it asked
    for something the platform does not offer. It is worded so it is not the
    person's fault, and it quotes nothing back.
  - The request layer still retries only the wordless refusal, so a paced
    question is never retried.
  - Done when:
    - the refusal and request specs show the wait carried from the header, and
      every non-integer form ignored;
    - a forbidden-vocabulary scan keeps blame out of the new sentence;
    - a paced request is sent exactly once;
    - `RefusalNotice` is still the only caller of the words.
  - _Requirements: 7.1, 7.3, 7.5_
  - _Boundary: Refusal, request layer_

## 2. The analytics core — pure modules in `src/analytics/`

- [x] 2.1 Count days the way the platform does
  - A day type that is a real `YYYY-MM-DD` with no zone of its own, today in the
    platform's calendar, day arithmetic and an inclusive span.
  - Days and moments are formatted in the platform's calendar with the zone
    named. A moment is truncated to the minute, never rounded.
  - The architecture test gains the analytics layer, placed so it depends on
    the platform's types alone.
  - Done when the calendar spec shows:
    - at 2026-09-10T01:00Z, today in UTC is the 10th whatever the machine's
      zone, and the default period is 12 August to 10 September;
    - 14:59:59 formats as 14:59;
    - a module in the analytics layer importing a query fails the architecture
      test.
  - _Requirements: 2.5, 4.2, 4.4_
  - _Boundary: Calendar, architecture test_

- [x] 2.2 Decide whether a composition can be asked, wherever it came from
  - One check serves a person's draft, an address and a fixed composition
    alike, against the vocabulary. It reports every problem at once: no
    measure, a name not offered, an unreadable day, a reversed period, and a
    period longer than the vocabulary's own longest, with that limit named.
  - In an address, absent parts take their defaults. A part that is present but
    wrong is kept and reported, never replaced.
  - A checked composition is canonical: the vocabulary's order, no duplicates.
    It writes itself into an address and into a question body.
  - Done when the composition spec shows each problem alone and all together,
    absent parts defaulted, a wrong part kept, an exact round trip through the
    address, and one address for two spellings of the same question.
  - _Requirements: 3.1, 3.3, 3.4, 3.8, 3.9_
  - _Boundary: Composition_

- [ ] 2.3 Read an answer's rows, or refuse to
  - Not `(P)`: it reads the checked composition 2.2 defines.
  - Rows become typed cells, driven by each grouping's declared shape and
    columns. A product or location is read as its code and its current name.
  - A measure reads as a number, a finite decimal string or `null`. Anything
    else makes the answer unreadable, and it never becomes `0`. A day reads from
    its first ten characters, or the answer is unreadable.
  - A row missing an implied column is unreadable. Rows are reordered by their
    grouping cells and never altered.
  - Done when the reading spec shows `"6"` read as 6, `null` kept, and `""`,
    `"six"` and an object each making the answer unreadable rather than zero.
  - _Requirements: 3.5, 8.1_
  - _Boundary: Reading_

- [ ] 2.4 Decide whether an answer may be drawn, and draw every row or none
  - One plan per measure, from a read answer.
  - Drawable shapes:
    - one grouping of any shape, as its categories;
    - one day grouping and one other, with days as categories and the other as
      series.
  - Never drawn:
    - no grouping;
    - two days, two non-days, or three or more groupings;
    - an absent value;
    - a shared position;
    - any legibility bound exceeded.
  - Missing days are not filled, and nothing is stacked. The value axis carries
    only the extremes the answer returned, plus zero.
  - Done when the plan spec shows every rule, and when the invariant holds over
    a generated set of tables: in every drawn plan, every row is exactly one
    mark. The invariant must be shown failing when a plan drops a row.
  - _Requirements: 3.6, 3.7, 8.1_
  - _Boundary: Chart plan_

- [ ] 2.5 (P) Say everything that is not a refusal
  - One sentence per composition problem, never-exported, nothing recorded, the
    cumulative note, the two provenance phrases and the unreadable statement.
  - Nothing recorded never covers days the answer is not complete through. When
    the period runs past that moment, the sentence stops at it and says later
    data has not arrived. When the whole period is after it, the sentence says
    the data has not arrived.
  - Done when the wording spec shows:
    - never-exported and nothing-recorded are distinct, and neither contains
      the other;
    - both currency cases behave as above;
    - a scan rejects "live", "real-time", "real time", "up to date" and
      "latest".
  - _Requirements: 2.4, 3.3, 3.4, 4.2, 5.2, 5.3, 10.4_
  - _Boundary: Wording_

- [ ] 2.6 (P) Choose the overview's two questions in advance
  - On hand by product, and net quantity and movement count by recorded day and
    kind, both read by the recorded moment.
  - These are the only measure and grouping names in application source.
  - Done when the overview spec shows that:
    - both compositions pass the composition check against the fixture
      vocabulary;
    - a source scan finds no vocabulary name outside this module.
  - _Requirements: 2.1, 2.2, 2.3, 9.3_
  - _Boundary: Overview pair_

- [ ] 2.7 (P) Hold every question while the platform says to wait
  - One hold per caller across every tenant, because that is how the platform
    counts. It is set in seconds and reports the whole seconds left, and
    listeners hear when it changes.
  - The test setup releases it between tests, because it outlives renders on
    purpose.
  - Done when the hold spec shows, with fake timers, a hold counting down to
    zero, a second hold not shortening a longer one, and a release clearing it.
  - _Requirements: 7.3_
  - _Boundary: Hold, test setup_

## 3. The platform, asked

- [ ] 3.1 Ask the two routes, and reinterpret a name the platform refused
  - The vocabulary for a tenant, and a question for a tenant, both through the
    authorized request path with the tenant escaped into the path.
  - A `rejected` refusal whose field is `question` or `period` passes through
    with the platform's own message. Any other `rejected` refusal becomes
    `not-offered`, because the dashboard composed that question and the person
    cannot fix it.
  - Done when the endpoints spec shows each case, and a source scan finds no
    movements route anywhere in `src/api`.
  - _Requirements: 7.1, 7.2, 9.1, 10.1_
  - _Boundary: Endpoints_

- [ ] 3.2 Ask once per showing, per tenant, and never while held
  - The vocabulary is held for the session, keyed by tenant.
  - An answer is keyed by tenant and canonical question body:
    - it is never stale and discarded when its view leaves;
    - it is not asked again on focus or reconnect, and has no placeholder data;
    - it is enabled only with a composition and no hold;
    - a paced refusal sets the hold.
  - A hold hook reports the seconds left and re-renders once a second only while
    held. The keys join the existing key registry.
  - This task adds a hook-level test, which the design's file plan left to the
    screens. The screens still assert the same properties end to end.
  - Done when the hook test shows:
    - two consumers of one key make one request;
    - another tenant makes its own request;
    - a paced answer stops every request until the hold passes;
    - remounting after unmount asks again.
  - _Requirements: 1.2, 1.3, 2.7, 6.1, 6.3, 7.3_
  - _Depends: 2.7, 3.1_
  - _Boundary: Analytics queries, query keys_

## 4. What an answer looks like

- [ ] 4.1 (P) Show the rows as a table, and say how current they are
  - The table has one row per answer row. Day headers name the calendar. A
    product or location shows its code and its current name. An absent value
    renders as an absence with an accessible name, never as `0`.
  - Beside the table: complete-through, truncated to the minute with the zone
    named. Provenance follows it, smaller and muted, and is never a heading.
  - Done when component tests show the absence named rather than zero,
    provenance after complete-through in document order and not a heading, and
    the calendar in every day header.
  - _Requirements: 3.5, 4.1, 4.3, 4.4, 8.1_
  - _Boundary: AnswerTable, AnswerCurrency_

- [ ] 4.2 (P) Draw a plan as bars, and nothing else
  - One SVG rectangle per mark, each naming its row, with a title stating the
    category, the series and the value.
  - Bars sit on a zero baseline, and negative values go below it. The value
    axis carries only the plan's extremes. The chart lives in its own
    horizontally scrolling container.
  - Done when the chart spec shows the rectangle count equal to the mark count,
    a negative value below the baseline, and no number in the SVG other than
    the extremes and zero.
  - _Requirements: 3.6, 8.1_
  - _Boundary: AnswerChart_

- [ ] 4.3 (P) Compose a question, and choose a period
  - The composer offers exactly the vocabulary's measures, groupings and
    moments, in its order and by its names. It checks the draft on every
    change, shows every problem, and disables asking while there is a problem
    or a hold.
  - The period picker takes two days and checks them with the same function.
  - Done when component tests show:
    - the offered choices change when the fixture vocabulary does, with no code
      change;
    - asking is disabled for no measure and for a reversed or over-long period,
      with the longest period named;
    - asking is disabled while held.
  - _Requirements: 2.6, 3.1, 3.2, 3.3, 3.4_
  - _Boundary: Composer, PeriodPicker_

- [ ] 4.4 Render one composition in every state it can reach
  - It asks through the answer query and renders the states in the design's
    diagram:
    - problems, in the wording's sentences;
    - held, as a paced refusal carrying the seconds left;
    - waiting;
    - refused, with a retry for the unreachable kind only;
    - never exported, with no table and no chart;
    - unreadable;
    - empty, with its currency;
    - answered: table, a chart when the plan is drawn, currency, and the
      cumulative note for any such measure.
  - Done when component tests cover every state and show:
    - never-exported renders no `table` and no `svg` at all;
    - waiting gives way to the answer;
    - a `503` puts the retry inside the view;
    - no refusal renders a status, a body or a refused name.
  - _Requirements: 2.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 7.1, 7.2, 7.3, 7.4, 7.5_
  - _Depends: 2.4, 2.5, 3.2, 4.1, 4.2_
  - _Boundary: AnswerView_

## 5. The screens, the addresses and the navigation

- [ ] 5.1 Offer the analytics to every role, and keep the section when the
      tenant changes
  - Every tenant role may read analytics, and the permission table says so.
  - The navigation's analytics row becomes a link. It is not an exact match, so
    it stays current in the explorer.
  - The switcher sends each tenant to the same section and the same query.
  - The shell's tests that held the "Soon" row inert are rewritten to hold it
    to being a link for every role. The shell's design marks its own 10.3 as
    superseded by this feature.
  - Done when:
    - the permission table test covers the new permission;
    - the navigation test shows the link for admin, editor and viewer;
    - switching from one tenant's explorer address lands on the other's with the
      query intact.
  - _Requirements: 1.1, 1.2, 9.4_
  - _Boundary: Integration — permissions, routing primitives, SectionNav, AppLayout, TenantSwitcher_

- [ ] 5.2 Serve the overview
  - The overview address sits inside the tenant resolution. It reads its period
    from the address, or the default, joins it to the two fixed compositions,
    and renders one answer view each.
  - A chosen period is written into the address. An analytics sub-navigation
    offers Overview and Explore. The served-addresses commitment gains the
    address.
  - Done when the screen test shows:
    - both answers render with no interaction;
    - exactly two question requests are made per showing, and re-rendering,
      refocusing and re-choosing the same period add none, while leaving and
      returning adds two;
    - a chosen period reaches the address and both requests;
    - the on-hand note appears whenever on hand does.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - _Depends: 2.6, 4.3, 4.4, 5.1_
  - _Boundary: Integration — AnalyticsOverviewScreen, AnalyticsNav, route table_

- [ ] 5.3 Serve the explorer
  - The explorer address reads the composition with the address codec and
    checks it. A wrong address shows its problems and asks nothing. Asking in
    the composer pushes a new address, which is the only moment the draft
    becomes the composition. The served-addresses commitment gains the address.
  - Done when the screen test shows:
    - the offered choices are exactly the vocabulary's;
    - no measure and a bad period ask nothing, counted rather than inferred;
    - asking writes an address, and a fresh render of that address asks the
      same question;
    - two quick compositions, the first delayed, only ever show the second;
    - a pace refusal issues nothing while held, and one request when the hold
      passes.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9, 6.3, 7.3_
  - _Depends: 4.3, 4.4, 5.2_
  - _Boundary: Integration — AnalyticsExplorerScreen, route table_

- [ ] 5.4 Prove the analytics follow the tenant, and nothing else
  - A routing suite covers role reach, and tenant switching from the explorer.
  - The late answer:
    - tenant A's question is delayed;
    - the person switches to B;
    - A's answer is released;
    - no figure or label from A's fixture is ever in the document.
  - Refusals and liveness:
    - a `404` shows the shell's words;
    - an unreachable tenant in the address asks nothing;
    - with a question pending forever, switching tenant and signing out still
      work;
    - a `503` leaves the switcher, the navigation and the members screen usable.
  - Done when the suite passes, and when a probe that takes the tenant out of the
    answer's key turns the late-answer test red.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.10, 6.2, 7.4_
  - _Depends: 5.1, 5.3_
  - _Boundary: Routing tests_

## 6. Validation

- [ ] 6.1 Walk the whole journey, and hold the exclusions by scan
  - The journey test covers: sign in, the overview, the explorer, an asked
    composition, and another tenant.
  - Scans hold the exclusions:
    - no analytics module imports a mutation hook;
    - no route, endpoint or control triggers an export or a rebuild.
  - The steering layout records the new directories. The product steering
    records the two addresses. The design brief's stale sentence about the
    semantic layer is corrected.
  - Done when the journey passes and the four gates are clean: lint, typecheck,
    test, build. The test and file counts are recorded in the Implementation
    Notes.
  - _Requirements: 9.5, 10.2, 10.3, 10.4_

- [ ] 6.2 See it answer against the running platform
  - **Prerequisite:** a person who can sign in, holding a membership in a
    tenant whose movements have been exported. Arrange it with the platform's
    own tooling: provision the tenant and its first administrator, set a
    password through a setup token, record movements through the sync API, and
    run the export command. Never insert it into the database by hand, so the
    evidence is what a real tenant would see.
  - With `cubeforge-api`'s stack up, run the dashboard against the real API:
    - sign in;
    - open a tenant's overview and explorer;
    - compare what arrives with the harness fixtures: vocabulary body, row
      keys, measure and day forms, refusal bodies.
  - Measure what the design left open: whether on hand counts a movement
    recorded after the period ends. Do it through the platform's question
    route, with a period ending before a known later movement.
  - A difference between the fixtures and the real platform is recorded and
    fixed in the harness before anything else.
  - Done when both views have answered from the real platform. The comparison,
    and the on-hand measurement with its date and inputs, are recorded in the
    Implementation Notes.
  - _Requirements: 9.1, 9.2, 2.4_

## Implementation Notes

*Findings worth inheriting are recorded here as tasks complete.*

- **1.1** — **The request counter counts requests nobody handled.** It records
  on `request:start`, so an unhandled request, answered by the harness's 500
  policy, counts too. "Counts the analytics requests" passed before the routes
  existed. It now also asserts every counted request was answered `200`, and
  any later count assertion should do the same.

  The fixtures mirror the platform's forms: measures as decimal strings, days as
  `YYYY-MM-DDT00:00:00.000`, `null` for a period-bounded measure beside a
  cumulative one, and `reason: 'model-unreachable'`, a real reason
  `cube-client.ts` emits. The fixture vocabulary is the API's literal contract
  body, pinned in the harness test. Five probes bit:
  - vocabulary drift;
  - a numeric measure;
  - zero for null;
  - a missing `Retry-After`;
  - an opened `shape` union.

  A `@ts-expect-error` on an excess property must sit on the property's line,
  not the declaration's.
- **1.2** — **Sign-in keeps its sentence, verified rather than assumed.** The
  API's credential guard counts named buckets, and for those the throttler
  library emits only `Retry-After-sign-in-origin` and its siblings. The plain
  `Retry-After` is added by `BucketThrottlerGuard` alone, which is analytics and
  inventory. So a sign-in `429` carries no wait here, and the 900-second wording
  is unchanged. If the API ever adds the plain header to credentials, sign-in
  would state the exact wait instead, which would be an improvement rather than
  a regression.

  The negative guards ("carries no wait when the header says …") passed before
  the code existed. Probes accepting decimals and accepting zero each turned
  them red, so they are real. Six probes bit in all.
- **2.1** — **Moving the machine's zone in a test: `vi.stubEnv('TZ', zone)`.**
  Node honours `TZ` changes at runtime, and the stub is typed without Node,
  which `src/` is. `process.env` fails typecheck and lint here. The stub was
  verified to actually move local readings: this machine runs in Bogotá, and
  under the stub UTC read the 10th while Bogotá read the 9th. So the "whatever
  zone the machine is in" tests are not vacuous.

  `Intl` truncates to the minute; it does not round. `en-GB` writes September
  as "Sept" on current ICU, so assertions match `Sept?`. Five probes bit:
  - today read locally;
  - a day formatted locally;
  - a moment rounded;
  - an exclusive span;
  - the analytics layer importing a query, which the architecture test names.
- **2.2** — The default moment is `vocabulary.readBy[0]`, the platform's first,
  never a literal. `composition.ts` holds no vocabulary name, which 2.6's scan
  will enforce. An empty list parameter (`measures=`) reads as none chosen, not
  as a wrong name. The period's two ends default independently. Five probes
  bit:
  - only the first problem reported;
  - a wrong day replaced by the default;
  - typed order kept;
  - the longest period off by one;
  - the moment left out of the address.
