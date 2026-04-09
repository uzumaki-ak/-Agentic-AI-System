// this file runs the linker agent
import { readTraceFromError, runWithFallback } from "@/lib/agents/models";
import { LinkerResult, NoteRecord } from "@/lib/agents/types";
import { dedupeList, toSlug, uniqueWords } from "@/lib/utils/text";

// this function parses topic json from model output
function parseTopics(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as { topics?: unknown };
    if (Array.isArray(parsed.topics)) {
      return dedupeList(
        parsed.topics
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
      ).slice(0, 8);
    }
  } catch {
    // no op
  }

  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as unknown[];
      return dedupeList(
        parsed
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
      ).slice(0, 8);
    } catch {
      // no op
    }
  }

  return [];
}

// this function returns topic links without model usage
function fallbackTopics(query: string, notes: NoteRecord[]): string[] {
  const fromQuery = uniqueWords(query).slice(0, 4).map((word) => word.replace(/\s+/g, " "));
  const fromNotes = notes
    .map((note) => note.slug)
    .filter(Boolean)
    .slice(0, 4);

  return dedupeList([...fromQuery, ...fromNotes]).slice(0, 8);
}

// this function creates topic links for the note graph
export async function runLinkerAgent(
  query: string,
  answerMarkdown: string,
  notes: NoteRecord[]
): Promise<LinkerResult> {
  try {
    const { text, trace } = await runWithFallback(
      [
        {
          role: "system",
          content:
            "you are a linker agent. return json only with key topics and value array of 3 to 8 short topic names."
        },
        {
          role: "user",
          content: [
            `query: ${query}`,
            "",
            "answer markdown:",
            answerMarkdown.slice(0, 2600),
            "",
            "known notes:",
            notes.map((note) => note.title).join(", "),
            "",
            'output format: {"topics":["topic one","topic two"]}'
          ].join("\n")
        }
      ],
      { temperature: 0.2, maxTokens: 260 }
    );

    const parsed = parseTopics(text).map((topic) => toSlug(topic)).filter(Boolean);
    return {
      topics: dedupeList(parsed),
      modelTrace: trace
    };
  } catch (error) {
    return {
      topics: fallbackTopics(query, notes).map((topic) => toSlug(topic)).filter(Boolean),
      modelTrace: readTraceFromError(error)
    };
  }
}
