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

/** Square credibility marker. */
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
        <span className="block bg-fg text-side text-xs px-3 py-2 whitespace-nowrap">
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
  return <h3 className="font-display text-xl font-semibold leading-none mb-3">{children}</h3>;
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
  result,
  redditThreads,
  xPosts,
}: {
  side: "supporting" | "contradicting";
  result: AnalysisResult | null;
  redditThreads: RedditThread[];
  xPosts: XPost[];
}) {
  const data: ClaimResult | undefined = result?.[side];
  const threads = redditThreads.filter((t) => classifyThread(t.text) === side);
  const posts = xPosts.filter((p) => p.side === side);

  if (!data) return null;

  return (
    <>
      {/* Claims list — sorted oldest → newest, undated at bottom */}
      <ul className="space-y-4 mb-12 max-w-[60ch]">
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
              <li key={i} className="flex items-start gap-3 text-[17px] leading-[1.45]">
                {source ? (
                  <CredibilityDot source={source} />
                ) : (
                  <span className="mt-[9px]">
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
          <li className="text-muted">No evidence found for this side.</li>
        )}
      </ul>

      {threads.length > 0 && (
        <div className="mb-12">
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
                <span className="mt-[6px]">
                  <Marker className="bg-fg" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted mb-0.5">
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
        <div className="mb-12">
          <SectionLabel>Posts on X</SectionLabel>
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="mt-[6px]">
                  <Marker className={post.isVerified ? "bg-fg" : "bg-cred-none"} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted mb-0.5">
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

      <div className="mb-12 empty:hidden">
        <Timeline claims={data.claims} sources={data.sources} />
      </div>

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
  );
}

/**
 * The Two Sides mark, sitting on the seam between the halves:
 * light on the black side, black on the light side.
 */
function SeamMark({ spinning, framed = false }: { spinning: boolean; framed?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      shapeRendering="crispEdges"
      className={`w-14 h-14 flip-on-hover ${spinning ? "animate-flip" : ""}`}
    >
      {framed ? (
        <>
          <rect x="0" y="0" width="16" height="16" fill="#000" />
          <rect x="9" y="2" width="5" height="12" fill="#f1f1f1" />
        </>
      ) : (
        <>
          <rect x="0" y="0" width="8" height="16" fill="#f1f1f1" />
          <rect x="8" y="0" width="8" height="16" fill="#000" />
        </>
      )}
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

  const cell = "px-3 sm:px-4";

  return (
    <main className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr_auto]">
      {/* Mark on the seam */}
      <div className="hidden lg:block absolute left-1/2 top-4 -translate-x-1/2 z-10">
        <SeamMark spinning={loading} />
      </div>

      <h1 className="sr-only">Two Sides</h1>

      {/* Row 1, left: wordmark + intro */}
      <section className={`side-dark ${cell} pt-3 pb-12`}>
        <p aria-hidden className="font-display font-bold text-[clamp(5rem,12vw,11rem)] leading-[0.82] tracking-[-0.02em]">
          Two
        </p>
        <p className="mt-8 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.05] max-w-[22ch]">
          There are always two sides to every story&hellip; <em>some would say.</em>
        </p>
        <figure className="mt-10 max-w-[44ch]">
          <blockquote className="text-[17px] leading-snug">
            &ldquo;It is only by the collision of adverse opinions that the remainder of the truth
            has any chance of being supplied.&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-sm text-muted">
            John Stuart Mill, <cite>On Liberty</cite> (1859)
          </figcaption>
        </figure>
      </section>

      {/* Row 1, right: wordmark + form */}
      <section className={`side-light ${cell} pt-3 pb-12`}>
        <div className="flex items-start justify-between gap-4">
          <p aria-hidden className="font-display font-bold text-[clamp(5rem,12vw,11rem)] leading-[0.82] tracking-[-0.02em] lg:ml-auto lg:order-2">
            Sides
          </p>
          <span className="lg:hidden">
            <SeamMark spinning={loading} framed />
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl">
          <label htmlFor="claim" className="block text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.05] mb-4">
            Tell your story.
          </label>
          <div className="flex items-end gap-3">
            <input
              id="claim"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Coffee is bad for your health"
              className="flex-1 min-w-0 bg-transparent border-0 border-b-2 border-ink px-0 py-2 text-xl placeholder:text-faint focus:outline-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-12 px-5 bg-ink text-light font-display text-2xl font-semibold leading-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-4 flex gap-3 items-start text-[15px]">
              <span className="mt-[7px]">
                <Marker className="bg-cred-low" />
              </span>
              <span>{error}</span>
            </p>
          )}
        </form>
      </section>

      {/* Row 2: side headings */}
      <div className={`side-dark ${cell} pt-6 pb-8 border-t border-rule`}>
        <h2 className="font-display font-bold text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.9]">
          Supporting evidence
        </h2>
        {result ? (
          <p className="mt-3 text-sm text-muted">For &ldquo;{result.query}&rdquo;</p>
        ) : (
          <p className="mt-3 text-[15px] text-muted max-w-[44ch]">
            Evidence for the claim shows up on this side, with each source rated for credibility.
          </p>
        )}
      </div>

      {/* On mobile the supporting results follow their heading */}
      <div className={`side-dark ${cell} pb-12 lg:hidden`}>
        <ResultPanel side="supporting" result={result} redditThreads={result?.redditThreads ?? []} xPosts={result?.xPosts ?? []} />
      </div>

      <div className={`side-light ${cell} pt-6 pb-8 border-t border-rule`}>
        <h2 className="font-display font-bold text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.9]">
          Contradicting evidence
        </h2>
        {result ? (
          <p className="mt-3 text-sm text-muted">Against &ldquo;{result.query}&rdquo;</p>
        ) : (
          <p className="mt-3 text-[15px] text-muted max-w-[44ch]">
            Evidence against the claim shows up on this side, facing the other view.
          </p>
        )}
      </div>

      {/* Row 3: results (desktop keeps both halves aligned) */}
      <div className={`side-dark ${cell} pb-16 hidden lg:block`}>
        <ResultPanel side="supporting" result={result} redditThreads={result?.redditThreads ?? []} xPosts={result?.xPosts ?? []} />
      </div>
      <div className={`side-light ${cell} pb-16`}>
        <ResultPanel side="contradicting" result={result} redditThreads={result?.redditThreads ?? []} xPosts={result?.xPosts ?? []} />
      </div>

      {/* Row 4: footer */}
      <footer className={`side-dark ${cell} py-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1`}>
        <span className="font-display text-2xl font-semibold leading-none">Two Sides</span>
        <span className="text-sm text-muted">Powered by Perplexity Sonar Pro</span>
      </footer>
      <div className={`side-light ${cell} py-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 text-sm`}>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-high" />Credible</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-mid" />Mixed</span>
          <span className="inline-flex items-center gap-1.5"><Marker className="bg-cred-low" />Low credibility</span>
        </span>
        <span className="text-muted">Credibility scores are heuristic estimates</span>
      </div>
    </main>
  );
}
