// this file runs the writer agent
import { readTraceFromError, runWithFallback } from "@/lib/agents/models";
import { ResearchResult, WriterResult } from "@/lib/agents/types";

// this function checks if query asks for architecture style output
function needsArchitectureDiagram(query: string): boolean {
  return /(architecture|system design|\barch\b|diagram|flowchart|topology)/i.test(query);
}

// this function returns a default mermaid flowchart block
function buildMermaidBlock(query: string): string {
  const isAuthPlan = /(supabase|auth|authentication|authorization|login|jwt|session)/i.test(query);

  if (isAuthPlan) {
    return [
      "```mermaid",
      "flowchart TD",
      "  U[ui client] --> M[next middleware]",
      "  M --> A[api auth guard]",
      "  A --> S[supabase auth]",
      "  A --> O[master orchestrator]",
      "  O --> R[research agent]",
      "  O --> Z[summarizer agent]",
      "  O --> W[writer agent]",
      "  O --> L[linker agent]",
      "  O --> V[validator agent]",
      "  O --> K[(knowledge markdown store)]",
      "```"
    ].join("\n");
  }

  return [
    "```mermaid",
    "flowchart TD",
    "  Q[user query] --> O[master orchestrator]",
    "  O --> R[research agent]",
    "  O --> Z[summarizer agent]",
    "  O --> W[writer agent]",
    "  O --> L[linker agent]",
    "  O --> V[validator agent]",
    "  R --> K[(knowledge notes)]",
    "  W --> K",
    "  L --> G[(graph links)]",
    "  V --> F[final response]",
    "```"
  ].join("\n");
}

// this function appends a mermaid diagram when architecture output is requested
function ensureMermaidDiagram(query: string, markdown: string): string {
  if (!needsArchitectureDiagram(query)) {
    return markdown.trim();
  }

  if (/```mermaid[\s\S]*```/i.test(markdown)) {
    return markdown.trim();
  }

  return [
    markdown.trim(),
    "",
    "## architecture diagram",
    buildMermaidBlock(query)
  ].join("\n");
}

// this function creates a clean fallback markdown response
function fallbackMarkdown(query: string, summary: string, research: ResearchResult): string {
  const noteLine =
    research.matchedNotes.length > 0
      ? research.matchedNotes.map((note) => note.title).join(", ")
      : "none";

  const lines = [
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
  ];

  if (needsArchitectureDiagram(query)) {
    lines.push("", "## architecture diagram", buildMermaidBlock(query));
  }

  return lines.join("\n");
}

// this function writes the main structured answer from summary and context
export async function runWriterAgent(
  query: string,
  summary: string,
  research: ResearchResult
): Promise<WriterResult> {
  const wantsDiagram = needsArchitectureDiagram(query);
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
            wantsDiagram
              ? "important: add a section named architecture diagram containing exactly one valid mermaid flowchart code block."
              : "important: keep response concise and practical.",
            "",
            "task: produce a polished concise practical answer for a hiring style assignment."
          ].join("\n")
        }
      ],
      { temperature: 0.35, maxTokens: 760 }
    );

    return {
      markdown: ensureMermaidDiagram(query, text),
      modelTrace: trace
    };
  } catch (error) {
    return {
      markdown: fallbackMarkdown(query, summary, research),
      modelTrace: readTraceFromError(error)
    };
  }
}
