# mini agentic ai system

working mini agentic system built for a 3 to 4 hour hiring exercise.

## what this delivers
- master agent orchestrates the full pipeline
- five agents: research summarizer writer linker validator
- local markdown compiled knowledge store in `knowledge/notes`
- agents read notes then create or update structured notes and links
- simple black and white ui with live animated agent states
- multi provider model fallback for free model usage first

## tech stack
- next js 16 with app router
- typescript
- react 19
- local file storage using markdown files and json graph files

## db and auth decision
- no database by design for this assignment
- no auth by design for this assignment
- reason: prompt explicitly asks for local markdown knowledge instead of rag database flow

## ui and responsiveness
- black and white visual direction only
- custom google fonts: space mono and cormorant garamond
- non generic agent chips with live state animation
- responsive layout for desktop tablet and mobile
- breakpoints:
  - desktop: full 5 chip rail
  - tablet: 2 column chip grid
  - mobile: stacked cards and fluid text areas

## model providers and fallback
provider order is controlled by `MODEL_PROVIDER_ORDER` in `.env`.

default model path:
1. direct google gemini api:
   - `gemini-2.5-flash`
   - `gemini-2.5-flash-lite`
2. openrouter free pool:
   - `openrouter/free`
   - `openai/gpt-oss-20b:free`
3. groq model
4. euron endpoint models with `gpt-4.1-nano` and fallbacks

if no api key is set, workflow still runs with deterministic local fallbacks.
for lowest cost, keep google gemini key and openrouter free models enabled.

## run locally
1. install deps
```bash
npm install
```
2. copy env file
```bash
cp .env.example .env.local
```
or on windows powershell:
```powershell
Copy-Item .env.example .env.local
```
3. set at least one api key in `.env.local`
4. start dev server
```bash
npm run dev
```
5. open `http://localhost:3000`
6. optional quality checks
```bash
npm run lint
npm run build
```

## folder structure
```txt
app/
  api/agentic/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  agent-console.tsx
knowledge/
  graph.json
  index.md
  notes/*.md
lib/
  agents/
  knowledge/
  utils/
```

## how compiled knowledge works
1. research agent reads existing markdown notes
2. summarizer and writer produce structured answer
3. linker creates wiki style topic connections
4. validator scores quality and flags issues
5. system writes or updates a markdown note and rebuilds index and graph

## feature testing guide
1. open app and type a query with at least 3 characters
2. click `run workflow`
3. confirm animated rail moves across all five agents
4. confirm output sections render:
   - final response
   - summary output
   - validation
   - linked topics
   - used notes
   - model trail
5. confirm knowledge files update after run:
   - `knowledge/notes/<query-slug>.md`
   - `knowledge/index.md`
   - `knowledge/graph.json`
6. run second query and verify new note links to existing topics
7. test responsive behavior in browser devtools:
   - 390px mobile
   - 768px tablet
   - 1280px desktop
