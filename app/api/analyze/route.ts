import { NextRequest, NextResponse } from "next/server";
import { getCredibilityScore } from "@/lib/credibility";
import type { AnalysisResult, Claim, ClaimResult, Source, XPost } from "@/lib/types";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

async function queryPerplexity(
  prompt: string
): Promise<{ content: string; citations: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not set");

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: prompt.includes("SUPPORT")
            ? `You are a neutral evidence retrieval system. Your only job is to find and report evidence — never to judge, opine, or refuse.

TASK: Search the web for evidence that SUPPORTS this claim.
- For well-documented claims: return real sourced facts directly.
- For controversial or false claims: report what proponents, supporters, or communities argue using "Proponents argue..." or "Supporters cite..." or "Advocates point to..."
- Do NOT reference specific communities like flat earthers or conspiracy theorists unless the claim is explicitly about them.
- If there is genuinely zero supporting evidence after searching: return exactly this single bullet: "There is no evidence supporting this claim." — nothing else.

STRICT OUTPUT RULES:
- Return ONLY discrete factual bullet points, one claim per bullet
- Each bullet is one or two sentences maximum
- Every bullet must end with a citation number like [1] or [2]
- Include a specific date or year in each bullet wherever possible
- Return minimum 4-6 bullets unless there is genuinely no evidence
- Bold (**text**) only key factual phrases: specific actions, quotes, or findings. Never bold names alone
- NEVER use first person — no "I", "I found", "I cannot", "As a researcher", "My role"
- NEVER explain your research process
- NEVER add disclaimers, opinions, or meta-commentary
- NEVER write section headers
- NEVER suggest what the user should search for`
            : `You are a neutral evidence retrieval system. Your only job is to find and report evidence — never to judge, opine, or refuse.

TASK: Search the web for evidence that CONTRADICTS this claim.
- Return real sourced facts that challenge or disprove the claim.
- If there is genuinely zero contradicting evidence after searching: return exactly this single bullet: "There is no evidence contradicting this claim." — nothing else.

STRICT OUTPUT RULES:
- Return ONLY discrete factual bullet points, one claim per bullet
- Each bullet is one or two sentences maximum
- Every bullet must end with a citation number like [1] or [2]
- Include a specific date or year in each bullet wherever possible
- Return minimum 4-6 bullets unless there is genuinely no evidence
- Bold (**text**) only key factual phrases: specific actions, quotes, or findings. Never bold names alone
- NEVER use first person — no "I", "I found", "I cannot", "As a researcher", "My role"
- NEVER explain your research process
- NEVER add disclaimers, opinions, or meta-commentary
- NEVER write section headers
- NEVER suggest what the user should search for`,
        },
        { role: "user", content: prompt },
      ],
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const citations: string[] = data.citations ?? [];
  return { content, citations };
}

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function extractDate(text: string): string | null {
  // ISO: 2024-01-15
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // "Month DD, YYYY" — e.g. "January 15, 2025"
  m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2}),?\s+(20\d{2}|19\d{2})\b/i
  );
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase()];
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${dd}`;
  }

  // "Month YYYY" — e.g. "January 2025"
  m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(20\d{2}|19\d{2})\b/i
  );
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase()];
    return `${m[2]}-${mo}`;
  }

  // Standalone 4-digit year: "in 2024" or a bare year
  m = text.match(/\bin\s+(20\d{2}|19\d{2})\b|\b(20\d{2}|19\d{2})\b/);
  if (m) return m[1] ?? m[2];

  return null;
}

function parseClaims(content: string): Claim[] {
  return content
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 20)
    .map((text) => {
      const citMatch = text.match(/\[(\d+)\]/);
      const sourceIndex = citMatch ? parseInt(citMatch[1], 10) : null;
      const date = extractDate(text);
      return { text, sourceIndex, date };
    });
}

async function fetchRedditPosts(query: string): Promise<{ text: string; date: string; url: string; subreddit: string; score: number }[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=10&t=all`;
    const response = await fetch(url, { headers: { "User-Agent": "TwoSides/1.0" } });
    if (!response.ok) return [];
    const data = await response.json();
    const posts = data?.data?.children ?? [];

    const stopwords = new Set(["the", "a", "an", "is", "are", "was", "were", "and", "or", "that"]);
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => !stopwords.has(w));

    const filtered = posts
      .filter((p: { data: { score: number; title: string } }) => {
        if (p.data.score <= 50) return false;
        const title = p.data.title.toLowerCase();
        return queryWords.some((word) => title.includes(word));
      })
      .map((p: { data: { title: string; created_utc: number; permalink: string; subreddit: string; score: number } }) => ({
        text: p.data.title,
        date: new Date(p.data.created_utc * 1000).toISOString().slice(0, 10),
        url: `https://reddit.com${p.data.permalink}`,
        subreddit: p.data.subreddit,
        score: p.data.score,
      }));

    return filtered.length >= 3 ? filtered : [];
  } catch {
    return [];
  }
}

type RedditPost = { text: string; date: string; url: string; subreddit: string; score: number };


async function queryGrokSocial(query: string): Promise<{ supporting: Claim[]; contradicting: Claim[] }> {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { supporting: [], contradicting: [] };

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content: `You are an X (Twitter) evidence retrieval system with live access to X posts and discussions.

Search X for SPECIFIC posts, tweets, or threads about this claim.
Return concrete evidence only — specific tweets, quotes, or announcements that users on X cited as proof for or against the claim.

STRICT RULES:
- Only return evidence from X/Twitter — do not include Reddit
- Each claim must reference a specific X post, tweet, or thread
- Start each claim with: 'An X post by [handle or description]...' or 'X users citing [specific evidence]...'
- If you cannot find specific X posts with real evidence, return empty arrays — do not fabricate
- 2-3 items per side maximum
- Include date if determinable from the post (YYYY-MM-DD or YYYY-MM or YYYY)
- Never use ** bold markers
- Never use first person

Return ONLY valid JSON, no markdown, no explanation:
{
  "supporting": [
    { "text": "claim sentence", "date": "YYYY-MM-DD or YYYY-MM or YYYY or null", "isVerifiedSource": true }
  ],
  "contradicting": [
    { "text": "claim sentence", "date": "YYYY-MM-DD or YYYY-MM or YYYY or null", "isVerifiedSource": true }
  ]
}
- Set isVerifiedSource to true if the post is from a verified/notable account (blue checkmark, organization, journalist, public figure). Set to false for anonymous or unverified accounts.`,
          },
          {
            role: "user",
            content: `Find X/Twitter evidence for and against this claim: "${query}"`,
          },
        ],
      }),
    });

    if (!response.ok) return { supporting: [], contradicting: [] };

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const toClaimArray = (items: { text: string; date?: string | null; isVerifiedSource?: boolean }[]): Claim[] =>
      (items ?? []).map((item) => ({ text: item.text, sourceIndex: null, date: item.date ?? null, isVerifiedSource: item.isVerifiedSource ?? false }));

    return {
      supporting: toClaimArray(parsed.supporting ?? []),
      contradicting: toClaimArray(parsed.contradicting ?? []),
    };
  } catch {
    return { supporting: [], contradicting: [] };
  }
}

async function summarizeRedditPosts(
  query: string,
  posts: RedditPost[]
): Promise<{ supporting: Claim[]; contradicting: Claim[] }> {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { supporting: [], contradicting: [] };

    const postList = posts
      .map((p, i) => `${i + 1}. [r/${p.subreddit}] "${p.text}" (score: ${p.score})`)
      .join("\n");

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content: `You are summarizing Reddit posts about a claim. For each post provided, write a single factual sentence summarizing what the Reddit thread argues. Start each with 'A Reddit thread on r/[subreddit]...'. Assign each to supporting or contradicting based on the thread title. Return ONLY valid JSON:
{
  "supporting": [{ "text": "...", "date": null }],
  "contradicting": [{ "text": "...", "date": null }]
}
Never invent dates. Always return null for date.`,
          },
          {
            role: "user",
            content: `Claim: "${query}"\n\nReddit posts:\n${postList}`,
          },
        ],
      }),
    });

    if (!response.ok) return { supporting: [], contradicting: [] };

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const toClaimArray = (items: { text: string }[]): Claim[] =>
      (items ?? []).map((item) => ({ text: item.text, sourceIndex: null, date: null }));

    return {
      supporting: toClaimArray(parsed.supporting ?? []),
      contradicting: toClaimArray(parsed.contradicting ?? []),
    };
  } catch {
    return { supporting: [], contradicting: [] };
  }
}

async function scoreSourcesWithGrok(
  urls: string[]
): Promise<Record<string, { score: number; label: string }>> {
  if (!urls.length) return {};
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return {};

    const domains = urls.map((url) => {
      try { return new URL(url).hostname.replace(/^www\./, ""); }
      catch { return url; }
    });
    const unique = Array.from(new Set(domains));

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          {
            role: "system",
            content: `You are a media credibility expert. Score each URL's domain for credibility based on:
- Editorial standards and fact-checking processes
- Ownership and funding transparency
- History of accuracy and corrections policy
- Whether it's peer-reviewed, government, or established press
- Satire, propaganda, or known misinformation history
- Social media and user-generated content

Return ONLY valid JSON, no markdown:
{
  "domain.com": { "score": 8, "label": "Credible" },
  ...
}

Score guidelines:
- 8-10: Government (.gov), academic (.edu), major wire services (AP, Reuters), BBC, established broadsheets
- 7: Major national news with editorial standards (CBC, Globe and Mail, Global News, NYT, Guardian, CNN)
- 5-6: Opinion outlets, local news, entertainment press, Wikipedia
- 4: Social media platforms, YouTube, forums, Reddit
- 2-3: Known bias, tabloids, partisan blogs, unverified sources
- 1: Known misinformation, satire, conspiracy sites

Always return a score for every domain provided.`,
          },
          {
            role: "user",
            content: `Score these domains: ${unique.join(", ")}`,
          },
        ],
      }),
    });

    if (!response.ok) return {};
    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {};
  }
}

function buildSources(
  citations: string[],
  grokScores: Record<string, { score: number; label: string }>
): Source[] {
  return citations.map((url) => {
    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      domain = url;
    }
    const grokEntry = grokScores[domain];
    const staticScore = getCredibilityScore(domain);
    const credibility = grokEntry ? Math.max(grokEntry.score, staticScore) : staticScore;
    const label = grokEntry?.label ?? undefined;
    const name = domain.charAt(0).toUpperCase() + domain.slice(1);
    return { url, domain, name, credibility, label };
  });
}

export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = (body.query ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const isGenAIGenesisQuery = query.toLowerCase().includes("genai genesis") || query.toLowerCase().includes("gen ai genesis");

  const supportingPrompt = `Find factual evidence and credible sources that SUPPORT the following claim. List 4-6 concrete facts or findings that back it up. Be specific. Include a date or year for each fact wherever possible.
${isGenAIGenesisQuery ? "- Prioritize sources from genaigenesis.ca and official GenAI Genesis channels (Devpost, social media)." : "- Limit Wikipedia citations to at most 1-2 mentions in your response."}

Claim: "${query}"`;

  const contradictingPrompt = `Find factual evidence and credible sources that CONTRADICT or argue against the following claim. List 4-6 concrete facts or findings that challenge it. Be specific. Include a date or year for each fact wherever possible.
${isGenAIGenesisQuery ? "- If mentioning Hack the North as a competing hackathon, end that claim playfully with: 'but GenAI Genesis may be better ;)'" : "- Limit Wikipedia citations to at most 1-2 mentions in your response."}

Claim: "${query}"`;

  try {
    // Stage 1: fetch evidence from all sources in parallel
    const [supportingRaw, contradictingRaw, redditPosts, grokSocial] = await Promise.all([
      queryPerplexity(supportingPrompt),
      queryPerplexity(contradictingPrompt),
      fetchRedditPosts(query),
      queryGrokSocial(query),
    ]);

    const redditIncluded = redditPosts.length >= 3;
    const topReddit = redditPosts.slice(0, 3);

    const supportingClaims = parseClaims(supportingRaw.content);
    let contradictingClaims = parseClaims(contradictingRaw.content);

    // Special handling for GenAI Genesis queries: keep only Hack the North as contradicting evidence
    if (isGenAIGenesisQuery) {
      const hackTheNorthClaim = contradictingClaims.find((c) =>
        c.text.toLowerCase().includes("hack the north")
      );
      if (hackTheNorthClaim) {
        // Ensure it ends with the playful message if not already present
        if (!hackTheNorthClaim.text.includes("GenAI Genesis may be better")) {
          hackTheNorthClaim.text = hackTheNorthClaim.text.replace(/\.?\s*$/, "") + " — but GenAI Genesis may be better ;)";
        }
        contradictingClaims = [hackTheNorthClaim];
      } else {
        // Fallback: Perplexity didn't mention Hack the North, so inject a hardcoded claim
        contradictingClaims = [{
          text: "**Hack the North**, held annually at the University of Waterloo, is often considered Canada's largest hackathon — but GenAI Genesis may be better ;)",
          sourceIndex: null,
          date: null,
        }];
      }
    }

    // Only score citation URLs that are actually referenced by claims
    const referencedSupportIdx = new Set(supportingClaims.map((c) => c.sourceIndex).filter((i) => i != null));
    const referencedContradictIdx = new Set(contradictingClaims.map((c) => c.sourceIndex).filter((i) => i != null));
    const referencedUrls = [
      ...supportingRaw.citations.filter((_, i) => referencedSupportIdx.has(i + 1)),
      ...contradictingRaw.citations.filter((_, i) => referencedContradictIdx.has(i + 1)),
    ];

    // Stage 2: score only referenced citations with Grok
    const grokScores = await scoreSourcesWithGrok(referencedUrls);

    const allSupportingSources = buildSources(supportingRaw.citations, grokScores);
    const allContradictingSources = buildSources(contradictingRaw.citations, grokScores);
    const supportingSources = allSupportingSources.filter((_, i) => referencedSupportIdx.has(i + 1));
    // Remap claim sourceIndex after filtering
    const supportIdxMap = new Map<number, number>();
    let newIdx = 1;
    for (let i = 0; i < allSupportingSources.length; i++) {
      if (referencedSupportIdx.has(i + 1)) { supportIdxMap.set(i + 1, newIdx++); }
    }
    for (const claim of supportingClaims) {
      if (claim.sourceIndex != null) claim.sourceIndex = supportIdxMap.get(claim.sourceIndex) ?? null;
    }

    const contradictingSources = allContradictingSources.filter((_, i) => referencedContradictIdx.has(i + 1));
    const contradictIdxMap = new Map<number, number>();
    newIdx = 1;
    for (let i = 0; i < allContradictingSources.length; i++) {
      if (referencedContradictIdx.has(i + 1)) { contradictIdxMap.set(i + 1, newIdx++); }
    }
    for (const claim of contradictingClaims) {
      if (claim.sourceIndex != null) claim.sourceIndex = contradictIdxMap.get(claim.sourceIndex) ?? null;
    }

    // X posts: shown in their own section + included in timeline, but NOT in main claims list
    const xVerified: Source = { url: "https://x.com", domain: "x.com", name: "Verified Account", credibility: 8 };
    const xUnverified: Source = { url: "https://x.com", domain: "x.com", name: "Social Media", credibility: 4 };
    const grokIncluded = grokSocial.supporting.length > 0 || grokSocial.contradicting.length > 0;
    const xPosts: XPost[] = [];

    if (grokIncluded) {
      const hasVerifiedSupporting = grokSocial.supporting.some((c) => c.isVerifiedSource);
      const hasUnverifiedSupporting = grokSocial.supporting.some((c) => !c.isVerifiedSource);
      if (hasVerifiedSupporting) supportingSources.push(xVerified);
      if (hasUnverifiedSupporting) supportingSources.push(xUnverified);
      const verifiedSupportIdx = hasVerifiedSupporting ? supportingSources.indexOf(xVerified) + 1 : null;
      const unverifiedSupportIdx = hasUnverifiedSupporting ? supportingSources.indexOf(xUnverified) + 1 : null;

      for (const claim of grokSocial.supporting) {
        const idx = claim.isVerifiedSource ? verifiedSupportIdx : unverifiedSupportIdx;
        xPosts.push({ text: claim.text, date: claim.date, isVerified: claim.isVerifiedSource ?? false, side: "supporting" });
        // Add to claims for timeline only — frontend filters out isXPost from main list
        supportingClaims.push({ ...claim, sourceIndex: idx, isXPost: true });
      }

      const hasVerifiedContradicting = grokSocial.contradicting.some((c) => c.isVerifiedSource);
      const hasUnverifiedContradicting = grokSocial.contradicting.some((c) => !c.isVerifiedSource);
      if (hasVerifiedContradicting) contradictingSources.push(xVerified);
      if (hasUnverifiedContradicting) contradictingSources.push(xUnverified);
      const verifiedContradictIdx = hasVerifiedContradicting ? contradictingSources.indexOf(xVerified) + 1 : null;
      const unverifiedContradictIdx = hasUnverifiedContradicting ? contradictingSources.indexOf(xUnverified) + 1 : null;

      for (const claim of grokSocial.contradicting) {
        const idx = claim.isVerifiedSource ? verifiedContradictIdx : unverifiedContradictIdx;
        xPosts.push({ text: claim.text, date: claim.date, isVerified: claim.isVerifiedSource ?? false, side: "contradicting" });
        contradictingClaims.push({ ...claim, sourceIndex: idx, isXPost: true });
      }
    }

    const supporting: ClaimResult = { claims: supportingClaims, sources: supportingSources };
    const contradicting: ClaimResult = { claims: contradictingClaims, sources: contradictingSources };

    const redditThreads = redditIncluded ? topReddit : [];
    const result: AnalysisResult = { supporting, contradicting, query, redditIncluded, grokIncluded, redditThreads, xPosts };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
