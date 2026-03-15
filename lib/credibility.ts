// Credibility scores for known domains (1-10)
// 10 = highly credible primary source, 1 = known misinformation/satire
const credibilityMap: Record<string, number> = {
  // Government & International Organizations
  "gov": 9,
  "un.org": 9,
  "who.int": 9,
  "europa.eu": 9,
  "nato.int": 9,

  // Academic & Research
  "edu": 8,
  "scholar.google.com": 8,
  "pubmed.ncbi.nlm.nih.gov": 9,
  "arxiv.org": 7,
  "jstor.org": 8,
  "nature.com": 9,
  "sciencemag.org": 9,
  "thelancet.com": 9,
  "nejm.org": 9,
  "bmj.com": 9,

  // Major Fact-Checkers
  "factcheck.org": 9,
  "politifact.com": 8,
  "snopes.com": 8,
  "fullfact.org": 8,

  // High-Credibility News (mainstream, editorial standards)
  "reuters.com": 9,
  "apnews.com": 9,
  "bbc.com": 8,
  "bbc.co.uk": 8,
  "theguardian.com": 8,
  "nytimes.com": 8,
  "washingtonpost.com": 8,
  "wsj.com": 8,
  "economist.com": 8,
  "ft.com": 8,
  "npr.org": 8,
  "pbs.org": 8,
  "nbcnews.com": 7,
  "cbsnews.com": 7,
  "abcnews.go.com": 7,
  "cnn.com": 7,
  "politico.com": 7,
  "thehill.com": 7,
  "axios.com": 7,
  "time.com": 7,
  "usatoday.com": 7,
  "bloomberg.com": 8,
  "foreignpolicy.com": 8,
  "foreignaffairs.com": 9,
  "vox.com": 6,
  "slate.com": 6,
  "theatlantic.com": 7,
  "newyorker.com": 8,

  // Think Tanks / Research Institutes
  "brookings.edu": 8,
  "cfr.org": 8,
  "rand.org": 8,
  "pewresearch.org": 8,
  "heritage.org": 6,
  "cato.org": 6,

  // Moderate Credibility
  "huffpost.com": 5,
  "dailymail.co.uk": 4,
  "nypost.com": 5,
  "foxnews.com": 5,
  "msnbc.com": 5,
  "motherjones.com": 6,
  "thedailybeast.com": 5,
  "vice.com": 5,
  "buzzfeednews.com": 6,

  // Lower Credibility / Partisan / Tabloid
  "breitbart.com": 2,
  "infowars.com": 1,
  "naturalnews.com": 1,
  "thegatewaypundit.com": 1,
  "zerohedge.com": 2,
  "rt.com": 2,
  "sputniknews.com": 2,
  "theonion.com": 1, // satire
  "babylon.bee": 1,  // satire
  "babylonbee.com": 1,

  // Wikipedia (useful but not primary)
  "en.wikipedia.org": 6,
  "wikipedia.org": 6,

  // Canadian News
  "globalnews.ca": 7,
  "cbc.ca": 8,

  // GenAI Genesis Hackathon
  "genaigenesis.ca": 10,
  "genai-genesis-2026.devpost.com": 10,
  "devpost.com": 8, // elevated for GenAI Genesis context

  // Social Media (low for factual claims)
  "twitter.com": 4,
  "x.com": 4,
  "facebook.com": 2,
  "reddit.com": 4,
  "youtube.com": 4,
  "tiktok.com": 2,
  "instagram.com": 2,
};

export function getCredibilityScore(domain: string): number {
  // Exact match
  if (credibilityMap[domain] !== undefined) {
    return credibilityMap[domain];
  }

  // TLD-level match (e.g., .gov, .edu)
  const tld = domain.split(".").slice(-1)[0];
  if (tld && credibilityMap[tld] !== undefined) {
    return credibilityMap[tld];
  }

  // Check if any key is a suffix of the domain (e.g., "bbc.com" matches "www.bbc.com")
  for (const [key, score] of Object.entries(credibilityMap)) {
    if (domain.endsWith(key) || domain === key) {
      return score;
    }
  }

  // Default: unknown domain gets a conservative score
  return 4;
}

export function getCredibilityLabel(score: number): string {
  if (score >= 9) return "Highly Credible";
  if (score >= 7) return "Credible";
  if (score >= 5) return "Mixed";
  if (score >= 3) return "Low Credibility";
  return "Unreliable";
}

export function getCredibilityColor(score: number): string {
  if (score >= 9) return "bg-green-600";
  if (score >= 7) return "bg-green-500";
  if (score >= 5) return "bg-yellow-500";
  if (score >= 3) return "bg-orange-500";
  return "bg-red-600";
}
