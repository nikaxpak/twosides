"use client";

import { useState, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { AnalysisResult, Claim, ClaimResult, Source, RedditThread, XPost } from "@/lib/types";
import { getCredibilityLabel } from "@/lib/credibility";

function getDotColor(score: number): string {
  if (score >= 7) return "bg-green-500";
  if (score >= 4) return "bg-yellow-400";
  return "bg-red-500";
}

function CredibilityDot({ source }: { source: Source }) {
  const dot = getDotColor(source.credibility);
  const label = getCredibilityLabel(source.credibility);
  return (
    <span className="relative group inline-flex items-center shrink-0 self-start mt-[3px]">
      <span className={`block w-2.5 h-2.5 rounded-full ${dot} cursor-default`} />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 hidden group-hover:flex flex-col items-center">
        <span className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
          <span className="block font-semibold">{source.name}</span>
          <span className="block text-gray-400">{source.credibility}/10 · {label}</span>
        </span>
        <span className="w-2 h-2 bg-gray-900 border-b border-r border-gray-700 rotate-45 -mt-1" />
      </span>
    </span>
  );
}

function CredibilityBadge({ score }: { score: number }) {
  const label = getCredibilityLabel(score);
  return (
    <span className="inline-flex items-center gap-1 bg-gray-700 text-white text-xs font-medium px-2 py-0.5 rounded-full">
      <span>{score}/10</span>
      <span className="hidden sm:inline text-gray-300">· {label}</span>
    </span>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
    >
      <span className="text-sm text-gray-700 truncate">{source.name}</span>
      <CredibilityBadge score={source.credibility} />
    </a>
  );
}

/** Format an ISO partial date string to "MMM YYYY" or "YYYY". */
function formatDate(iso: string): string {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const parts = iso.split("-");
  if (parts.length === 1) return parts[0];
  const month = parseInt(parts[1], 10) - 1;
  return `${MONTHS[month] ?? "?"} ${parts[0]}`;
}

/** Pad a partial ISO date for chronological sorting. */
function sortKey(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 1) return `${parts[0]}-00-00`;
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-00`;
  return iso;
}

const CONTRA_WORDS = ["false", "debunked", "didn't", "denies", "rumor", "not", "no evidence", "against", "wrong", "fake", "lie", "lies", "myth"];

function classifyThread(title: string): "supporting" | "contradicting" {
  const lower = title.toLowerCase();
  if (CONTRA_WORDS.some((w) => lower.includes(w))) return "contradicting";
  return "supporting";
}

/** For claims list (ReactMarkdown): strip citations only, keep bold markers for rendering. */
function cleanClaimText(text: string): string {
  let out = text;
  out = out.replace(/(\[\d+\])+/g, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/** For timeline (plain text): strip all markdown markers and citations. */
function plainText(text: string): string {
  let out = text;
  out = out.replace(/\*{1,2}([^*\n]*)\*{1,2}/g, "$1");
  out = out.replace(/\*+/g, "");
  out = out.replace(/(\[\d+\])+/g, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function Timeline({ claims, sources }: { claims: Claim[]; sources: Source[] }) {
  const dated = claims
    .filter((c) => c.date !== null)
    .map((c) => ({
      ...c,
      date: c.date as string,
      source: c.sourceIndex != null ? sources[c.sourceIndex - 1] : undefined,
    }))
    .sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)));

  if (dated.length < 2) return null;
  const months = new Set(dated.map((c) => c.date.slice(0, 7)));
  if (months.size <= 1) return null;

  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Timeline
      </h3>
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
        <div className="space-y-3">
          {dated.map((item, i) => {
            const dotColor = item.source
              ? getDotColor(item.source.credibility)
              : "bg-gray-300";
            return (
              <div key={i} className="flex gap-3 items-start">
                {/* Timeline node dot */}
                <span
                  className={`relative z-10 mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 ${dotColor}`}
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium mb-0.5">
                    {formatDate(item.date)}
                  </p>
                  <p className="text-sm text-gray-700 truncate">
                    {plainText(item.text)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  side,
  title,
  result,
  redditThreads,
  xPosts,
}: {
  side: "supporting" | "contradicting";
  title: string;
  result: AnalysisResult | null;
  redditThreads: RedditThread[];
  xPosts: XPost[];
}) {
  const data: ClaimResult | undefined = result?.[side];

  return (
    <div className="flex-1 border border-gray-200 rounded-xl p-5 bg-white min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {result?.grokIncluded && (
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">x.com</span>
        )}
      </div>

      {!data && (
        <p className="text-gray-400 text-sm">Enter a claim above to see results.</p>
      )}

      {data && (
        <>
          {/* Claims list — sorted oldest → newest, undated at bottom */}
          <ul className="space-y-3 mb-5">
            {[...data.claims]
              .filter((c) => !c.isXPost)
              .sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return sortKey(a.date).localeCompare(sortKey(b.date));
              })
              .map((claim, i) => {
                const source =
                  claim.sourceIndex != null
                    ? data.sources[claim.sourceIndex - 1]
                    : undefined;
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    {source ? (
                      <CredibilityDot source={source} />
                    ) : (
                      <span className="self-start mt-[3px] w-2.5 h-2.5 rounded-full shrink-0 bg-gray-400" />
                    )}
                    <span className="[&_strong]:font-semibold [&_em]:italic">
                      <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>
                        {cleanClaimText(claim.text)}
                      </ReactMarkdown>
                    </span>
                  </li>
                );
              })}
            {data.claims.filter((c) => !c.isXPost).length === 0 && (
              <li className="text-gray-400 text-sm">No claims found.</li>
            )}
          </ul>

          {/* Reddit threads for this side */}
          {redditThreads.filter((t) => classifyThread(t.text) === side).length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Relevant Reddit Threads
              </h3>
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                <div className="space-y-3">
                  {redditThreads.filter((t) => classifyThread(t.text) === side).map((thread, i) => (
                    <a
                      key={i}
                      href={thread.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 items-start group"
                    >
                      <span className="relative z-10 mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 bg-orange-300 group-hover:bg-orange-400 transition-colors" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-400 font-medium mb-0.5">
                          r/{thread.subreddit} · {formatDate(thread.date)} · ↑ {thread.score}
                        </p>
                        <p className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{thread.text}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* X Posts for this side */}
          {xPosts.filter((p) => p.side === side).length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Relevant X Posts
              </h3>
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                <div className="space-y-3">
                  {xPosts.filter((p) => p.side === side).map((post, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className={`relative z-10 mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 ${post.isVerified ? "bg-blue-400" : "bg-gray-300"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-400 font-medium mb-0.5">
                          {post.isVerified ? "Verified" : "X Post"}
                          {post.date ? ` · ${formatDate(post.date)}` : ""}
                        </p>
                        <p className="text-sm text-gray-700">{plainText(post.text)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <Timeline claims={data.claims} sources={data.sources} />

          {/* Sources */}
          {data.sources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sources
              </h3>
              <div className="space-y-1.5">
                {data.sources.map((src, i) => (
                  <SourceCard key={i} source={src} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setResult(data as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-0 mb-5 -ml-16">
          <img
            src="/twosides_logo.png"
            alt="Two Sides"
            className={`w-32 h-auto -mr-8 transition-transform ${loading ? "animate-flip" : ""}`}
          />
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
            Two Sides
          </h1>
        </div>
        <p className="font-light leading-relaxed" style={{ color: "#3B3B3B" }}>
          There are always two sides to every story...
        </p>
        <p className="font-light" style={{ color: "#3B3B3B" }}>some would say.</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tell your story"
            className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-3 bg-gray-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analyzing…
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="w-full max-w-2xl mb-6 p-4 bg-white border border-gray-300 rounded-lg text-sm text-gray-700">
          {error}
        </div>
      )}

      {/* Query label */}
      {result && (
        <p className="text-xs text-gray-400 mb-4">
          Showing results for:{" "}
          <span className="text-gray-600 font-medium">"{result.query}"</span>
        </p>
      )}

      {/* Results split pane */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-4">
        <ResultPanel side="supporting" title="Supporting Evidence" result={result} redditThreads={result?.redditThreads ?? []} xPosts={result?.xPosts ?? []} />
        <ResultPanel side="contradicting" title="Contradicting Evidence" result={result} redditThreads={result?.redditThreads ?? []} xPosts={result?.xPosts ?? []} />
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-gray-400">
        Powered by Perplexity Sonar Pro · Credibility scores are heuristic estimates
      </p>
    </main>
  );
}
