// this file manages local markdown knowledge notes and graph files
import fs from "node:fs/promises";
import path from "node:path";
import { NoteRecord, ValidatorResult } from "@/lib/agents/types";
import { dedupeList, toSlug, toTitle } from "@/lib/utils/text";

const PROJECT_KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");
const RUNTIME_KNOWLEDGE_ROOT =
  process.env.KNOWLEDGE_RUNTIME_ROOT ??
  (process.env.VERCEL ? path.join("/tmp", "agentic-knowledge") : PROJECT_KNOWLEDGE_ROOT);

type KnowledgePaths = {
  root: string;
  notesRoot: string;
  indexFile: string;
  graphFile: string;
};

const projectPaths: KnowledgePaths = {
  root: PROJECT_KNOWLEDGE_ROOT,
  notesRoot: path.join(PROJECT_KNOWLEDGE_ROOT, "notes"),
  indexFile: path.join(PROJECT_KNOWLEDGE_ROOT, "index.md"),
  graphFile: path.join(PROJECT_KNOWLEDGE_ROOT, "graph.json")
};

const runtimePaths: KnowledgePaths = {
  root: RUNTIME_KNOWLEDGE_ROOT,
  notesRoot: path.join(RUNTIME_KNOWLEDGE_ROOT, "notes"),
  indexFile: path.join(RUNTIME_KNOWLEDGE_ROOT, "index.md"),
  graphFile: path.join(RUNTIME_KNOWLEDGE_ROOT, "graph.json")
};

type SaveCompiledNoteInput = {
  query: string;
  summary: string;
  finalMarkdown: string;
  linkedTopics: string[];
  sourceNotes: NoteRecord[];
  validation: ValidatorResult;
};

// this function makes a path readable in api responses
function toDisplayPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const cwdPath = process.cwd().replace(/\\/g, "/");
  const runtimeRoot = runtimePaths.root.replace(/\\/g, "/");

  if (normalized.startsWith(`${cwdPath}/`)) {
    return normalized.slice(cwdPath.length + 1);
  }

  if (normalized.startsWith(`${runtimeRoot}/`)) {
    return `runtime-knowledge/${normalized.slice(runtimeRoot.length + 1)}`;
  }

  return normalized;
}

// this function detects if runtime writes use a separate storage root
function usesSeparateRuntimeStore(): boolean {
  return path.resolve(runtimePaths.root) !== path.resolve(projectPaths.root);
}

// this function checks if a file path exists
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// this function returns markdown filenames from one notes directory
async function readNoteFilenames(notesRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(notesRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

// this function writes a file only if missing
async function writeIfMissing(filePath: string, content: string): Promise<void> {
  if (await pathExists(filePath)) {
    return;
  }
  await fs.writeFile(filePath, content, "utf8");
}

// this function copies base knowledge notes into runtime storage when empty
async function seedRuntimeNotesIfEmpty(): Promise<void> {
  if (!usesSeparateRuntimeStore()) {
    return;
  }

  const runtimeFiles = await readNoteFilenames(runtimePaths.notesRoot);
  if (runtimeFiles.length > 0) {
    return;
  }

  const projectFiles = await readNoteFilenames(projectPaths.notesRoot);
  for (const name of projectFiles) {
    const sourcePath = path.join(projectPaths.notesRoot, name);
    const targetPath = path.join(runtimePaths.notesRoot, name);
    try {
      const content = await fs.readFile(sourcePath, "utf8");
      await fs.writeFile(targetPath, content, "utf8");
    } catch {
      // no op
    }
  }
}

// this function initializes runtime index and graph files
async function ensureRuntimeIndexFiles(): Promise<void> {
  if (usesSeparateRuntimeStore()) {
    if (!(await pathExists(runtimePaths.indexFile)) && (await pathExists(projectPaths.indexFile))) {
      const source = await fs.readFile(projectPaths.indexFile, "utf8");
      await fs.writeFile(runtimePaths.indexFile, source, "utf8");
    }
    if (!(await pathExists(runtimePaths.graphFile)) && (await pathExists(projectPaths.graphFile))) {
      const source = await fs.readFile(projectPaths.graphFile, "utf8");
      await fs.writeFile(runtimePaths.graphFile, source, "utf8");
    }
  }

  await writeIfMissing(runtimePaths.indexFile, "# knowledge index\n\nlast updated: never\n\n## notes\n");
  await writeIfMissing(
    runtimePaths.graphFile,
    JSON.stringify({ updatedAt: "never", nodes: [], edges: [] }, null, 2)
  );
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
  await fs.mkdir(runtimePaths.notesRoot, { recursive: true });
  await seedRuntimeNotesIfEmpty();
  await ensureRuntimeIndexFiles();
}

// this function reads notes from one specific notes directory
async function readNotesFromRoot(notesRoot: string): Promise<NoteRecord[]> {
  const files = await readNoteFilenames(notesRoot);
  const notes: NoteRecord[] = [];

  for (const name of files) {
    const fullPath = path.join(notesRoot, name);
    try {
      const content = await fs.readFile(fullPath, "utf8");
      const slug = toSlug(name.replace(/\.md$/i, ""));
      notes.push({
        slug,
        title: readTitle(content, toTitle(slug.replace(/-/g, " "))),
        path: toDisplayPath(fullPath),
        content,
        updatedAt: readUpdated(content)
      });
    } catch {
      // no op
    }
  }

  return notes;
}

// this function reads every markdown note in the knowledge folder
export async function readAllNotes(): Promise<NoteRecord[]> {
  await ensureKnowledgeStore();

  const merged = new Map<string, NoteRecord>();
  const projectNotes = await readNotesFromRoot(projectPaths.notesRoot);
  for (const note of projectNotes) {
    merged.set(note.slug, note);
  }

  const runtimeNotes = await readNotesFromRoot(runtimePaths.notesRoot);
  for (const note of runtimeNotes) {
    merged.set(note.slug, note);
  }

  return Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// this function builds index and graph files from all notes
async function rebuildIndexAndGraph(notes: NoteRecord[], target: KnowledgePaths): Promise<void> {
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

  await fs.writeFile(target.indexFile, `${indexLines.join("\n")}\n`, "utf8");

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
    target.graphFile,
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
  const filePath = path.join(runtimePaths.notesRoot, `${slug}.md`);
  const noteMarkdown = buildNoteMarkdown(input, title);

  try {
    await fs.writeFile(filePath, noteMarkdown, "utf8");

    const notes = await readAllNotes();
    await rebuildIndexAndGraph(notes, runtimePaths);

    return {
      touchedFiles: [
        toDisplayPath(filePath),
        toDisplayPath(runtimePaths.indexFile),
        toDisplayPath(runtimePaths.graphFile)
      ],
      preview: noteMarkdown.slice(0, 1800)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "write failed";
    return {
      touchedFiles: [`write skipped: ${message}`],
      preview: noteMarkdown.slice(0, 1800)
    };
  }
}
