/**
 * Decide whether the input is a statement worth checking.
 * Greetings, questions and very short inputs get a prompt to write a claim instead.
 * Runs on the client for instant feedback and on the server as a guard.
 */

export const EXAMPLE_CLAIM = "Coffee is bad for your health";

export type ClaimCheck =
  | { ok: true }
  | { ok: false; kind: "empty" | "greeting" | "question" | "short"; message: string };

const GREETING_WORDS = new Set([
  "hi", "hello", "hey", "hiya", "heya", "yo", "sup", "howdy", "greetings",
  "thanks", "thank", "thx", "bonjour", "salut", "hola", "privet", "привет", "сәлем",
]);

// Words that start real claims too, so they only count when they are the whole message
const GREETING_ONLY = /^(morning|ok(ay)?|test(ing)?|yes|no|lol)[\s!.,]*$/i;
const GOOD_TIME = /^good (morning|afternoon|evening|day)\b/i;

// Openers that make a sentence a question rather than a claim
const QUESTION_START =
  /^(who|whom|whose|what|when|where|why|how|which|is|are|am|was|were|do|does|did|can|could|should|would|has|have|had|isn't|aren't|don't|doesn't|didn't|can't|shouldn't|tell me|explain|help me)\b/i;

const example = `for example “${EXAMPLE_CLAIM}.”`;

export function checkClaim(raw: string): ClaimCheck {
  const text = raw.trim();
  if (!text) {
    return { ok: false, kind: "empty", message: `Type a statement to check, ${example}` };
  }

  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (
    (words.length <= 4 && (GREETING_WORDS.has(words[0]) || GOOD_TIME.test(text))) ||
    GREETING_ONLY.test(text)
  ) {
    return {
      ok: false,
      kind: "greeting",
      message: `Hi! Two Sides weighs evidence for and against a claim. Type a statement, ${example}`,
    };
  }

  if (text.endsWith("?") || QUESTION_START.test(text)) {
    return {
      ok: false,
      kind: "question",
      message: `That reads like a question. Rephrase it as a statement to check, ${example}`,
    };
  }

  if (words.length < 3) {
    return {
      ok: false,
      kind: "short",
      message: `Add a little more. Write a full statement, ${example}`,
    };
  }

  return { ok: true };
}
