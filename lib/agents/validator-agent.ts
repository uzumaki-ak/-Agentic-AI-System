// this file runs the validator agent
import { readTraceFromError, runWithFallback } from "@/lib/agents/models";
import { ValidatorResult } from "@/lib/agents/types";

type ParsedValidation = {
  passed: boolean;
  score: number;
  issues: string[];
};

// this function parses validator json from model output
function parseValidation(text: string): ParsedValidation | null {
  const tryParse = (raw: string): ParsedValidation | null => {
    try {
      const parsed = JSON.parse(raw) as {
        passed?: unknown;
        score?: unknown;
        issues?: unknown;
      };
      const passed = parsed.passed === true;
      const scoreNumber = typeof parsed.score === "number" ? parsed.score : 0;
      const score = Math.max(0, Math.min(100, Math.round(scoreNumber)));
      const issues = Array.isArray(parsed.issues)
        ? parsed.issues.filter((item): item is string => typeof item === "string").slice(0, 6)
        : [];
      return { passed, score, issues };
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct) {
    return direct;
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return tryParse(match[0]);
  }

  return null;
}

// this function creates a fallback validation result
function fallbackValidation(query: string, markdown: string): ParsedValidation {
  const issues: string[] = [];
  const includesQueryTerm = query
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.length > 3 && markdown.toLowerCase().includes(word));

  if (!includesQueryTerm) {
    issues.push("answer may not stay close to the query");
  }
  if (markdown.length < 160) {
    issues.push("answer is too short");
  }
  if (!markdown.includes("##")) {
    issues.push("answer lacks clear section structure");
  }

  const score = Math.max(60, 100 - issues.length * 15);
  return {
    passed: issues.length <= 1,
    score,
    issues
  };
}

// this function validates quality and structure of the final output
export async function runValidatorAgent(
  query: string,
  markdown: string
): Promise<ValidatorResult> {
  try {
    const { text, trace } = await runWithFallback(
      [
        {
          role: "system",
          content:
            "you are a validator agent. return json only with keys passed score issues. score is from 0 to 100 and issues is an array."
        },
        {
          role: "user",
          content: [
            `query: ${query}`,
            "",
            "answer markdown:",
            markdown.slice(0, 3000),
            "",
            'output format: {"passed":true,"score":84,"issues":["issue text"]}'
          ].join("\n")
        }
      ],
      { temperature: 0.1, maxTokens: 220 }
    );

    const parsed = parseValidation(text) ?? fallbackValidation(query, markdown);
    return {
      ...parsed,
      modelTrace: trace
    };
  } catch (error) {
    return {
      ...fallbackValidation(query, markdown),
      modelTrace: readTraceFromError(error)
    };
  }
}
