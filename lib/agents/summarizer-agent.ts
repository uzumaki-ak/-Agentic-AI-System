// this file runs the summarizer agent
import { readTraceFromError, runWithFallback } from "@/lib/agents/models";
import { ResearchResult, SummaryResult } from "@/lib/agents/types";

// this function builds a deterministic summary when no model call succeeds
function fallbackSummary(query: string, research: ResearchResult): string {
  const notes = research.matchedNotes.map((note) => note.title).join(", ");
  const lines: string[] = [];
  lines.push(`query focus: ${query}`);
  if (notes) {
    lines.push(`matched notes: ${notes}`);
  }
  if (research.snippets.length > 0) {
    lines.push(`core context: ${research.snippets.slice(0, 2).join(" ")}`);
  }
  lines.push("next step: write a structured answer using these notes.");
  return lines.join("\n");
}

// this function summarizes researched context for the writer agent
export async function runSummarizerAgent(
  query: string,
  research: ResearchResult
): Promise<SummaryResult> {
  const context = research.snippets.length
    ? research.snippets.map((snippet, index) => `${index + 1}. ${snippet}`).join("\n")
    : "no prior snippets found";

  try {
    const { text, trace } = await runWithFallback(
      [
        {
          role: "system",
          content:
            "you are a summarizer agent. write concise and factual markdown with 4 to 6 bullet lines."
        },
        {
          role: "user",
          content: [
            `query: ${query}`,
            "context snippets:",
            context,
            "task: produce a compact summary that helps a writer agent create a practical answer."
          ].join("\n")
        }
      ],
      { temperature: 0.2, maxTokens: 420 }
    );

    return {
      summary: text.trim(),
      modelTrace: trace
    };
  } catch (error) {
    return {
      summary: fallbackSummary(query, research),
      modelTrace: readTraceFromError(error)
    };
  }
}
