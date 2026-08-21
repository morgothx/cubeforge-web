# Design brief — the CubeForge dashboard

*Written 2026-08-20, for a design conversation. Everything below describes what
exists today and is verifiable in this repository; where something does not
exist yet, it says so.*

---

## 1. What the product is

CubeForge is a **multi-tenant SaaS analytics platform**. Customer organizations
— called *tenants* — record transactional data through an API, and their people
explore that data through this dashboard.

It is a **portfolio project**, built to demonstrate multi-tenancy, role-based
authorization and AWS-shaped architecture. Both repositories are public and are
meant to read as production code.

**What is built today is the shell around the analytics, not the analytics.**
There are no charts, no metrics and no queries yet: the semantic layer is
configured in infrastructure but has no models. Anyone designing this should
treat the current product as *the administrative core of a SaaS platform* —
identity, tenants, roles and membership — with a clearly marked space where the
analytics will later live.

## 2. Who uses it, and what they are actually doing

One person, one browser session, wearing up to three hats at once:

- **A member of one or more tenants.** They act *inside one tenant at a time*.
  Which tenant they are acting in is the single most important piece of context
  on the screen, and today it is a line of text that says `Acting in Acme as
  admin`.
- **A holder of a role, per tenant.** The same person can be an administrator of
  one tenant and a viewer of another. Their role decides what they may do — and
  it changes as they switch tenants, mid-session, without signing in again.
- **Optionally a platform operator.** A fact the platform records about them. It
  is displayed and it opens nothing. There are deliberately no operator screens.

The task they come to do today is: **see who is in this tenant, and change it**
— invite someone, change someone's role, revoke someone's membership.

## 3. The problem this design pass must solve

Looking at the current screen, a person cannot tell **what the platform is for
or what they are allowed to do here**. It renders correct information with no
hierarchy, no framing and no sense of place. Specifically:

- Nothing names the product or explains what a "tenant" is.
- The three identity facts (who you are, that you are an operator, which tenant
  you are acting in) sit in the same visual register as the page content.
- Switching tenants — the action that changes everything else on screen — is an
  unlabelled link in a list.
- The one table on the page carries a form, five columns and eleven controls
  with no grouping.
- Nothing indicates that this is one screen of a larger product, or that more is
  coming.

## 4. What exists to design

### The frame (present on every signed-in screen)

- The caller's email address
- A "Platform operator" fact, when true — **must not become a link or a button;
  there is nowhere for it to go**
- The tenant being acted in, and the role held there
- Links to the caller's other tenants
- Sign out

### Screens

| Address | What it is |
|---|---|
| `/sign-in` | Email + password. The only public screen. |
| `/t/:tenantId/members` | The members of one tenant. The only data screen today. |
| `/no-tenants` | A person who belongs to no tenant at all. |
| `*` | An address the product does not serve. |
| `/` | Not a screen — resolves to a tenant and redirects. |

### The members screen, in detail

A table of everyone in the selected tenant:

- **Email address** — present only when the backend disclosed it (administrators
  see it; everyone else does not). When withheld, **the column does not exist**.
- **Role** — `admin`, `editor` or `viewer`.
- **Status** — `Active` or `Revoked`. Revoked members stay in the list on
  purpose: they are part of the answer to "who is in this tenant".
- **Actions**, for administrators only: change a member's role, revoke a
  membership.

Above it, for administrators only: an **invite** form — an email address, a role
to grant, and a submit.

## 5. Rules the design must not break

These are not preferences. Each is a decision the product is built around, and
several are enforced by tests.

1. **Controls a role may not use are absent, never disabled.** A disabled
   control still says the action exists and that you are the problem. A viewer
   sees no actions at all — not greyed-out ones.
2. **Withheld data leaves no gap.** When the backend withholds email addresses,
   the column is gone entirely. A column of blanks would read as "these people
   have no address" or as data that failed to load. Both are false.
3. **Waiting never looks like emptiness.** "Nobody is here" and "not here yet"
   are different answers, and only one of them is a reason to invite someone.
   They need visibly different treatments.
4. **An empty or unavailable result is an ordinary answer, not an error.** The
   three dead-end screens — a tenant you can no longer reach, an address that
   does not exist, belonging to no tenant — must not look like crashes. No
   alarm colours, no "something went wrong", no retry where retrying is
   pointless.
5. **One voice for every outcome.** Every refusal is rendered by a single
   component. There are exactly five kinds:
   - a **rejection with a reason** — shown against the field at fault when the
     backend names one (the invite email field, most often)
   - **unavailable** — no cause is given, and none may be invented; the platform
     deliberately cannot tell "you may not" from "it does not exist"
   - **too many attempts** — wait
   - **could not reach the service** — the only one that offers a retry
   - **session ended** — sign in again
6. **A moment where nothing renders.** While a stored session is being restored,
   the product shows neither the sign-in form nor the application, so a returning
   person never watches a sign-in screen flash past. Whatever fills that moment
   must be able to appear and vanish without feeling like a glitch.
7. **Accessibility is already load-bearing.** The markup is semantic today —
   real `<table>`, `<form>`, `<nav>`, `<header>`, `<main>`, labels tied to
   inputs, `role="alert"` for refusals, `aria-describedby` linking an error to
   the field it blames. Tests assert these. **A design that requires replacing
   them with `<div>`s will fail the suite.**

## 6. Technical constraints

- **React 19 + TypeScript**, Vite build, React Router.
- **No CSS framework or component library is installed today**, and no styling
  exists beyond a 14-line reset. This is a blank slate — bringing in Tailwind or
  a component kit is an open decision, not a fait accompli.
- Ships as a **static SPA** (S3 + CloudFront). No server rendering.
- Dark background is what it happens to render today; nothing depends on it.

## 7. Deliberately not in the product

Do not design screens for these — their absence is asserted by a test:

- Provisioning tenants, or deactivating people
- Issuing setup tokens, or setting a password from one
- Managing API keys
- Any platform-operator area
- **Any metric, chart or analytical view** — this is the big one. It is where
  the product is going, and a design that leaves an obvious, honest place for it
  is more useful than one that pretends it is already there.

## 8. What a good outcome looks like

Someone who has never seen this should be able to answer, within a few seconds
of the first screen: *what is this product, which organization am I acting in
right now, what am I allowed to do here, and where does the rest of it live?*

And it should look like a product a company would pay for — because the point of
the whole exercise is that a reviewer reads it as production work.
