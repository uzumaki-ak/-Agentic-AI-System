"use client";

// this file renders query controls and output cards
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AgentStatus = "idle" | "active" | "done";

type AgentRunResult = {
  query: string;
  finalMarkdown: string;
  summary: string;
  validation: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  linkedTopics: string[];
  usedNoteTitles: string[];
  touchedFiles: string[];
  traces: Array<{
    provider: string;
    model: string;
    success: boolean;
    error?: string;
  }>;
  savedNotePreview: string;
};

const AGENT_STEPS = [
  { key: "research", label: "research", icon: "[r]" },
  { key: "summarizer", label: "summarizer", icon: "[s]" },
  { key: "writer", label: "writer", icon: "[w]" },
  { key: "linker", label: "linker", icon: "[l]" },
  { key: "validator", label: "validator", icon: "[v]" }
] as const;

// this function creates default status map for the activity rail
function initialAgentState(): Record<string, AgentStatus> {
  return AGENT_STEPS.reduce<Record<string, AgentStatus>>((acc, step) => {
    acc[step.key] = "idle";
    return acc;
  }, {});
}

// this function renders one animated status chip
function AgentChip({
  label,
  icon,
  status
}: {
  label: string;
  icon: string;
  status: AgentStatus;
}): React.ReactElement {
  const statusText = status === "active" ? "thinking" : status === "done" ? "done" : "waiting";
  return (
    <div className={`agent-chip ${status}`}>
      <span className="agent-icon">{icon}</span>
      <span className="agent-label">{label}</span>
      <span className="agent-state">{statusText}</span>
    </div>
  );
}

// this component handles query submit and renders all response blocks
export default function AgentConsole(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [agentState, setAgentState] = useState<Record<string, AgentStatus>>(() =>
    initialAgentState()
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIndexRef = useRef(0);

  // this function clears animation timer safely
  const stopTimer = (): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // this function starts the animated step progression
  const startStepAnimation = (): void => {
    stopTimer();
    stepIndexRef.current = 0;
    setAgentState(() => {
      const base = initialAgentState();
      base[AGENT_STEPS[0].key] = "active";
      return base;
    });

    timerRef.current = setInterval(() => {
      stepIndexRef.current += 1;
      setAgentState((prev) => {
        const next = { ...prev };
        AGENT_STEPS.forEach((step, index) => {
          if (index < stepIndexRef.current) {
            next[step.key] = "done";
          } else if (index === stepIndexRef.current) {
            next[step.key] = "active";
          } else {
            next[step.key] = "idle";
          }
        });
        if (stepIndexRef.current >= AGENT_STEPS.length) {
          AGENT_STEPS.forEach((step) => {
            next[step.key] = "done";
          });
          stopTimer();
        }
        return next;
      });
    }, 700);
  };

  // this function completes or resets the rail after api response
  const finishStepAnimation = (success: boolean): void => {
    stopTimer();
    setAgentState(() => {
      const base = initialAgentState();
      if (success) {
        AGENT_STEPS.forEach((step) => {
          base[step.key] = "done";
        });
      }
      return base;
    });
  };

  // this function submits query to the master agent api
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    startStepAnimation();

    try {
      const response = await fetch("/api/agentic", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ query: cleanQuery })
      });

      const payload = (await response.json()) as AgentRunResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "request failed");
      }

      setResult(payload);
      finishStepAnimation(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "request failed";
      setError(message);
      finishStepAnimation(false);
    } finally {
      setLoading(false);
    }
  };

  // this effect clears timers when component unmounts
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  // this memo computes successful provider trail for quick display
  const successfulTrail = useMemo(() => {
    if (!result) {
      return [];
    }
    return result.traces.filter((trace) => trace.success);
  }, [result]);

  return (
    <section className="console-wrap">
      <form className="query-form" onSubmit={handleSubmit}>
        <label htmlFor="query" className="field-label">
          enter topic or query
        </label>
        <textarea
          id="query"
          name="query"
          className="query-input"
          placeholder="example: build a concise roadmap for launching a mini agentic ai product"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
        />
        <button type="submit" className="run-button" disabled={loading || query.trim().length < 3}>
          {loading ? "running agents..." : "run workflow"}
        </button>
      </form>

      <div className="agent-rail">
        {AGENT_STEPS.map((step) => (
          <AgentChip
            key={step.key}
            label={step.label}
            icon={step.icon}
            status={agentState[step.key]}
          />
        ))}
      </div>

      {error ? (
        <article className="card error-card">
          <h3>request error</h3>
          <p>{error}</p>
        </article>
      ) : null}

      {result ? (
        <>
          <article className="card">
            <h3>final response</h3>
            <pre>{result.finalMarkdown}</pre>
          </article>

          <article className="card">
            <h3>summary output</h3>
            <pre>{result.summary}</pre>
          </article>

          <article className="card-grid">
            <div className="card">
              <h3>validation</h3>
              <p>passed: {result.validation.passed ? "yes" : "no"}</p>
              <p>score: {result.validation.score}</p>
              <pre>
                {result.validation.issues.length > 0
                  ? result.validation.issues.join("\n")
                  : "no issues"}
              </pre>
            </div>
            <div className="card">
              <h3>knowledge updates</h3>
              <pre>{result.touchedFiles.join("\n")}</pre>
            </div>
          </article>

          <article className="card-grid">
            <div className="card">
              <h3>linked topics</h3>
              <pre>{result.linkedTopics.length > 0 ? result.linkedTopics.join("\n") : "none"}</pre>
            </div>
            <div className="card">
              <h3>used notes</h3>
              <pre>
                {result.usedNoteTitles.length > 0 ? result.usedNoteTitles.join("\n") : "none"}
              </pre>
            </div>
          </article>

          <article className="card">
            <h3>saved note preview</h3>
            <pre>{result.savedNotePreview}</pre>
          </article>

          <article className="card">
            <h3>model trail</h3>
            <pre>
              {successfulTrail.length > 0
                ? successfulTrail
                    .map((trace) => `${trace.provider} -> ${trace.model} -> success`)
                    .join("\n")
                : "running in fallback mode without provider key"}
            </pre>
          </article>
        </>
      ) : null}
    </section>
  );
}
