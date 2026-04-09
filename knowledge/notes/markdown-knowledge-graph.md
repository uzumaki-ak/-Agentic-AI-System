---
title: Markdown knowledge graph
updated: 2026-04-09T11:10:00.000Z
query: compiled knowledge memory with markdown files
---

# Markdown knowledge graph

## summary
markdown can act as a compiled knowledge layer when each note is atomic, linked, and indexed after every write.

## answer
### data model
- one topic per file under `knowledge/notes`
- frontmatter includes title updated query
- body includes summary answer related topics source notes

### linking strategy
- use `[[topic-slug]]` links to build a graph without external db
- keep slugs stable so references do not break
- include reciprocal links on important parent child concepts

### index and graph compilation
- `knowledge/index.md` is a human friendly note directory
- `knowledge/graph.json` is machine readable for tooling and visualizations
- rebuild both files after every note write to keep retrieval current

### why this is useful
- git diff friendly history for every knowledge change
- transparent memory that can be reviewed by humans
- low ops complexity for hackathon and interview demos

## related topics
- [[agentic-workflow-basics]]
- [[model-fallback-strategy]]
- [[agentic-launch-roadmap]]

## source notes
- https://ai.google.dev/gemini-api/docs/openai
