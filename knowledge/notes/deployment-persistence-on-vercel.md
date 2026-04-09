---
title: Deployment persistence on vercel
updated: 2026-04-09T11:10:00.000Z
query: deployment caveats for local markdown memory systems
---

# Deployment persistence on vercel

## summary
local markdown writes are great for local demos, but hosted serverless environments need persistent external storage for durable writes.

## answer
### local development behavior
- node runtime can write markdown files to the project folder
- note updates are immediately visible in git history
- this is ideal for interview demos and fast iteration

### hosted deployment caveat
- serverless and edge environments are ephemeral by design
- edge runtime has no filesystem access
- hosted writes should move to persistent storage for real products

### practical deployment pattern
- keep local markdown mode for dev and showcase
- add optional persistence adapter for cloud mode
- adapter options: object storage or database for durable note writes
- preserve the same note schema so agents do not change

### interview framing
- explain that this assignment intentionally prioritizes local compiled knowledge
- show that architecture is adapter ready for future persistence
- demonstrate awareness of deployment constraints and migration path

## related topics
- [[agentic-workflow-basics]]
- [[model-fallback-strategy]]
- [[agentic-launch-roadmap]]

## source notes
- https://vercel.com/docs/functions/runtimes/edge/edge-functions
