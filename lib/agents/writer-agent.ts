// this file runs the writer agent
import { readTraceFromError, runWithFallback } from "@/lib/agents/models";
import { ResearchResult, WriterResult } from "@/lib/agents/types";

// this function creates a clean fallback markdown response
function fallbackMarkdown(query: string, summary: string, research: ResearchResult): string {
  const noteLine =
    research.matchedNotes.length > 0
      ? research.matchedNotes.map((note) => note.title).join(", ")
      : "none";

  return [
    "## final response",
    `for the query "${query}", this draft uses locally compiled knowledge notes and an agent workflow.`,
    "",
    "## key points",
    `- summary insight: ${summary.replace(/\s+/g, " ").slice(0, 220)}`,
    `- source notes used: ${noteLine}`,
    "- pipeline used: research to summarizer to writer to linker to validator",
    "",
    "## practical next steps",
    "- run another query to grow markdown notes over time",
    "- review linked topics and refine note quality",
    "- validate factual claims before publishing externally"
  ].join("\n");
}

// this function writes the main structured answer from summary and context
export async function runWriterAgent(
  query: string,
  summary: string,
  research: ResearchResult
): Promise<WriterResult> {
  const sourceBlock =
    research.matchedNotes.length > 0
      ? research.matchedNotes.map((note) => `- ${note.title}`).join("\n")
      : "- none";

  try {
    const { text, trace } = await runWithFallback(
      [
        {
          role: "system",
          content:
            "you are a writer agent. output clean markdown only with sections named final response key points practical next steps."
        },
        {
          role: "user",
          content: [
            `query: ${query}`,
            "",
            "summary from summarizer agent:",
            summary,
            "",
            "source note titles:",
            sourceBlock,
            "",
            "task: produce a polished concise practical answer for a hiring style assignment."
          ].join("\n")
        }
      ],
      { temperature: 0.35, maxTokens: 760 }
    );

    return {
      markdown: text.trim(),
      modelTrace: trace
    };
  } catch (error) {
    return {
      markdown: fallbackMarkdown(query, summary, research),
      modelTrace: readTraceFromError(error)
    };
  }
}
