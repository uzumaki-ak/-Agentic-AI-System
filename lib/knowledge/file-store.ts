// this file manages local markdown knowledge notes and graph files
import fs from "node:fs/promises";
import path from "node:path";
import { NoteRecord, ValidatorResult } from "@/lib/agents/types";
import { dedupeList, toSlug, toTitle } from "@/lib/utils/text";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");
const NOTES_ROOT = path.join(KNOWLEDGE_ROOT, "notes");
const INDEX_FILE = path.join(KNOWLEDGE_ROOT, "index.md");
const GRAPH_FILE = path.join(KNOWLEDGE_ROOT, "graph.json");

type SaveCompiledNoteInput = {
  query: string;
  summary: string;
  finalMarkdown: string;
  linkedTopics: string[];
  sourceNotes: NoteRecord[];
  validation: ValidatorResult;
};

// this function makes a path readable in api responses
function toProjectRelative(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

// this function reads title from markdown content
function readTitle(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  const frontMatter = content.match(/^title:\s*(.+)$/m);
  if (frontMatter?.[1]) {
    return frontMatter[1].trim();
  }
  return fallback;
}

// this function reads updated time from markdown content
function readUpdated(content: string): string {
  const frontMatter = content.match(/^updated:\s*(.+)$/m);
  if (frontMatter?.[1]) {
    return frontMatter[1].trim();
  }
  return new Date(0).toISOString();
}

// this function extracts wiki links from markdown
function collectWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    const value = toSlug(match[1] ?? "");
    if (value) {
      links.push(value);
    }
    match = regex.exec(content);
  }
  return dedupeList(links);
}

// this function ensures local folders and base files exist
export async function ensureKnowledgeStore(): Promise<void> {
  await fs.mkdir(NOTES_ROOT, { recursive: true });

  try {
    await fs.access(INDEX_FILE);
  } catch {
    await fs.writeFile(INDEX_FILE, "# knowledge index\n\nlast updated: never\n\n## notes\n", "utf8");
  }

  try {
    await fs.access(GRAPH_FILE);
  } catch {
    await fs.writeFile(
      GRAPH_FILE,
      JSON.stringify({ updatedAt: "never", nodes: [], edges: [] }, null, 2),
      "utf8"
    );
  }
}

// this function reads every markdown note in the knowledge folder
export async function readAllNotes(): Promise<NoteRecord[]> {
  await ensureKnowledgeStore();
  const entries = await fs.readdir(NOTES_ROOT, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);

  const notes: NoteRecord[] = [];

  for (const name of files) {
    const fullPath = path.join(NOTES_ROOT, name);
    const content = await fs.readFile(fullPath, "utf8");
    const slug = toSlug(name.replace(/\.md$/i, ""));
    notes.push({
      slug,
      title: readTitle(content, toTitle(slug.replace(/-/g, " "))),
      path: toProjectRelative(fullPath),
      content,
      updatedAt: readUpdated(content)
    });
  }

  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// this function builds index and graph files from all notes
async function rebuildIndexAndGraph(notes: NoteRecord[]): Promise<void> {
  const now = new Date().toISOString();

  const indexLines = [
    "# knowledge index",
    "",
    `last updated: ${now}`,
    "",
    "## notes"
  ];

  for (const note of notes) {
    indexLines.push(`- [${note.title}](notes/${note.slug}.md) updated ${note.updatedAt}`);
  }

  await fs.writeFile(INDEX_FILE, `${indexLines.join("\n")}\n`, "utf8");

  const nodes = notes.map((note) => ({
    slug: note.slug,
    title: note.title,
    path: note.path,
    updatedAt: note.updatedAt
  }));

  const edges: Array<{ from: string; to: string }> = [];
  for (const note of notes) {
    const links = collectWikiLinks(note.content);
    for (const link of links) {
      edges.push({ from: note.slug, to: link });
    }
  }

  await fs.writeFile(
    GRAPH_FILE,
    JSON.stringify(
      {
        updatedAt: now,
        nodes,
        edges
      },
      null,
      2
    ),
    "utf8"
  );
}

// this function composes markdown content for a compiled note
function buildNoteMarkdown(input: SaveCompiledNoteInput, noteTitle: string): string {
  const now = new Date().toISOString();
  const cleanQuery = input.query.replace(/\s+/g, " ").trim();

  const sourceLinks =
    input.sourceNotes.length > 0
      ? input.sourceNotes.map((note) => `- [[${note.slug}]]`).join("\n")
      : "- none";

  const relatedLinks = dedupeList(input.linkedTopics.map((topic) => toSlug(topic)).filter(Boolean));
  const relatedBlock =
    relatedLinks.length > 0
      ? relatedLinks.map((topic) => `- [[${topic}]]`).join("\n")
      : "- none";

  return [
    "---",
    `title: ${noteTitle}`,
    `updated: ${now}`,
    `query: ${cleanQuery}`,
    "---",
    "",
    `# ${noteTitle}`,
    "",
    "## summary",
    input.summary.trim(),
    "",
    "## answer",
    input.finalMarkdown.trim(),
    "",
    "## related topics",
    relatedBlock,
    "",
    "## source notes",
    sourceLinks,
    "",
    "## validator",
    `passed: ${input.validation.passed ? "yes" : "no"}`,
    `score: ${input.validation.score}`,
    ...(input.validation.issues.length > 0
      ? ["issues:", ...input.validation.issues.map((issue) => `- ${issue}`)]
      : ["issues:", "- none"]),
    ""
  ].join("\n");
}

// this function writes or updates the compiled note and refreshes graph files
export async function saveCompiledNote(
  input: SaveCompiledNoteInput
): Promise<{ touchedFiles: string[]; preview: string }> {
  await ensureKnowledgeStore();

  const slug = toSlug(input.query) || `note-${Date.now()}`;
  const title = toTitle(input.query);
  const filePath = path.join(NOTES_ROOT, `${slug}.md`);
  const noteMarkdown = buildNoteMarkdown(input, title);

  await fs.writeFile(filePath, noteMarkdown, "utf8");

  const notes = await readAllNotes();
  await rebuildIndexAndGraph(notes);

  return {
    touchedFiles: [
      toProjectRelative(filePath),
      toProjectRelative(INDEX_FILE),
      toProjectRelative(GRAPH_FILE)
    ],
    preview: noteMarkdown.slice(0, 1800)
  };
}
