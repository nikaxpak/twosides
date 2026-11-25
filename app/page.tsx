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

/** Round credibility marker with an ink outline, readable on any paper colour. */
function Marker({ className }: { className: string }) {
  return <span aria-hidden className={`block w-2.5 h-2.5 rounded-full ring-1 ring-ink shrink-0 ${className}`} />;
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
        <span className="block bg-ink text-paper text-xs px-3 py-2 rounded whitespace-nowrap">
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
    <span className="inline-flex items-center gap-2 font-sans text-xs text-muted tabular-nums shrink-0">
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
  return <h3 className="font-sans text-[11px] font-semibold tracking-[0.14em] uppercase mb-3 pb-2 border-b border-dotted border-ink">{children}</h3>;
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
        <div className="absolute left-[4.5px] top-2 bottom-2 w-px bg-rule" />
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
  sheet,
  backSheet,
  tilt,
}: {
  side: "supporting" | "contradicting";
  title: string;
  emptyText: string;
  result: AnalysisResult | null;
  redditThreads: RedditThread[];
  xPosts: XPost[];
  sheet: string;
  backSheet: string;
  tilt: string;
}) {
  const data: ClaimResult | undefined = result?.[side];
  const threads = redditThreads.filter((t) => classifyThread(t.text) === side);
  const posts = xPosts.filter((p) => p.side === side);

  return (
    <section id={side} aria-labelledby={`${side}-title`} className="relative min-w-0">
      {/* Paper sheet peeking out from behind */}
      <div aria-hidden className={`absolute inset-0 rounded-md ${backSheet} ${tilt}`} />
      <div className={`relative rounded-md ${sheet} px-6 sm:px-8 py-7 h-full`}>
        <h2 id={`${side}-title`} className="text-[32px] leading-tight mb-1">
          {title}
        </h2>
        <p className="font-sans text-[13px] mb-6 min-h-[1.25rem]">
          {result ? <>On &ldquo;{result.query}&rdquo;</> : null}
        </p>

        {!data && <p className="text-[17px] leading-relaxed max-w-sm">{emptyText}</p>}

        {data && (
          <>
            <ul className="space-y-4 mb-10">
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
                    claim.sourceIndex != null ? data.sources[claim.sourceIndex - 1] : undefined;
                  return (
                    <li key={i} className="flex items-start gap-3 text-[17px] leading-[1.5]">
                      {source ? (
                        <CredibilityDot source={source} />
                      ) : (
                        <span className="mt-[9px]">
                          <Marker className="bg-cred-none" />
                        </span>
                      )}
                      <span className="[&_strong]:font-medium [&_em]:italic">
                        <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>
                          {cleanClaimText(claim.text)}
                        </ReactMarkdown>
                      </span>
                    </li>
                  );
                })}
              {data.claims.filter((c) => !c.isXPost).length === 0 && (
                <li>No evidence found for this side.</li>
              )}
            </ul>

            {threads.length > 0 && (
              <div className="mb-10">
                <SectionLabel>Reddit threads</SectionLabel>
                <div className="space-y-3">
                  {threads.map((thread, i) => (
                    <a key={i} href={thread.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 items-start group">
                      <span className="mt-[7px]">
                        <Marker className="bg-ink" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-xs text-muted mb-0.5">
                          {`r/${thread.subreddit}, ${formatDate(thread.date)}, ${thread.score} upvotes`}
                        </p>
                        <p className="text-[15px] group-hover:underline underline-offset-4">{thread.text}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {posts.length > 0 && (
              <div className="mb-10">
                <SectionLabel>Posts on X</SectionLabel>
                <div className="space-y-3">
                  {posts.map((post, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="mt-[7px]">
                        <Marker className={post.isVerified ? "bg-ink" : "bg-cred-none"} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-xs text-muted mb-0.5">
                          {post.isVerified ? "Verified account" : "Post"}
                          {post.date ? `, ${formatDate(post.date)}` : ""}
                        </p>
                        <p className="text-[15px]">{plainText(post.text)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-10 empty:hidden">
              <Timeline claims={data.claims} sources={data.sources} />
            </div>

            {data.sources.length > 0 && (
              <div>
                <SectionLabel>Sources</SectionLabel>
                <div>
                  {data.sources.map((src, i) => (
                    <SourceCard key={i} source={src} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
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
    <main className="min-h-screen flex flex-col px-5 sm:px-8 lg:px-12 max-w-[1500px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between pt-5 font-sans">
        <span className="text-[15px] font-semibold tracking-[0.2em] uppercase">Two Sides</span>
        <nav className="flex gap-6 text-[14px]">
          <a href="#supporting" className="hover:underline underline-offset-4">Supporting</a>
          <a href="#contradicting" className="hover:underline underline-offset-4">Contradicting</a>
        </nav>
      </div>

      {/* Hero */}
      <header className="flex flex-col items-center text-center pt-24 sm:pt-32">
        <h1 className="sr-only">Two Sides</h1>
        <LogoMark spinning={loading} className="w-10 h-10 flip-on-hover" />
        <p className="mt-8 text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.2] max-w-[22ch]">
          There are always two sides to every story&hellip; <em>some would say.</em>
        </p>

        <form onSubmit={handleSubmit} className="mt-12 w-full max-w-xl flex flex-col sm:flex-row items-center gap-5">
          <label htmlFor="claim" className="sr-only">
            Claim to analyze
          </label>
          <input
            id="claim"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tell your story"
            className="w-full flex-1 min-w-0 bg-transparent border-0 border-b border-dotted border-ink px-1 py-2 text-xl text-center sm:text-left placeholder:text-faint placeholder:italic focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="sticker shrink-0 -rotate-[4deg] hover:rotate-0 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="sticker-inner text-[19px] italic">
              {loading ? "Weighing…" : "Analyze"}
            </span>
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-6 max-w-xl flex gap-3 items-start text-left text-[15px]">
            <span className="mt-[6px]">
              <Marker className="bg-cred-low" />
            </span>
            <span>{error}</span>
          </p>
        )}
      </header>

      {/* Mill quote on a stack of paper */}
      <figure className="relative mx-auto mt-24 sm:mt-28 w-full max-w-2xl">
        <div aria-hidden className="absolute inset-0 rounded-md bg-sheet-green rotate-[-3.5deg] translate-y-2" />
        <div aria-hidden className="absolute inset-0 rounded-md bg-sheet-blue rotate-[2.5deg] -translate-y-1" />
        <div aria-hidden className="absolute inset-0 rounded-md bg-sheet-pink rotate-[-1.2deg]" />
        <div className="relative rounded-md bg-sheet-yellow px-7 sm:px-9 pt-6 pb-8 rotate-[-0.6deg]">
          <p className="font-sans text-[11px] font-semibold tracking-[0.14em] uppercase pb-3 border-b border-dotted border-ink">
            On Liberty, 1859
          </p>
          <blockquote className="mt-5 text-[clamp(1.3rem,2.4vw,1.75rem)] leading-[1.35]">
            &ldquo;It is only by the collision of adverse opinions that the remainder of the truth
            has any chance of being supplied.&rdquo;
          </blockquote>
          <figcaption className="mt-6 text-[26px] italic">John Stuart Mill</figcaption>
        </div>
      </figure>

      {/* Results */}
      <div className="mt-28 border-t border-dotted border-ink pt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
        <ResultPanel
          side="supporting"
          title="Supporting evidence"
          emptyText="Evidence for the claim lands on this page, with each source rated for credibility."
          result={result}
          redditThreads={result?.redditThreads ?? []}
          xPosts={result?.xPosts ?? []}
          sheet="bg-sheet-blue"
          backSheet="bg-sheet-green"
          tilt="rotate-[-1.5deg] translate-y-1.5"
        />
        <ResultPanel
          side="contradicting"
          title="Contradicting evidence"
          emptyText="Evidence against the claim lands on this page, next to the other view."
          result={result}
          redditThreads={result?.redditThreads ?? []}
          xPosts={result?.xPosts ?? []}
          sheet="bg-sheet-yellow"
          backSheet="bg-sheet-pink"
          tilt="rotate-[1.5deg] translate-y-1.5"
        />
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-28 pb-5 font-sans text-[13px]">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mb-6">
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-high" />Credible</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-mid" />Mixed</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-low" />Low credibility</span>
        </div>
        <div className="border-t border-dotted border-ink pt-4 grid grid-cols-3 items-center gap-4">
          <span>Powered by Perplexity Sonar Pro</span>
          <span className="justify-self-center">
            <LogoMark className="w-5 h-5" />
          </span>
          <span className="justify-self-end text-right">Credibility scores are heuristic estimates</span>
        </div>
      </footer>
    </main>
  );
}
