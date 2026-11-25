"use client";

import { useState, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { AnalysisResult, Claim, ClaimResult, Source, RedditThread, XPost } from "@/lib/types";
import { getCredibilityLabel } from "@/lib/credibility";

function getDotColor(score: number): string {
  if (score >= 7) return "bg-cred-high";
  if (score >= 4) return "bg-cred-mid";
  return "bg-cred-low";
}

/** Square marker, echoing the pixel wordmark. */
function Marker({ className }: { className: string }) {
  return <span aria-hidden className={`block w-2 h-2 shrink-0 ${className}`} />;
}

function CredibilityDot({ source }: { source: Source }) {
  const dot = getDotColor(source.credibility);
  const label = getCredibilityLabel(source.credibility);
  return (
    <span
      tabIndex={0}
      aria-label={`${source.name}, credibility ${source.credibility} out of 10, ${label}`}
      className="relative group inline-flex items-center shrink-0 self-start mt-[7px] focus:outline-none"
    >
      <Marker className={`${dot} cursor-default`} />
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 z-10 hidden group-hover:block group-focus:block">
        <span className="block bg-ink text-paper text-xs px-3 py-2 whitespace-nowrap">
          <span className="block font-medium">{source.name}</span>
          <span className="block opacity-70 tabular-nums">
            {source.credibility}/10, {label.toLowerCase()}
          </span>
        </span>
      </span>
    </span>
  );
}

function CredibilityBadge({ score }: { score: number }) {
  const label = getCredibilityLabel(score);
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted tabular-nums shrink-0">
      <Marker className={getDotColor(score)} />
      <span>{score}/10</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-4 py-2 border-b border-rule"
    >
      <span className="text-sm truncate group-hover:underline underline-offset-4">{source.name}</span>
      <CredibilityBadge score={source.credibility} />
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-medium text-muted mb-3">{children}</h3>;
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
      <SectionLabel>Timeline</SectionLabel>
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-rule" />
        <div className="space-y-3">
          {dated.map((item, i) => {
            const dotColor = item.source
              ? getDotColor(item.source.credibility)
              : "bg-cred-none";
            return (
              <div key={i} className="flex gap-3 items-start">
                {/* Timeline node dot */}
                <span className="relative z-10 mt-[5px]">
                  <Marker className={dotColor} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted tabular-nums mb-0.5">
                    {formatDate(item.date)}
                  </p>
                  <p className="text-sm truncate">
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
  emptyText,
  result,
  redditThreads,
  xPosts,
}: {
  side: "supporting" | "contradicting";
  title: string;
  emptyText: string;
  result: AnalysisResult | null;
  redditThreads: RedditThread[];
  xPosts: XPost[];
}) {
  const data: ClaimResult | undefined = result?.[side];
  const threads = redditThreads.filter((t) => classifyThread(t.text) === side);
  const posts = xPosts.filter((p) => p.side === side);

  return (
    <section
      aria-labelledby={`${side}-title`}
      className={`min-w-0 py-8 lg:py-2 ${
        side === "supporting" ? "lg:pr-10" : "border-t-2 border-ink lg:border-t-0 lg:border-l-2 lg:pl-10"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h2 id={`${side}-title`} className="text-2xl font-medium tracking-tight">
          {title}
        </h2>
        {result?.grokIncluded && (
          <span className="text-xs text-muted">Includes posts on X</span>
        )}
      </div>

      {!data && <p className="text-sm text-muted max-w-sm">{emptyText}</p>}

      {data && (
        <>
          {/* Claims list — sorted oldest → newest, undated at bottom */}
          <ul className="space-y-4 mb-10 max-w-[62ch]">
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
                  <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed">
                    {source ? (
                      <CredibilityDot source={source} />
                    ) : (
                      <span className="mt-[7px]">
                        <Marker className="bg-cred-none" />
                      </span>
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
              <li className="text-sm text-muted">No evidence found for this side.</li>
            )}
          </ul>

          {/* Reddit threads for this side */}
          {threads.length > 0 && (
            <div className="mb-10">
              <SectionLabel>Reddit threads</SectionLabel>
              <div className="space-y-3">
                {threads.map((thread, i) => (
                  <a
                    key={i}
                    href={thread.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 items-start group"
                  >
                    <span className="mt-[5px]">
                      <Marker className="bg-ink" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted mb-0.5">
                        {`r/${thread.subreddit}, ${formatDate(thread.date)}, ${thread.score} upvotes`}
                      </p>
                      <p className="text-sm group-hover:underline underline-offset-4">{thread.text}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* X Posts for this side */}
          {posts.length > 0 && (
            <div className="mb-10">
              <SectionLabel>Posts on X</SectionLabel>
              <div className="space-y-3">
                {posts.map((post, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="mt-[5px]">
                      <Marker className={post.isVerified ? "bg-ink" : "bg-cred-none"} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted mb-0.5">
                        {post.isVerified ? "Verified account" : "Post"}
                        {post.date ? `, ${formatDate(post.date)}` : ""}
                      </p>
                      <p className="text-sm">{plainText(post.text)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-10 empty:hidden">
            <Timeline claims={data.claims} sources={data.sources} />
          </div>

          {/* Sources */}
          {data.sources.length > 0 && (
            <div>
              <SectionLabel>Sources</SectionLabel>
              <div className="border-t border-rule">
                {data.sources.map((src, i) => (
                  <SourceCard key={i} source={src} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** The Two Sides mark: one half filled, one half open. */
function LogoMark({ spinning = false, className = "w-4 h-4" }: { spinning?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      shapeRendering="crispEdges"
      className={`shrink-0 ${className} ${spinning ? "animate-flip" : ""}`}
    >
      <rect x="0" y="0" width="16" height="16" className="fill-ink" />
      <rect x="9" y="2" width="5" height="12" className="fill-paper" />
    </svg>
  );
}

function PixelArrow() {
  return (
    <svg viewBox="0 0 5 7" aria-hidden className="h-3 w-auto" shapeRendering="crispEdges">
      <path d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM2 4h1v1H2zM1 5h1v1H1zM0 6h1v1H0z" fill="currentColor" />
    </svg>
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
    <main className="min-h-screen flex flex-col px-5 sm:px-8 lg:px-12 max-w-[1600px] mx-auto">
      {/* Top bar */}
      <div className="grid grid-cols-12 gap-x-6 pt-5 text-[15px]">
        <p className="col-span-12 sm:col-span-6 lg:col-span-4 flex items-center gap-2">
          <LogoMark />
          See both sides of any claim, with sources
        </p>
      </div>

      {/* Wordmark + input */}
      <header className="grid grid-cols-12 gap-x-6 mt-10 sm:mt-14">
        <h1 aria-label="Two Sides" className="contents font-pixel font-medium uppercase leading-[0.78] tracking-[-0.02em]">
          <span
            aria-hidden
            className="col-span-12 lg:col-span-4 lg:row-start-2 text-[33vw] lg:text-[clamp(4.5rem,15vw,14rem)] lg:pt-6"
          >
            Two
          </span>
          <span
            aria-hidden
            className="col-span-12 lg:col-start-5 lg:col-span-8 lg:row-start-1 text-[33vw] lg:text-[clamp(4.5rem,22vw,21rem)] lg:text-right"
          >
            Sides
          </span>
        </h1>

        <div className="col-span-12 lg:col-start-5 lg:col-span-8 lg:row-start-2 mt-8 lg:mt-10">
          <div className="flex items-start justify-between gap-6">
            <p className="text-lg sm:text-xl leading-snug max-w-md">
              There are always two sides to every story&hellip;
              <br />
              <span className="text-muted">some would say.</span>
            </p>
            <LogoMark
              spinning={loading}
              className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 flip-on-hover"
            />
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex items-end gap-3 max-w-2xl">
            <label htmlFor="claim" className="sr-only">
              Claim to analyze
            </label>
            <input
              id="claim"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="tell your story"
              className="flex-1 min-w-0 bg-transparent border-0 border-b-2 border-ink px-0 py-2 text-xl placeholder:text-faint focus:outline-none focus:ring-0 focus-visible:outline-none focus:border-b-[3px]"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-2.5 h-12 pl-5 pr-4 rounded-full bg-ink text-paper text-[15px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing…" : "Analyze"}
              <span className="text-lime">
                <PixelArrow />
              </span>
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-5 max-w-2xl flex gap-3 items-start text-sm">
              <span className="mt-[5px]">
                <Marker className="bg-cred-low" />
              </span>
              <span>{error}</span>
            </p>
          )}
        </div>
      </header>

      {/* Results */}
      <div className="mt-20 sm:mt-28">
        {result && (
          <p className="text-sm text-muted mb-6">
            Results for <span className="text-ink">&ldquo;{result.query}&rdquo;</span>
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-t-2 border-ink pt-8">
          <ResultPanel
            side="supporting"
            title="Supporting evidence"
            emptyText="Evidence for the claim shows up here, with each source rated for credibility."
            result={result}
            redditThreads={result?.redditThreads ?? []}
            xPosts={result?.xPosts ?? []}
          />
          <ResultPanel
            side="contradicting"
            title="Contradicting evidence"
            emptyText="Evidence against the claim shows up here, side by side with the other view."
            result={result}
            redditThreads={result?.redditThreads ?? []}
            xPosts={result?.xPosts ?? []}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-24 pb-5 grid grid-cols-12 gap-x-6 gap-y-3 text-[13px] text-muted">
        <p className="col-span-12 lg:col-span-4">Powered by Perplexity Sonar Pro</p>
        <p className="col-span-12 lg:col-span-5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-high" />Credible</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-mid" />Mixed</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-low" />Low credibility</span>
        </p>
        <p className="col-span-12 lg:col-span-3 lg:text-right">Credibility scores are heuristic estimates</p>
      </footer>
    </main>
  );
}
