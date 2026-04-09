---
title: Model fallback strategy
updated: 2026-04-09T11:10:00.000Z
query: resilient low cost provider fallback for multi agent loops
---

# Model fallback strategy

## summary
fallback chains keep the workflow reliable when free tier quotas, outages, or rate limits interrupt one provider.

## answer
### provider order used in this project
1. direct google gemini api for `gemini-2.5-flash`
2. openrouter free router `openrouter/free`
3. groq low latency model
4. euron fallback models including `gpt-4.1-nano`

### implementation rules
- read model lists from env vars only
- try provider model pairs in deterministic order
- record every success and failure in a trace array
- return deterministic local fallback content if all providers fail

### cost and reliability controls
- keep temperature low for utility agents
- keep max tokens constrained per agent role
- use short prompts for summarizer linker validator
- monitor trace logs for frequent fallback hops

### practical outcome
- query handling stays fast in normal conditions
- system remains usable when one provider is unavailable
- output quality remains structured even in degraded mode

## related topics
- [[agentic-workflow-basics]]
- [[markdown-knowledge-graph]]
- [[deployment-persistence-on-vercel]]

## source notes
- https://openrouter.ai/openrouter/free/api
- https://ai.google.dev/gemini-api/docs/openai
