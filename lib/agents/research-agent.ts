// this file contains the research agent logic
import { NoteRecord, ResearchResult } from "@/lib/agents/types";
import { pickSentenceSnippet, uniqueWords } from "@/lib/utils/text";

// this function scores note relevance against query keywords
function scoreNote(note: NoteRecord, keywords: string[]): number {
  const haystack = `${note.title}\n${note.content}`.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

// this function selects relevant notes and snippets for other agents
export function runResearchAgent(query: string, notes: NoteRecord[]): ResearchResult {
  const keywords = uniqueWords(query);

  const scored = notes
    .map((note) => ({
      note,
      score: scoreNote(note, keywords)
    }))
    .sort((a, b) => b.score - a.score || b.note.updatedAt.localeCompare(a.note.updatedAt));

  const matched = scored
    .filter((item) => item.score > 0)
    .slice(0, 4)
    .map((item) => item.note);

  const fallback = scored.slice(0, 2).map((item) => item.note);
  const chosen = matched.length > 0 ? matched : fallback;

  const snippets = chosen
    .map((note) => pickSentenceSnippet(note.content, keywords))
    .filter(Boolean);

  return {
    matchedNotes: chosen,
    snippets
  };
}
