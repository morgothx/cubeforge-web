# Requirements — frontend-shell

## Project Description (Input)

### Who has the problem

- **Anyone who wants to see this project work.** Four backend features are
  implemented and every one of them is only reachable with `curl` and a
  hand-signed token. Half the portfolio has nothing to show, and the half that
  does show something is a test suite.
- **The reviewer the whole project is written for.** `cubeforge-api/CLAUDE.md`
  and `cubeforge-web/CLAUDE.md` both promise a UI that "reflects the current
  user's role (admin/editor/viewer) as returned by the backend" and hides
  actions the role cannot perform. Nothing in this repository does that yet, and
  a claim about RBAC that only a backend test demonstrates is a weaker claim.
- **The `caller-identity` feature itself.** `GET /me` was built because a client
  that has just signed in cannot render a navigation bar or choose a tenant. It
  has no client. Its whole justification is unexercised.
- **Whoever writes the next screen.** There is no session, no router, no place
  where a request is shaped, and no answer to "what happens when the access
  token expires mid-click". Every one of those is cheaper decided once than
  retrofitted into the third screen that needed it.

### Current situation

`cubeforge-web` is a scaffold. It has a toolchain — Vite 8, React 19, Vitest,
ESLint with type-checked rules — proven by one test against a placeholder
heading, and nothing else. There is no `src/api`, although the linter already
forbids `fetch` anywhere but there.

The backend it will talk to is complete for this purpose and its shape is
already decided, which is what makes this a thin slice rather than a design
exercise:

```
POST /auth/sign-in                                200 {accessToken, refreshToken, sessionExpiresAt}
POST /auth/refresh                                200 the same shape, and the old refresh token dies
POST /auth/sign-out                               204
GET  /me                                          200 {personId, email, isOperator, memberships[]}
GET  /tenants/:tenantId/members                   200 any member
POST /tenants/:tenantId/members                   201 admin
PATCH /tenants/:tenantId/members/:membershipId    204 admin
DELETE /tenants/:tenantId/members/:membershipId   204 admin
```

**Four properties of that backend constrain this feature more than any UI
decision will:**

1. **A token names a person and nothing else** — `{sub, iss, exp}`, deliberately.
   No tenant, no role. So the client cannot learn anything about standing by
   decoding a credential; it has to ask, and `GET /me` is the only route that
   answers. The access token expires in fifteen minutes.
2. **Refusals come in two kinds, and only one of them can be explained.**
   Authorization and absence collapse into a byte-identical `404` — no
   credential, wrong role, wrong tenant, and a genuinely missing record are
   indistinguishable on purpose, so that one customer cannot confirm another's
   records by probing. **For those, the UI cannot diagnose anything**, and the
   one plausible-looking guess — "your session expired" — is wrong most of the
   time. Rejected input (`400`) and conflicts (`409`) are the other kind: they
   carry a message written to be shown, and sometimes the field at fault. Too
   many sign-in attempts answer `429`. Treating all of these as one thing would
   either invent reasons the platform refuses to give, or throw away the ones it
   does.
3. **Standing is read per request and never carried in a credential.** A role
   change, a revoked membership and a deactivated tenant each show up in the
   next answer with the credential unchanged. A client that reads `GET /me` once
   at sign-in and caches it for the session throws away the property the backend
   was built to have.
4. **`GET /tenants/:tenantId/members` withholds email addresses from everyone
   but an administrator of that tenant.** So the difference between roles is
   visible in the data, not only in which buttons are enabled — which makes the
   members screen the one worth building first.

### What should change

**A person can sign in, and the application knows where they may act.** Address
and password buy a session; the session is exchanged for standing; the standing
decides what the person sees. Signing out ends it.

**The session survives a page reload.** The refresh token is kept in
`localStorage` and the access token only in memory, so a reload recovers the
session without the longer-lived credential ever being the one held in a
variable a stale render might close over. This is a deliberate trade-off and
belongs in the design: a SPA served from S3 cannot use an `httpOnly` cookie the
way a same-origin server-rendered app would, so the exposure to XSS is accepted
and named rather than pretended away.

**An expired access token is invisible to the person using the app.** Fifteen
minutes is short enough that it will happen mid-session, routinely. The client
refreshes and retries once; if the refresh fails, the session is over and the
person is returned to signing in.

**Navigation reflects the caller's standing.** A person who belongs to several
tenants chooses one. The role held in that tenant decides what the navigation
offers, and an action the role cannot perform is not presented — while the code
still handles the backend refusing it anyway, because this layer is UX and the
guard is the boundary.

**One real screen: the members of the selected tenant.** All three roles reach
it and see something different. A viewer and an editor see the list without
addresses and no way to change it; an administrator sees addresses, can invite a
member, change a role, and revoke a membership. That is the RBAC claim made
visible in a way a backend test cannot make it.

**Everything that talks to the backend lives in `src/api`,** which the linter
already enforces. The access token, the refresh-and-retry, and the fact that
every refusal looks the same are three things that must exist exactly once.

### Deliberately out of scope

- **The operator's platform screens.** `isOperator` is read and shown, because
  it is part of the caller's standing, but it opens nothing yet. Provisioning
  tenants and issuing setup tokens belong to a later feature; putting them here
  would double the routing and layout work in the first feature this repository
  has ever had.
- **API key management**, for the same reason, and because only administrators
  can see it at all — a screen that shows two of the three roles nothing does
  not demonstrate role-awareness.
- **Any analytics, chart, or Cube.dev query.** That is `dashboard-frontend`.
  This feature exists to make one screen reachable, not to make it interesting.
- **Redeeming a setup token.** A person acquires a password through a token an
  operator issues, and that flow has no UI here yet; the fixtures for the demo
  can be arranged through the API.
- **Visual design.** A readable, plain layout. Styling decisions that are not
  load-bearing for role-awareness are not this feature's business.

---

## Requirements

The subject of every criterion below is **the Dashboard**, meaning this
application as a person using a browser experiences it. Where a criterion says
"the backend", it names an adjacent system this feature depends on and does not
own; those expectations are collected in section 9.

### 1. Signing in

- **1.1** When a person submits an email address and a password that the backend
  accepts, the Dashboard shall establish a session and show them the application
  rather than the sign-in form.
- **1.2** If the backend refuses the credentials, the Dashboard shall report that
  the address and password did not match, and shall say nothing about which of
  the two was wrong or whether the address is known to the platform.
- **1.3** If the backend reports that too many attempts have been made, the
  Dashboard shall tell the person to wait before trying again, distinctly from
  reporting a wrong password.
- **1.4** While a sign-in attempt is in flight, the Dashboard shall show that it
  is waiting and shall not accept a second submission of the same form.
- **1.5** If the address or the password is empty, the Dashboard shall say so
  without sending a request.
- **1.6** The Dashboard shall never display, log, or retain a password after the
  attempt it was submitted for has completed.

### 2. A session that outlives the page

- **2.1** When a person reloads the page or opens the application again in the
  same browser after signing in, the Dashboard shall restore their session
  without asking for the password again.
- **2.2** While a session is being restored, the Dashboard shall show neither the
  sign-in form nor a signed-in view, so that a restored session never flashes
  past a sign-in screen the person did not need.
- **2.3** If the stored session can no longer be exchanged for access, the
  Dashboard shall discard it and show the sign-in form.
- **2.4** When a person signs out, the Dashboard shall end the session with the
  backend, discard everything it retained about them, and show the sign-in form.
- **2.5** While no session exists, the Dashboard shall show the sign-in form for
  any address a person navigates to, and shall retain the address they were
  trying to reach.
- **2.6** When a session is established after 2.5, the Dashboard shall take the
  person to the address they were trying to reach rather than to a default one.

### 3. Access that expires without the person noticing

- **3.1** When a request fails because the access it carried has expired, the
  Dashboard shall obtain fresh access and retry that request once, and the
  person shall see only the result.
- **3.2** If the retry in 3.1 fails, the Dashboard shall end the session and show
  the sign-in form, and shall report that the person needs to sign in again.
- **3.3** While fresh access is being obtained, the Dashboard shall hold every
  other request that needs it until it is available, so that several requests
  expiring together end one session rather than several.
- **3.4** The Dashboard shall not retry a request that was refused for any reason
  other than expired access.

### 4. Knowing where the caller may act

- **4.1** When a session is established or restored, the Dashboard shall obtain
  the caller's standing — their own address, whether the platform records them
  as an operator, and every tenant they can currently reach with the role held
  in each — before showing anything that depends on it.
- **4.2** The Dashboard shall display the caller's own email address, and shall
  display whether the platform records them as an operator.
- **4.3** While a person holds no membership anywhere, the Dashboard shall say so
  plainly and offer signing out, and shall not present it as an error or as a
  failure to load.
- **4.4** The Dashboard shall obtain the caller's standing afresh rather than
  reusing an answer from a previous session, so that a role changed between
  sessions is the role shown.
- **4.5** When the person changes their own role or revokes their own membership
  in the selected tenant, the Dashboard shall obtain their standing again rather
  than continue from the answer it already had.

### 5. Choosing a tenant

- **5.1** While the caller can reach exactly one tenant, the Dashboard shall
  select it without asking.
- **5.2** While the caller can reach more than one tenant, the Dashboard shall
  let them choose which one they are acting in, and shall show which one is
  selected at all times.
- **5.3** When a person changes the selected tenant, the Dashboard shall show
  that tenant's data and the navigation their role in *that* tenant permits.
- **5.4** When a session is restored, the Dashboard shall restore the tenant that
  was selected when the person last used it.
- **5.5** If the tenant restored under 5.4 is no longer among those the caller can
  reach, the Dashboard shall behave as though none had been selected and shall
  say that the previous selection is no longer available.

### 6. Navigation that reflects the role

- **6.1** The Dashboard shall offer only the destinations the caller's role in
  the selected tenant permits, and shall not present an action that role cannot
  perform — neither enabled nor disabled.
- **6.2** If a person reaches an address their role does not permit — by typing
  it, by a stale link, or by a role that changed since the page loaded — the
  Dashboard shall show them that it is unavailable and offer a destination they
  can reach.
- **6.3** If the backend refuses an action the Dashboard had offered, the
  Dashboard shall handle that refusal as an ordinary outcome rather than as an
  impossible one — a role can change between rendering a control and using it,
  and hiding a control is a convenience, never the reason an action is safe.
- **6.4** Where the caller is recorded as a platform operator, the Dashboard shall
  show that fact and shall offer no additional destination on account of it.

### 7. The members of the selected tenant

- **7.1** When a person opens the members of the selected tenant, the Dashboard
  shall list each member with the role they hold and whether their membership is
  currently active.
- **7.2** While the caller is an administrator of the selected tenant, the
  Dashboard shall show each member's email address; while they are not, it shall
  present the list without addresses and shall not leave a blank where an
  address would be, so that a viewer is not left wondering whether the data
  failed to load.
- **7.3** While the caller is an administrator of the selected tenant, the
  Dashboard shall let them invite a person by email address with a role, change
  an existing member's role, and revoke a membership.
- **7.4** While the caller is not an administrator of the selected tenant, the
  Dashboard shall offer none of the actions in 7.3.
- **7.5** When one of the actions in 7.3 succeeds, the Dashboard shall show the
  list as it now stands without the person having to reload the page.
- **7.6** If the backend rejects one of the actions in 7.3 with a reason — the
  person is already a member, the tenant would be left with no administrator, the
  role is not one that exists — the Dashboard shall show that reason, against the
  field at fault when the backend names one.
- **7.7** If the backend refuses one of the actions in 7.3 without a reason, the
  Dashboard shall say that the action is not available and shall not invent an
  explanation.
- **7.8** While one of the actions in 7.3 is in flight, the Dashboard shall show
  that it is waiting and shall not submit the same action twice.

### 8. Telling the person what happened

- **8.1** If the backend answers a refusal that carries no reason, the Dashboard
  shall report that the thing is unavailable and shall claim no cause — in
  particular it shall not say that the session expired, that permission is
  missing, or that a record does not exist.
- **8.2** If the backend answers a refusal that carries a reason, the Dashboard
  shall show that reason as written rather than replacing it with wording of its
  own.
- **8.3** If a request cannot reach the backend at all, the Dashboard shall say
  that the service could not be reached and shall offer to try again, distinctly
  from a refusal.
- **8.4** While any view is waiting for the backend, the Dashboard shall show that
  it is waiting, and shall not present an empty result as though it were the
  answer.
- **8.5** The Dashboard shall never display a correlation identifier, a stack
  trace, or a raw response body to the person using it.

### 9. What this feature expects of the backend, and does not own

- **9.1** The Dashboard shall treat authorization as the backend's decision:
  every rule about who may do what is enforced there, and nothing the Dashboard
  hides, disables, or omits is relied upon as protection.
- **9.2** The Dashboard shall take from a credential nothing but the fact that a
  session exists, and shall ask the backend for who the caller is and where they
  may act.
- **9.3** The Dashboard shall depend on the backend answering the caller's
  standing with only the tenants that currently grant access, and shall not
  filter that answer itself.
- **9.4** The Dashboard shall depend on the backend making authorization refusals
  indistinguishable from absence, and shall be written so that this cannot be
  mistaken for a defect to be worked around.

### 10. Deliberately excluded

Stated so that the boundary is not misread as an oversight:

- **10.1** The Dashboard shall provide no screen for provisioning tenants,
  issuing setup tokens, or deactivating people, although a platform operator may
  do all three through the backend.
- **10.2** The Dashboard shall provide no screen for managing a tenant's API
  keys.
- **10.3** The Dashboard shall provide no metric, chart, or analytical query.
- **10.4** The Dashboard shall provide no way to set a password from a setup
  token; a person arrives at this application already able to sign in.
