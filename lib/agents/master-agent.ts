// this file orchestrates all agents in sequence
import { runLinkerAgent } from "@/lib/agents/linker-agent";
import { runResearchAgent } from "@/lib/agents/research-agent";
import { runSummarizerAgent } from "@/lib/agents/summarizer-agent";
import { AgentRunResult } from "@/lib/agents/types";
import { runValidatorAgent } from "@/lib/agents/validator-agent";
import { runWriterAgent } from "@/lib/agents/writer-agent";
import { readAllNotes, saveCompiledNote } from "@/lib/knowledge/file-store";

// this function runs the master workflow from query to saved note
export async function runMasterAgent(query: string): Promise<AgentRunResult> {
  const notes = await readAllNotes();
  const research = runResearchAgent(query, notes);
  const summarizer = await runSummarizerAgent(query, research);
  const writer = await runWriterAgent(query, summarizer.summary, research);
  const linker = await runLinkerAgent(query, writer.markdown, notes);
  const validator = await runValidatorAgent(query, writer.markdown);

  const saved = await saveCompiledNote({
    query,
    summary: summarizer.summary,
    finalMarkdown: writer.markdown,
    linkedTopics: linker.topics,
    sourceNotes: research.matchedNotes,
    validation: validator
  });

  return {
    query,
    finalMarkdown: writer.markdown,
    summary: summarizer.summary,
    validation: validator,
    linkedTopics: linker.topics,
    usedNoteTitles: research.matchedNotes.map((note) => note.title),
    touchedFiles: saved.touchedFiles,
    traces: [
      ...summarizer.modelTrace,
      ...writer.modelTrace,
      ...linker.modelTrace,
      ...validator.modelTrace
    ],
    savedNotePreview: saved.preview
  };
}
