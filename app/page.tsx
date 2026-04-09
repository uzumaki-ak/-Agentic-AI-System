// this file renders the home screen ui
import AgentConsole from "@/components/agent-console";

// this function renders the main product page
export default function HomePage(): React.ReactElement {
  return (
    <main className="page-wrap">
      <section className="hero-panel">
        <p className="hero-kicker">mini agentic ai system</p>
        <h1 className="hero-title">compiled markdown knowledge workflow</h1>
        <p className="hero-copy">
          master agent coordinates research summarizer writer linker and validator agents using
          local markdown notes instead of rag databases.
        </p>
      </section>
      <AgentConsole />
    </main>
  );
}
