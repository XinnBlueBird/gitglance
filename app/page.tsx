"use client";

import { useState, useRef, useEffect } from "react";
import {
  GitBranch,
  Users,
  Flame,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Brain,
  ChevronRight,
  Eraser,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

type Verdict = "healthy" | "warning" | "concerning";

type Analysis = {
  summary: string;
  verdict: Verdict;
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
};

const SAMPLE_LOG = `commit a3f8b21 (HEAD -> main)
Author: Alice <alice@example.com>
Date:   2026-05-23

    feat: add streaming SSE support to /api/chat

commit 8d2c7e4
Author: Bob <bob@example.com>
Date:   2026-05-22

    fix typo

commit 5e1a09f
Author: Alice <alice@example.com>
Date:   2026-05-21

    refactor(api): extract MiMo client into shared module

commit 9c3d8a2
Author: Carol <carol@example.com>
Date:   2026-05-20

    chore: bump deps

commit f7e2b15
Author: Bob <bob@example.com>
Date:   2026-05-18

    fix bug

commit 2a8c4d6
Author: Alice <alice@example.com>
Date:   2026-05-15

    feat(auth): JWT refresh token rotation

commit 4b9e1d3
Author: Alice <alice@example.com>
Date:   2026-05-12

    fix(auth): edge case in token expiry check

commit 6c0a8f1
Author: Alice <alice@example.com>
Date:   2026-05-10

    docs: update README architecture diagram`;

const VERDICT_STYLE: Record<
  Verdict,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  healthy: {
    label: "Healthy",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: CheckCircle2,
  },
  warning: {
    label: "Warning",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: AlertCircle,
  },
  concerning: {
    label: "Concerning",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    icon: XCircle,
  },
};

const RISK_STYLE: Record<"high" | "medium" | "low", string> = {
  high: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  medium: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  low: "text-sky-300 bg-sky-500/10 border-sky-500/30",
};

export default function Home() {
  const [log, setLog] = useState(SAMPLE_LOG);
  const [focus, setFocus] = useState("general");
  const [reasoning, setReasoning] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasoningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoning]);

  async function analyze() {
    if (!log.trim() || loading) return;
    setLoading(true);
    setError(null);
    setReasoning("");
    setAnalysis(null);

    try {
      const res = await fetch("/api/mimo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ log, focus }),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";

        for (const ev of events) {
          const lines = ev.split("\n");
          let evType = "message";
          let dataLines: string[] = [];
          for (const l of lines) {
            if (l.startsWith("event:")) evType = l.slice(6).trim();
            else if (l.startsWith("data:")) dataLines.push(l.slice(5).trim());
          }
          const data = dataLines.join("");
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (evType === "reasoning") setReasoning((p) => p + parsed);
            else if (evType === "content") acc += parsed;
          } catch {}
        }
      }

      const cleaned = acc.replace(/^```json\n?|\n?```$/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          setAnalysis(JSON.parse(cleaned.slice(start, end + 1)));
        } catch {
          setError("MiMo returned non-JSON output. Try again.");
        }
      } else {
        setError("No JSON in response.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  const verdictData = analysis ? VERDICT_STYLE[analysis.verdict] : null;
  const VerdictIcon = verdictData?.icon ?? CheckCircle2;

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="border-b border-zinc-800/60 backdrop-blur sticky top-0 bg-[#0b0b10]/80 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight">GitGlance</span>
            <span className="hidden sm:inline ml-3 text-xs text-zinc-500">
              read git logs like a senior engineer
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="hidden sm:inline">MiMo v2.5 Pro</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            Your git log tells a story.
            <br />
            <span className="text-zinc-400">GitGlance reads it for you.</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl mx-auto">
            Paste a `git log` (or `git log --stat`), get velocity, contributor breakdown, hotspot
            files, anti-patterns, and recommendations. Not just stats — the narrative.
          </p>
        </section>

        <section className="mb-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">FOCUS</span>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="general">General</option>
                  <option value="bus_factor">Bus factor risk</option>
                  <option value="velocity">Velocity & cadence</option>
                  <option value="hotspots">Hotspot detection</option>
                  <option value="commit_quality">Commit quality</option>
                  <option value="onboarding">Onboarding (new joiner)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 text-zinc-600">
                <span>{log.split("\n").length} lines</span>
                <button
                  onClick={() => setLog("")}
                  className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300"
                >
                  <Eraser className="w-3 h-3" /> clear
                </button>
              </div>
            </div>
            <textarea
              value={log}
              onChange={(e) => setLog(e.target.value)}
              spellCheck={false}
              placeholder="Paste git log output here..."
              className="w-full min-h-[280px] bg-[#0a0a10] px-4 py-3 font-mono text-[12.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-700 focus:outline-none resize-y"
            />
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Tip: <code className="text-zinc-300">git log --pretty=fuller --stat -n 100</code>
              </div>
              <button
                onClick={analyze}
                disabled={loading || !log.trim()}
                className="text-sm px-4 py-1.5 rounded-md bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 transition flex items-center gap-2 font-medium text-zinc-950"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Reading
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Glance
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>MiMo is reading your log</span>
              <span className="text-xs text-zinc-500">({reasoning.length} chars streamed)</span>
            </div>
            <div
              ref={reasoningRef}
              className="max-h-72 overflow-y-auto px-4 py-3 font-mono text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap"
            >
              {reasoning || (
                <span className="text-zinc-600 italic">Waiting for first reasoning token...</span>
              )}
            </div>
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </section>
        )}

        {analysis && verdictData && (
          <section className="space-y-4">
            <div className={`rounded-xl border ${verdictData.bg} px-5 py-4`}>
              <div className="flex items-center gap-2 mb-2">
                <VerdictIcon className={`w-5 h-5 ${verdictData.color}`} />
                <span className={`text-sm font-semibold ${verdictData.color}`}>
                  {verdictData.label}
                </span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.summary}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                icon={Activity}
                label="Commits"
                value={analysis.stats.total_commits.toString()}
              />
              <Stat
                icon={Users}
                label="Authors"
                value={analysis.stats.unique_authors.toString()}
              />
              <Stat
                icon={TrendingUp}
                label="Per week"
                value={analysis.stats.avg_commits_per_week.toString()}
              />
              <Stat
                icon={GitBranch}
                label="Range"
                value={analysis.stats.date_range}
                small
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Contributors" icon={Users}>
                <ul className="space-y-3">
                  {analysis.contributors.map((c, i) => (
                    <li key={i} className="border-l-2 border-zinc-800 pl-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-100">{c.name}</span>
                        <span className="text-xs text-zinc-500">{c.commits} commits</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.primary_areas.map((a, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                      {c.note && (
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{c.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Hotspots" icon={Flame}>
                {analysis.hotspots.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No churn hotspots detected.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {analysis.hotspots.map((h, i) => (
                      <li key={i} className="border border-zinc-800 rounded-md px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-xs text-zinc-200 truncate">{h.file}</code>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${RISK_STYLE[h.risk_level]}`}
                          >
                            {h.risk_level}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mb-1">
                          churn: {h.churn_count}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{h.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Patterns" icon={Activity}>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {analysis.patterns.map((p, i) => (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 ${
                      p.kind === "good"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {p.kind === "good" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className="text-sm font-medium text-zinc-100">{p.title}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{p.evidence}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Recommendations" icon={Lightbulb}>
              <ul className="space-y-2">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        <section id="about" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-zinc-800 pt-10">
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">About GitGlance</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
              Engineering managers, tech leads, and new joiners face the same problem: a repository
              with thousands of commits and no easy way to extract its narrative. Who owns what?
              Where does code rot accumulate? Is the team pacing healthily?
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
              GitGlance answers those questions. Paste a chunk of git log output (works with plain
              `git log`, `git log --stat`, or `--pretty=fuller`), pick a focus area, and the
              auditor returns velocity stats, per-contributor breakdowns, churn hotspots,
              commit-quality signals, and concrete recommendations.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              MiMo v2.5 Pro&apos;s reasoning chain is exposed during analysis — you watch how the
              model interprets each commit before it produces the structured output. It surfaces
              insights that pure aggregation tools miss: a contributor whose commits all touch the
              same file (bus factor risk), a churn pattern that signals an unstable abstraction, a
              gap in the log that maps to a hiring freeze.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-3">Stack</p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>MiMo v2.5 Pro reasoning</li>
              <li>SSE streaming (reasoning + content)</li>
              <li>Next.js 16 App Router</li>
              <li>Tailwind v4, lucide-react</li>
              <li>No database, no persistence</li>
            </ul>
          </div>
        </section>

        <section id="faq" className="mt-16 border-t border-zinc-800 pt-10">
          <h2 className="text-lg font-semibold mb-4">Frequently asked</h2>
          <div className="space-y-3">
            <FaqItem
              q="What format should the log be in?"
              a="Plain `git log` works. `git log --stat` is better — file-level changes let GitGlance detect hotspots. `--pretty=fuller` adds committer info on top of author. Paste up to 40,000 characters."
            />
            <FaqItem
              q="Is my git log stored anywhere?"
              a="No. The input is forwarded once to the reasoning model through a serverless proxy and discarded with the request. There is no database."
            />
            <FaqItem
              q="How is this different from `git shortlog` or GitHub Insights?"
              a="Shortlog aggregates by author. GitHub Insights shows charts. GitGlance reads the actual messages and connects patterns: which contributor risks bus factor, what commit-quality drift means, why churn on a specific file is a refactor signal."
            />
            <FaqItem
              q="Can I focus on something specific?"
              a="Yes. The focus selector tunes the auditor toward bus-factor risk, velocity, hotspots, commit quality, or onboarding. The output structure stays the same — the emphasis shifts."
            />
            <FaqItem
              q="Why expose the reasoning chain?"
              a="Because the value of an auditor isn't the verdict — it's the reasoning. Watching MiMo work through commit messages teaches you to read your own log differently next time."
            />
          </div>
        </section>

        <footer className="mt-20 mb-6 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
          <p>GitGlance — every commit history has a story. Read it.</p>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  small = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      </div>
      <div className={`font-semibold tracking-tight ${small ? "text-sm" : "text-xl"}`}>
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-amber-400" />
        <span>{title}</span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/30 transition"
      >
        <span className="text-sm font-medium text-zinc-100">{q}</span>
        <ChevronRight
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed">{a}</div>
      )}
    </div>
  );
}
