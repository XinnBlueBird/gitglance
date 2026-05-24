import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIMO_ENDPOINT = "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "MIMO_API_KEY not configured" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const body = await req.json();
  const log: string = body?.log ?? "";
  const focus: string = body?.focus ?? "general";

  if (!log || log.length > 40000) {
    return new Response(
      JSON.stringify({ error: "log missing or too large (>40k chars)" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const systemPrompt = `You are a senior engineer reading a git log to understand a codebase's history. Analyze the provided log and produce structured insights.

Focus area: ${focus}

Analyze across these dimensions:
1. VELOCITY — commit cadence, active periods, idle stretches
2. CONTRIBUTORS — who contributes what, knowledge concentration, bus factor risks
3. RISK — files churning excessively, hotspots, refactor candidates
4. PATTERNS — commit message quality, conventional-commits compliance, scope drift
5. NARRATIVE — the story this log tells about the project's evolution

Return STRICT JSON, no markdown:
{
  "summary": "2-3 sentence narrative of what this log tells you",
  "verdict": "healthy" | "warning" | "concerning",
  "stats": {
    "total_commits": <number>,
    "unique_authors": <number>,
    "date_range": "YYYY-MM-DD to YYYY-MM-DD",
    "avg_commits_per_week": <number>
  },
  "contributors": [
    { "name": "...", "commits": <n>, "primary_areas": ["...", "..."], "note": "..." }
  ],
  "hotspots": [
    { "file": "...", "churn_count": <n>, "risk_level": "high"|"medium"|"low", "reason": "..." }
  ],
  "patterns": [
    { "kind": "good"|"bad", "title": "...", "evidence": "..." }
  ],
  "recommendations": ["...", "..."]
}`;

  const userPrompt = `Git log:\n\`\`\`\n${log}\n\`\`\`\n\nReturn the JSON analysis now.`;

  const upstream = await fetch(MIMO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mimo-v2.5-pro",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `mimo upstream error ${upstream.status}: ${txt.slice(0, 300)}` }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
              continue;
            }
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta ?? {};
              const reasoning = delta?.reasoning_content ?? "";
              const content = delta?.content ?? "";
              if (reasoning) {
                controller.enqueue(
                  encoder.encode(`event: reasoning\ndata: ${JSON.stringify(reasoning)}\n\n`)
                );
              }
              if (content) {
                controller.enqueue(
                  encoder.encode(`event: content\ndata: ${JSON.stringify(content)}\n\n`)
                );
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
    },
  });
}
