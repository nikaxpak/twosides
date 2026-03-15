export interface Source {
  url: string;
  domain: string;
  name: string;
  credibility: number; // 1-10
  label?: string;      // Grok credibility label (e.g. "Credible", "Known bias")
}

export interface Claim {
  text: string;
  sourceIndex: number | null; // 1-based citation index, null if no citation
  date: string | null;        // ISO partial: "YYYY-MM-DD", "YYYY-MM", or "YYYY". null if unknown.
  isVerifiedSource?: boolean; // true if from a verified X/Twitter account
  isXPost?: boolean;          // true if this claim came from X/Twitter via Grok
}

export interface ClaimResult {
  claims: Claim[];
  sources: Source[];
}

export interface RedditThread {
  text: string;
  url: string;
  subreddit: string;
  score: number;
  date: string;
}

export interface XPost {
  text: string;
  date: string | null;
  isVerified: boolean;
  side: "supporting" | "contradicting";
}

export interface AnalysisResult {
  supporting: ClaimResult;
  contradicting: ClaimResult;
  query: string;
  redditIncluded: boolean;
  grokIncluded: boolean;
  redditThreads: RedditThread[];
  xPosts: XPost[];
}
