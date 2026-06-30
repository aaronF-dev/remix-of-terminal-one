# Terminal One — Financial Intelligence OS

Developed & designed by **Aaron Fernandes**.
Version 2.0 · Phase II · Live market intelligence layer.

---

## 1. What is Terminal One?

Terminal One is a Bloomberg-grade, AI-native financial intelligence terminal that
runs in your browser. It pulls fresh market data, news, and macro signals in real
time, then routes them through a fleet of specialized AI agents (fundamental,
technical, macro, risk, sentiment, quant, narrative, catalyst) to produce
explainable, timestamped reasoning on any asset.

It is not a chatbot bolted to a price chart. It is a modular intelligence layer:
data ingestion, AI reasoning, search, research workspace, notifications, users
and analytics — each behind a clean interface so any provider, model or source
can be swapped without touching the UI.

The product is for serious retail traders, analysts, students of the market and
operators who want an institutional cockpit without the institutional price tag.

---

## 2. Core Promise

- **Never stale.** Every AI response is generated from freshly fetched data and
  carries the timestamp of the data it used.
- **Always explainable.** Every score, signal and verdict shows its sources,
  its reasoning and its confidence.
- **Modular by design.** Replace any provider, model or data source without
  changing the UI or business logic.
- **Persistent research.** Every analysis, comparison and agent run is stored
  to the user's account in Firestore and is fully re-openable, never re-run.

---

## 3. Feature Map

### 3.1 Markets (Home)
A live, scannable grid of crypto + equities. Each row shows price, % change and
a sparkline-grade pulse. Click any symbol to deep-analyze it. Powered by
CoinGecko (crypto) and Yahoo Finance (equities) via the data ingestion service.

### 3.2 AI Reasoning — /analyze/:symbol
A full-page reasoning view for a single asset.
- Quote header: live price, change, volume, market cap, fetched-at timestamp.
- Price chart: historical series rendered with Recharts.
- AI verdict: directional bias, conviction, time horizon.
- Drivers & risks: bullet-pointed catalysts and red flags.
- Source list: every URL the model leaned on.
- Saved automatically to Research with the full payload (not a re-run).

If a user opens `/analyze` without a symbol, they get a friendly landing that
redirects them to Markets to pick one — no 404.

### 3.3 Compare — /compare
Side-by-side AI comparison of 2–4 assets across dimensions: momentum,
fundamentals, risk, sentiment, technical setup, catalysts. Output is rendered
as scored bars + a verdict panel + a recommended allocation tilt. Saved to
research as a full payload.

### 3.4 Market Pulse — /pulse
A macro snapshot: indices, FX, commodities, yields, fear/greed, sector
rotation, top movers. Produced by the AI macro service from aggregated feeds.

### 3.5 Company DNA — /dna/:symbol
A scoring breakdown of a single company: business model, moat, growth quality,
financial health, management, valuation, narrative. Each axis is scored 0–100
with a one-line justification.

### 3.6 Opportunity Radar — /radar
AI-driven screening. The model scans the universe for setups matching themes
(breakouts, oversold reversals, narrative shifts, earnings drift, macro
beneficiaries) and surfaces ranked ideas with reasoning.

### 3.7 News Intel — /news
Aggregated headlines across 16 market-relevant categories (equities, crypto,
macro, rates, FX, energy, tech, AI, semis, biotech, banks, geopolitics,
regulation, M&A, earnings, commodities). Sources include Google News RSS and
Hacker News Algolia, deduped by URL. Each headline can be expanded into an
AI explainer: what happened, why it matters, who's affected.

### 3.8 AI Agents — /agents
The flagship. Eight specialized agents, each with its own prompt, schema and
custom UI renderer:

1. **Fundamental Analyst** — financials, margins, growth, balance-sheet quality.
2. **Technical Analyst** — trend, support/resistance, momentum, patterns.
3. **Macro Strategist** — rates, liquidity, cycle positioning, regime.
4. **Risk Officer** — volatility, drawdown, tail risks, position sizing.
5. **Sentiment Analyst** — narrative, crowd positioning, social pulse.
6. **Quant** — factor exposure, statistical edges, mean-reversion signals.
7. **Narrative Tracker** — story arcs, catalysts, attention flows.
8. **Catalyst Scout** — upcoming events, earnings, regulatory triggers.

Flow: pick a stock → enable one or more agents → deploy. Agents run
sequentially, each rendering into its bespoke layout (not a generic JSON
dump). Every run is auto-saved to Research with the full payload.

### 3.9 Research Workspace — /research and /research/:id
Cloud-synced history of everything you've ever run. Three sections:
Analyses · Comparisons · Agent Runs. Click any entry to reopen the exact saved
view — charts, agent renderers, sources, timestamps — without re-calling the AI.

### 3.10 Ask Anything
A free-form intent router. The user types a question; an intent classifier
decides whether it needs analysis, comparison, news lookup, macro context or
direct answer, then routes accordingly.

### 3.11 Authentication
Firebase Auth — email/password and Google. A clean split-screen sign-in page
with a live market-chart illustration on the brand panel. All routes are gated
by an AuthGate that redirects unauthenticated users to /login.

---

## 4. User Flow

1. **Land on /login.** Sign in with email/password or Google. New users tap
   "Create one" to register.
2. **Hit Markets.** Scan the live grid; everything is timestamped.
3. **Pick a symbol.** Either click into AI Reasoning, drop it into Compare,
   feed it into Agents, or view its Company DNA.
4. **Run intelligence.** Each tool returns a fully rendered, timestamped,
   source-cited view.
5. **Everything is saved.** Open Research at any time to reload any past
   analysis, comparison or agent run exactly as it was generated.
6. **Stay informed.** News Intel and Market Pulse keep the macro/headline
   context flowing alongside whatever you're researching.

---

## 5. Architecture

Terminal One is a modular system of specialized services communicating through
well-defined interfaces. The frontend never talks to a provider directly.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + TS)                 │
│  Markets · Analyze · Compare · Pulse · DNA · Radar · News   │
│  Agents · Research · Ask · Auth                             │
└─────────────────────────────────────────────────────────────┘
                              │
                  TanStack Start server functions
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (server)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │ Data Ingestion │  │ AI Reasoning   │  │ Search       │   │
│  │ market · news  │  │ analyze · dna  │  │              │   │
│  │ sentiment      │  │ compare · agents│ │              │   │
│  └────────────────┘  └────────────────┘  └──────────────┘   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │ Research       │  │ Notifications  │  │ Users        │   │
│  │ (Firestore)    │  │                │  │ (Firebase)   │   │
│  └────────────────┘  └────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│           External providers (swappable adapters)            │
│  CoinGecko · Yahoo Finance · Google News RSS · HN Algolia   │
│  Lovable AI Gateway (Gemini · GPT · Claude)                 │
│  Firebase Auth · Firestore                                  │
└─────────────────────────────────────────────────────────────┘
```

### Key principles
- **Provider isolation.** Each upstream API sits behind an adapter in
  `src/lib/services/*.server.ts`. Swap CoinGecko for Coinbase without
  touching a single component.
- **Unified schema.** `Quote`, `NewsItem`, `DataEnvelope<T>` types in
  `src/lib/services/types.ts` — every payload carries a `fetchedAt`.
- **Server-only secrets.** All API keys live in server functions. The browser
  never sees them.
- **Strict schemas.** AI responses are validated with Zod; malformed JSON is
  repaired by an extractor before validation so the UI never crashes on a
  bad model output.

---

## 6. System Design

### 6.1 Data Ingestion Service
- **Market data**: CoinGecko (crypto quotes + historical series) and Yahoo
  Finance (equities quotes + historicals).
- **News**: Google News RSS across 16 curated categories + Hacker News
  Algolia. XML is parsed server-side; URLs are deduped; up to 80 headlines.
- **Sentiment**: derived from headline language and social-style sources.
- All responses are wrapped in `DataEnvelope<T>` with `fetchedAt`.

### 6.2 AI Reasoning Service
- Driven by the Lovable AI Gateway (Gemini 2.x / GPT / Claude — swappable).
- Each capability (`analyzeSymbol`, `compareSymbols`, `getMarketPulse`,
  `getCompanyDNA`, `runOpportunityRadar`, `explainNews`, agent runners)
  is its own `createServerFn` with its own Zod schema and prompt.
- JSON output is hardened by an `extractJson` utility that strips markdown
  fences and salvages partial output before Zod parsing.
- Every response carries the data timestamp it reasoned over.

### 6.3 Agents Service
Each of the 8 agents is an independent server function with:
- a focused system prompt scoped to its discipline,
- a per-agent Zod output schema,
- a custom React renderer on the client so the output never looks generic.

The orchestration layer runs them sequentially and streams results into the
UI as they complete.

### 6.4 Research Workspace Service
- Backed by Cloud Firestore at `users/{uid}/research/{id}`.
- Each entry stores: kind (analysis | comparison | agent_run), symbol(s),
  title, createdAt, and the **full payload** that produced the view.
- The client subscribes via `onSnapshot` for real-time sync across tabs/devices.
- Reopening an entry rehydrates the exact view — no AI re-call.

### 6.5 Auth & User Service
- Firebase Authentication (email/password + Google OAuth).
- An `AuthGate` in `__root.tsx` redirects unauthenticated traffic to
  `/login`. Authenticated user state flows through a React context
  (`auth-context.tsx`).
- The user chip in the header reflects displayName / email and exposes logout.

### 6.6 Notification & Analytics Services
Stubs in place to plug alerting (price/news triggers) and product analytics
without touching the UI.

---

## 7. Tech Stack

**Frontend**
- React 19, TypeScript (strict)
- TanStack Start v1 (file-based routing, server functions, SSR-ready)
- TanStack Router + TanStack Query
- Tailwind CSS v4 (semantic design tokens; dark terminal aesthetic)
- Recharts (price + comparison charts)
- Lucide icons

**Backend / runtime**
- TanStack server functions running on an edge worker runtime
- Zod for schema validation
- Lovable AI Gateway as the model router

**Data**
- Firebase Authentication
- Cloud Firestore (per-user research)
- CoinGecko, Yahoo Finance, Google News RSS, Hacker News Algolia

**Tooling**
- Vite 7 build pipeline
- Bun package manager
- ESLint + TypeScript strict mode

---

## 8. Design System

- **Aesthetic**: Bloomberg-grade dark terminal. Dense, monospaced-feeling,
  high-contrast.
- **Accent**: amber — used sparingly for the primary action and live signal.
- **Tokens**: every color, surface, border and shadow is a semantic CSS
  variable in `src/styles.css`. No hardcoded hex values in components.
- **Typography**: tight uppercase tracking on labels and chrome; clean
  sans-serif for body and numbers.
- **Motion**: minimal. A pulse-dot for live state. No decorative animation.
- **Responsiveness**: full device coverage — sidebar collapses into a
  hamburger drawer on mobile; grids reflow to single columns; headers
  progressively hide non-essential chrome.
- **Scrollbars**: globally hidden while keeping native scroll behavior.

---

## 9. Security

- Auth is enforced at the router level via the AuthGate.
- Firestore rules scope every document to `users/{uid}/...` so users can
  only ever read/write their own research.
- No API keys are exposed to the client; every upstream call is proxied
  through a server function.
- Schema validation on every AI response prevents prompt-injection payloads
  from reaching the UI as executable structures.

---

## 10. Project Structure (high level)

```
src/
├─ routes/                  TanStack file-based routes
│  ├─ __root.tsx            Shell, AuthGate, providers
│  ├─ index.tsx             Markets (home)
│  ├─ analyze.$symbol.tsx   AI Reasoning view
│  ├─ analyze.index.tsx     /analyze landing (no-symbol guard)
│  ├─ compare.tsx           Multi-asset comparison
│  ├─ pulse.tsx             Macro pulse
│  ├─ dna.$symbol.tsx       Company DNA
│  ├─ radar.tsx             Opportunity Radar
│  ├─ news.tsx              News Intel
│  ├─ agents.tsx            8-agent cockpit
│  ├─ research.tsx          Research list
│  ├─ research.$id.tsx      Saved-result viewer
│  ├─ ask.tsx               Ask Anything
│  ├─ login.tsx / signup.tsx
├─ components/
│  ├─ app-shell.tsx         Responsive sidebar + header
│  └─ about-dialog.tsx      In-app About modal
├─ lib/
│  ├─ firebase.ts           Auth + Firestore clients
│  ├─ auth-context.tsx      React auth context
│  ├─ research-history.ts   Firestore-backed history API
│  ├─ ai-gateway.server.ts  Model router
│  ├─ terminal.functions.ts AI Reasoning + Compare server fns
│  ├─ phase2.functions.ts   Pulse · DNA · Radar · News · Ask
│  ├─ agents.functions.ts   8 specialized agent runners
│  ├─ about-content.ts      This document (source of truth)
│  └─ services/
│     ├─ types.ts           Quote · NewsItem · DataEnvelope
│     ├─ market-data.server.ts
│     └─ news.server.ts
└─ styles.css               Tailwind v4 tokens + global rules
```

---

## 11. Scalability

Every external surface is an adapter. To swap a provider:
1. Implement the same return shape in a new `*.server.ts` adapter.
2. Point the relevant capability at the new adapter.
3. Ship — no UI changes required.

The same applies to the AI layer: changing the underlying model is a
one-line change in the gateway client. The UI consumes validated schemas,
not raw model responses.

---

## 12. Roadmap Hooks

- Realtime price websocket layer to replace polling.
- Alerting (price, news, agent verdict) via the Notification service stub.
- Portfolio tracking with cost basis and tax-lot aware P&L.
- Collaborative research spaces (shared workspaces).
- Voice mode for the Ask Anything router.

---

## 13. Credits

Concept, design, engineering and integration: **Aaron Fernandes**.
Built on the open web, the Lovable platform, Firebase, and a stack of
public market data providers.

© Terminal One — Financial Intelligence OS.
