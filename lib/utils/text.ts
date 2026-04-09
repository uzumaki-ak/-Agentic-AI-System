// this file contains text helpers used across agents

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you"
]);

// this function converts free text into a clean slug
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

// this function creates a readable title from text
export function toTitle(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Untitled Note";
  }
  const first = clean.charAt(0).toUpperCase() + clean.slice(1);
  return first.slice(0, 90);
}

// this function returns important unique words for matching
export function uniqueWords(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return Array.from(new Set(tokens));
}

// this function picks one useful snippet from note content
export function pickSentenceSnippet(content: string, keywords: string[]): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  const lines = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let best = lines[0] ?? "";
  let bestScore = -1;

  for (const line of lines) {
    const lower = line.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  return best.slice(0, 240);
}

// this function removes duplicate strings while keeping order
export function dedupeList(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    output.push(clean);
  }

  return output;
}
