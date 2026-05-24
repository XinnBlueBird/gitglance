# GitGlance

Read your git log like a senior engineer. Paste any `git log` output, get velocity stats, contributor breakdowns, churn hotspots, anti-patterns, and concrete recommendations — powered by MiMo v2.5 Pro reasoning.

**Live**: https://gitglance-coral.vercel.app
**Repo**: https://github.com/XinnBlueBird/gitglance

---

## The problem

Repositories accumulate thousands of commits. Three audiences need to extract the narrative from that history:

- **Engineering managers** want bus-factor risk, velocity trends, and review-load distribution.
- **Tech leads** want hotspot detection — files that churn excessively, anti-patterns in commit hygiene, scope drift.
- **New joiners** want a fast read on who owns what and where the risky areas live.

Existing tooling falls short. `git shortlog` aggregates by author. GitHub Insights shows charts. Neither *reads the messages*. The signal that matters — "this contributor's commits all touch the same file, that's a knowledge concentration risk" or "70% of commits in May said 'fix typo' or 'wip', commit hygiene is degrading" — lives in the prose itself.

GitGlance reads the prose.

## What it does

Paste a chunk of git log output (plain `git log`, `git log --stat`, or `--pretty=fuller` all work). Pick a focus — general, bus-factor, velocity, hotspots, commit quality, or onboarding. The auditor returns a structured report:

- **Verdict** — healthy, warning, concerning
- **Summary** — 2-3 sentence narrative of what the log tells you
- **Stats** — total commits, unique authors, date range, commits per week
- **Contributors** — per-author breakdown with primary areas and notes (e.g., "exclusively touches auth module, bus-factor risk")
- **Hotspots** — files with abnormal churn, ranked by risk level, with a reason for each
- **Patterns** — good and bad signals: conventional-commits compliance, scope drift, message quality, commit cadence anomalies
- **Recommendations** — concrete actions: "rotate auth ownership", "introduce PR templates", "cap PR scope"

The model's reasoning chain streams in real time. You watch MiMo work through commit messages before producing the structured report — that's the part where insight emerges.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────────────────┐
│  Browser            │     │  Next.js API route   │     │  MiMo Token Plan API   │
│  (page.tsx)         │     │  /api/mimo           │     │  token-plan-sgp...     │
│                     │ ──> │                      │ ──> │  mimo-v2.5-pro         │
│  - Log textarea     │     │  - Validates input   │     │  - Streaming SSE       │
│  - Focus selector   │     │  - Builds prompt     │     │  - reasoning_content   │
│  - SSE consumer     │ <── │  - Proxies SSE       │ <── │  - structured JSON     │
└─────────────────────┘     └──────────────────────┘     └────────────────────────┘
```

The proxy keeps the API key server-side, normalizes MiMo's dual `reasoning_content` + `content` fields into separate SSE event types (`event: reasoning` and `event: content`), and clamps input at 40k chars.

No database. No persistence. The log lives only as long as the HTTP connection.

## Why MiMo v2.5 Pro

The differentiating capability is **reasoning trace exposure**. MiMo returns `reasoning_content` separate from final `content` — the UI streams both into separate panes. For an auditor tool, watching the model work *is the value*. Users learn to read their own logs differently after seeing how MiMo connects "Alice authored 6 of 8 commits in auth/" with "auth/jwt.ts churned 12 times in 30 days" to flag a concentration risk.

The other capability that matters: **long-context reasoning over semi-structured input**. Git log output at 40k chars is around 250 commits with stats. MiMo holds the whole history in working memory and cross-references contributors across files without truncation.

## API

```
POST /api/mimo
Content-Type: application/json

{
  "log": "<your git log output>",
  "focus": "general" | "bus_factor" | "velocity" | "hotspots" | "commit_quality" | "onboarding"
}
```

Response: `text/event-stream` with three event types — `reasoning`, `content`, `done`. Concatenated `content` is JSON of shape:

```ts
{
  summary: string;
  verdict: "healthy" | "warning" | "concerning";
  stats: {
    total_commits: number;
    unique_authors: number;
    date_range: string;
    avg_commits_per_week: number;
  };
  contributors: Array<{
    name: string;
    commits: number;
    primary_areas: string[];
    note: string;
  }>;
  hotspots: Array<{
    file: string;
    churn_count: number;
    risk_level: "high" | "medium" | "low";
    reason: string;
  }>;
  patterns: Array<{
    kind: "good" | "bad";
    title: string;
    evidence: string;
  }>;
  recommendations: string[];
}
```

## Local development

```bash
git clone https://github.com/XinnBlueBird/gitglance.git
cd gitglance
npm install
cp .env.example .env.local
# add MIMO_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000.

## Token usage and cost

Single-call architecture: one API request per glance, no follow-up. Token consumption per glance:

| Phase | Tokens (typical) |
| --- | --- |
| System prompt (5-dimension auditor) | ~430 |
| User input (log + focus) | 500 – 9000 |
| Reasoning output (`reasoning_content`) | 900 – 2800 |
| Final structured output (`content`) | 700 – 2200 |
| **Per-glance total** | **~2500 – 14400** |

Aggregate over a 30-day window (estimated):

- Glances: ~85k
- Total tokens: ~78M (input + reasoning + output)
- Average per glance: ~9100 tokens

Optimization notes:

- Input clamped at 40k chars server-side.
- System prompt is static and benefits from MiMo's prefix caching when present.
- The `reasoning_content` is ~30% of output but is the highest-value part of the response — it's what makes the tool an auditor and not just a stat aggregator.

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind CSS v4
- lucide-react icons
- Server-Sent Events for streaming
- MiMo v2.5 Pro via Token Plan endpoint

## License

MIT
