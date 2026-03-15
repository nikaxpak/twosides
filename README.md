# Two Sides

> **Two Sides is a media literacy tool that doesn't decide what is true. It shows the evidence on both sides so you can decide for yourself.**

Most tools reduce complex claims to simple labels: True. False. Misleading. Two Sides takes a different approach — presenting the strongest supporting and contradicting evidence side-by-side, sourced from both formal reporting and the social media ecosystems where narratives often begin.

## Features

- Split-panel view of supporting and contradicting evidence for any claim
- AI-powered credibility scoring for each source
- Chronological timeline when evidence spans multiple months
- Sources pulled from web, news, X/Twitter, and Reddit

## How it works

- **Perplexity Sonar Pro** — two parallel searches per query, one for each side
- **Grok (xAI)** — live X/Twitter discussions and social sentiment
- **Reddit API** — forum conversations and community reactions
- Credibility scoring runs as a second pass once all sources are returned

## Built with

Next.js · Tailwind CSS · TypeScript · Perplexity API · xAI Grok API · Reddit API · Vercel

## Getting started

Clone the repo and install dependencies:
```bash
git clone https://github.com/nikaxpak/twosides
cd twosides
npm install
```

Create a `.env.local` file in the root with the following API keys:
```
PERPLEXITY_API_KEY=your_perplexity_key
XAI_API_KEY=your_xai_key
```

Then run locally:
```bash
npm run dev
```

Get your API keys from:
- Perplexity: [perplexity.ai](https://perplexity.ai) → Settings → API
- xAI Grok: [console.x.ai](https://console.x.ai)
