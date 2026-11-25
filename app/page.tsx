"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { AnalysisResult, ClaimResult, Source, RedditThread, XPost } from "@/lib/types";
import { getCredibilityLabel } from "@/lib/credibility";
import { checkClaim, EXAMPLE_CLAIM } from "@/lib/claimCheck";

function getDotColor(score: number): string {
  if (score >= 7) return "bg-cred-high";
  if (score >= 4) return "bg-cred-mid";
  return "bg-cred-low";
}

/** Square credibility marker. */
function Marker({ className }: { className: string }) {
  return <span aria-hidden className={`block w-2 h-2 shrink-0 ${className}`} />;
}

/** Show domains in lowercase without "www." (the API capitalises them). */
function sourceLabel(source: Source): string {
  if (source.name.includes(".")) return source.domain.replace(/^www\./, "").toLowerCase();
  return source.name;
}

function CredibilityBadge({ score }: { score: number }) {
  const label = getCredibilityLabel(score);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted tabular-nums shrink-0">
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
      className="group flex items-center justify-between gap-4 py-2.5 border-b border-rule"
    >
      <span className="text-[15px] truncate group-hover:underline underline-offset-4">{sourceLabel(source)}</span>
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
  // Doubled brackets left behind by citations, e.g. "((HR=0.79))"
  out = out.replace(/\(\(([^()]*)\)\)/g, "($1)");
  // Space before punctuation once citations are removed
  out = out.replace(/\s+([.,;:!?)])/g, "$1");
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

/** Turn API failures into something a reader can act on; keep the raw text for "Details". */
function friendlyError(raw: string): string {
  if (/\b429\b|rate limit/i.test(raw)) return "The evidence search is busy right now. Wait a minute, then analyze again.";
  if (/not set|401|403/i.test(raw)) return "The evidence search isn't set up correctly. Try again later.";
  if (/network|fetch/i.test(raw)) return "Couldn't reach the server. Check your connection and try again.";
  return "Something went wrong while searching for evidence. Try again.";
}

/** One column of content, centred within its half so text doesn't hug the edge. */
function Column({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[680px] ${className}`}>{children}</div>;
}

function ResultPanel({
  side,
  result,
  loading,
  redditThreads,
  xPosts,
}: {
  side: "supporting" | "contradicting";
  result: AnalysisResult | null;
  loading: boolean;
  redditThreads: RedditThread[];
  xPosts: XPost[];
}) {
  const data: ClaimResult | undefined = result?.[side];
  const threads = redditThreads.filter((t) => classifyThread(t.text) === side);
  const posts = xPosts.filter((p) => p.side === side);

  if (loading) {
    return (
      <p className="font-fell text-[22px] text-muted animate-pulse motion-reduce:animate-none">
        {side === "supporting" ? "Looking for evidence for the claim…" : "Looking for evidence against it…"}
      </p>
    );
  }
  if (!data) return null;

  const claims = [...data.claims]
    .filter((c) => !c.isXPost)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return sortKey(a.date).localeCompare(sortKey(b.date));
    });

  return (
    <>
      {/* Claims as a timeline: date in the gutter, credibility marker on the line */}
      {claims.length === 0 ? (
        <p className="mb-14 text-[18px] text-body">No evidence found for this side.</p>
      ) : (
        <ol className="mb-14">
          {claims.map((claim, i) => {
            const source =
              claim.sourceIndex != null ? data.sources[claim.sourceIndex - 1] : undefined;
            const last = i === claims.length - 1;
            return (
              <li key={i} className="grid grid-cols-[3.75rem_1fr] sm:grid-cols-[5.25rem_1fr] gap-x-4 sm:gap-x-5">
                <p className="pt-[1px] text-right font-display text-[19px] sm:text-[22px] font-semibold leading-[1.75rem] tabular-nums">
                  {claim.date ? formatDate(claim.date) : <span className="text-muted">Undated</span>}
                </p>
                <div className={`relative pl-6 border-l border-rule ${last ? "pb-1" : "pb-8"}`}>
                  <span className="absolute -left-[5px] top-[10px]">
                    <span
                      aria-hidden
                      className={`block w-[9px] h-[9px] ${source ? getDotColor(source.credibility) : "bg-cred-none"}`}
                    />
                  </span>
                  {/* Perplexity bolds long phrases; mark them with full-contrast colour instead of weight */}
                  <p className="text-[18px] leading-[1.6] text-body [&_strong]:font-normal [&_strong]:text-fg [&_em]:italic">
                    <ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>
                      {cleanClaimText(claim.text)}
                    </ReactMarkdown>
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[15px] text-muted">
                    {source ? (
                      <>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4 decoration-rule hover:text-fg hover:decoration-current"
                        >
                          {sourceLabel(source)}
                        </a>
                        <span>
                          {source.credibility}/10 {getCredibilityLabel(source.credibility).toLowerCase()}
                        </span>
                      </>
                    ) : (
                      <span>No source cited</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {threads.length > 0 && (
        <div className="mb-12">
          <SectionLabel>Reddit threads</SectionLabel>
          <div className="space-y-4">
            {threads.map((thread, i) => (
              <a key={i} href={thread.url} target="_blank" rel="noopener noreferrer" className="block group">
                <p className="text-[17px] leading-snug group-hover:underline underline-offset-4">{thread.text}</p>
                <p className="mt-1 text-[15px] text-muted">
                  {`r/${thread.subreddit}, ${formatDate(thread.date)}, ${thread.score} upvotes`}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mb-12">
          <SectionLabel>Posts on X</SectionLabel>
          <div className="space-y-4">
            {posts.map((post, i) => (
              <div key={i}>
                <p className="text-[17px] leading-snug">{plainText(post.text)}</p>
                <p className="mt-1 text-[15px] text-muted">
                  {post.isVerified ? "Verified account" : "Post"}
                  {post.date ? `, ${formatDate(post.date)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.sources.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none font-display text-xl font-semibold leading-none inline-flex items-center gap-2">
            <span className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">&#9656;</span>
            All {data.sources.length} sources
          </summary>
          <div className="mt-3 border-t border-rule">
            {data.sources.map((src, i) => (
              <SourceCard key={i} source={src} />
            ))}
          </div>
        </details>
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

const STORAGE_KEY = "twosides:last";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  // Reopen the last search when someone comes back
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const last = JSON.parse(saved) as AnalysisResult;
        restored.current = true;
        setResult(last);
        setQuery(last.query);
      }
    } catch {
      /* storage unavailable: start fresh */
    }
  }, []);

  // Bring the results into view when a search starts and when it finishes
  useEffect(() => {
    if (!loading && !result) return;
    if (restored.current) {
      restored.current = false;
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [loading, result]);

  function newClaim() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const check = checkClaim(query);
    if (!check.ok) {
      setHint(check.message);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDetail(null);
    setHint(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.kind) {
          setHint(data.error);
        } else {
          const raw = String(data.error ?? `HTTP ${res.status}`);
          setError(friendlyError(raw));
          setErrorDetail(raw);
        }
        return;
      }

      setResult(data as AnalysisResult);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* storage full or blocked: nothing to do */
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Network error";
      setError(friendlyError(`network ${raw}`));
      setErrorDetail(raw);
    } finally {
      setLoading(false);
    }
  }

  const cell = "px-4 sm:px-6";
  const panels = (side: "supporting" | "contradicting") => (
    <ResultPanel
      side={side}
      result={result}
      loading={loading}
      redditThreads={result?.redditThreads ?? []}
      xPosts={result?.xPosts ?? []}
    />
  );
  const sourceCount = (side: "supporting" | "contradicting") => result?.[side].sources.length ?? 0;

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
        <p className="mt-8 font-fell text-[clamp(1.5rem,2.2vw,2.1rem)] leading-[1.1] max-w-[26ch] text-balance">
          There are always two sides to every story&hellip; <em>some would say.</em>
        </p>
        <figure className="mt-8 max-w-[36ch]">
          <blockquote className="font-fell text-[19px] leading-snug">
            &ldquo;He who knows only his own side of the case, knows little of that.&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-[15px] text-muted">
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
          <label htmlFor="claim" className="block font-fell text-[clamp(1.8rem,2.8vw,2.6rem)] leading-[1.08] mb-4">
            Tell your story.
          </label>
          <div className="flex items-end gap-3">
            <input
              ref={inputRef}
              id="claim"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (hint) setHint(null);
              }}
              placeholder={`e.g. ${EXAMPLE_CLAIM}`}
              aria-describedby="claim-help"
              autoComplete="off"
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent border-0 border-b-2 border-ink px-0 py-2 text-xl placeholder:text-faint focus:outline-none focus:ring-0 focus:border-b-[3px]"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-14 px-6 bg-ink text-light font-display text-[26px] font-semibold leading-none hover:bg-[#2a2a2a] active:translate-y-px disabled:opacity-50 disabled:cursor-progress"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
          <p id="claim-help" className="mt-3 text-[15px] text-muted">
            {loading ? (
              "This usually takes 10 to 20 seconds."
            ) : (
              <>
                Try an example:{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery(EXAMPLE_CLAIM);
                    setHint(null);
                  }}
                  className="underline underline-offset-4 hover:text-fg"
                >
                  {EXAMPLE_CLAIM}
                </button>
              </>
            )}
          </p>
          {hint && (
            <p role="status" className="mt-4 flex gap-3 items-start text-[16px]">
              <span className="mt-[8px]">
                <Marker className="bg-fg" />
              </span>
              <span>{hint}</span>
            </p>
          )}
          {error && (
            <div role="alert" className="mt-4 text-[16px]">
              <p className="flex gap-3 items-start">
                <span className="mt-[8px]">
                  <Marker className="bg-cred-low" />
                </span>
                <span>{error}</span>
              </p>
              {errorDetail && (
                <details className="mt-2 ml-5 text-sm text-muted">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-1 break-words">{errorDetail}</p>
                </details>
              )}
            </div>
          )}
        </form>
      </section>

      {/* Row 2: side headings */}
      <div ref={resultsRef} className={`side-dark ${cell} pt-8 pb-8 border-t border-rule`}>
        <Column>
          <h2 className="font-display font-bold text-[clamp(2.5rem,4.5vw,4rem)] leading-[0.9]">
            Supporting evidence
          </h2>
          {result ? (
            <p className="mt-3 text-[15px] text-muted">
              For &ldquo;{result.query}&rdquo;, from {sourceCount("supporting")} sources
            </p>
          ) : loading ? null : (
            <p className="mt-4 font-fell text-[22px] leading-snug text-muted max-w-[40ch]">
              Evidence for the claim shows up on this side, with each source rated for credibility.
            </p>
          )}
        </Column>
      </div>

      {/* On mobile the supporting results follow their heading */}
      <div className={`side-dark ${cell} pb-12 lg:hidden`}>
        <Column>{panels("supporting")}</Column>
      </div>

      <div className={`side-light ${cell} pt-8 pb-8 border-t border-rule`}>
        <Column>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display font-bold text-[clamp(2.5rem,4.5vw,4rem)] leading-[0.9]">
              Contradicting evidence
            </h2>
          </div>
          {result ? (
            <p className="mt-3 text-[15px] text-muted">
              Against &ldquo;{result.query}&rdquo;, from {sourceCount("contradicting")} sources
            </p>
          ) : loading ? null : (
            <p className="mt-4 font-fell text-[22px] leading-snug text-muted max-w-[40ch]">
              Evidence against the claim shows up on this side, facing the other view.
            </p>
          )}
        </Column>
      </div>

      {/* Row 3: results (desktop keeps both halves aligned) */}
      <div className={`side-dark ${cell} pb-16 hidden lg:block`}>
        <Column>{panels("supporting")}</Column>
      </div>
      <div className={`side-light ${cell} pb-16`}>
        <Column>
          {panels("contradicting")}
          {result && (
            <button
              type="button"
              onClick={newClaim}
              className="mt-12 h-12 px-5 border-2 border-ink font-display text-[22px] font-semibold leading-none hover:bg-ink hover:text-light"
            >
              Check another claim
            </button>
          )}
        </Column>
      </div>

      {/* Row 4: footer */}
      <footer className={`side-dark ${cell} py-4 text-[15px] text-muted`}>
        Powered by Perplexity Sonar Pro
      </footer>
      <div className={`side-light ${cell} py-4 text-[15px] text-muted lg:text-right`}>
        Credibility scores are estimates based on each source&rsquo;s domain
      </div>
    </main>
  );
}
