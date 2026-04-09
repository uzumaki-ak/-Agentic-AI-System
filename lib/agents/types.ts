// this file defines shared types for the agent pipeline

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelCallTrace = {
  provider: string;
  model: string;
  success: boolean;
  error?: string;
};

export type NoteRecord = {
  slug: string;
  title: string;
  path: string;
  content: string;
  updatedAt: string;
};

export type ResearchResult = {
  matchedNotes: NoteRecord[];
  snippets: string[];
};

export type SummaryResult = {
  summary: string;
  modelTrace: ModelCallTrace[];
};

export type WriterResult = {
  markdown: string;
  modelTrace: ModelCallTrace[];
};

export type LinkerResult = {
  topics: string[];
  modelTrace: ModelCallTrace[];
};

export type ValidatorResult = {
  passed: boolean;
  score: number;
  issues: string[];
  modelTrace: ModelCallTrace[];
};

export type AgentRunResult = {
  query: string;
  finalMarkdown: string;
  summary: string;
  validation: ValidatorResult;
  linkedTopics: string[];
  usedNoteTitles: string[];
  touchedFiles: string[];
  traces: ModelCallTrace[];
  savedNotePreview: string;
};
