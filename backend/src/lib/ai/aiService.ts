import OpenAI from "openai";

import { MAX_AI_ISSUES } from "@/lib/constants/app";
import {
  AiFixItem,
  AiSnapshot,
  AuditIssue,
  ComparisonSnapshot,
  IssuePriority
} from "@/lib/types/audit";
import { sortIssues } from "@/lib/utils/ranking";

function emptyGroups(): Record<IssuePriority, string[]> {
  return {
    high: [],
    medium: [],
    low: []
  };
}

function buildDefaultSnippet(issue: AuditIssue) {
  const title = issue.title.toLowerCase();
  const rule = issue.ruleId?.toLowerCase() ?? "";

  if (title.includes("image") || issue.tags.includes("image")) {
    return {
      fix: "Convert oversized images to WebP/AVIF, define intrinsic dimensions, and lazy-load anything below the fold.",
      code: `<img src="/hero.webp" alt="Descriptive alt text" width="1200" height="800" loading="lazy" decoding="async" />`,
      optimizedCode: `<picture>\n  <source srcSet="/hero.avif" type="image/avif" />\n  <source srcSet="/hero.webp" type="image/webp" />\n  <img src="/hero.webp" alt="Descriptive alt text" width="1200" height="800" loading="lazy" decoding="async" />\n</picture>`
    };
  }

  if (title.includes("render") || issue.tags.includes("css") || issue.tags.includes("javascript")) {
    return {
      fix: "Move non-critical assets off the critical path and split code so only above-the-fold work ships on first paint.",
      code: `const Dashboard = dynamic(() => import("./dashboard"), {\n  loading: () => <Skeleton />,\n});`,
      optimizedCode: `<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />\n<link rel="stylesheet" href="/styles/critical.css" />`
    };
  }

  if (rule.includes("color-contrast")) {
    return {
      fix: "Increase contrast between foreground and background colors until the text passes WCAG AA or AAA.",
      code: `.button {\n  color: #f8fafc;\n  background: #0f172a;\n}`,
      optimizedCode: `:root {\n  --text-strong: #f8fafc;\n  --surface-accent: #0f172a;\n}`
    };
  }

  if (rule.includes("label") || title.includes("form")) {
    return {
      fix: "Associate every form control with a visible or programmatic label.",
      code: `<label htmlFor="email">Email address</label>\n<input id="email" name="email" type="email" />`,
      optimizedCode: `<label htmlFor="email" className="sr-only">Email address</label>\n<input id="email" name="email" type="email" aria-describedby="email-help" />`
    };
  }

  if (rule.includes("aria")) {
    return {
      fix: "Use native HTML semantics first, then add ARIA only where native elements cannot express the interaction.",
      code: `<button type="button" aria-expanded={open} aria-controls="menu">Menu</button>`,
      optimizedCode: `<nav aria-label="Primary">\n  <button type="button" aria-expanded={open} aria-controls="primary-menu">Menu</button>\n</nav>`
    };
  }

  if (title.includes("keyboard")) {
    return {
      fix: "Replace click-only containers with semantic interactive elements and ensure focus styles are visible.",
      code: `<button type="button" onClick={onOpen} className="focus-visible:outline focus-visible:outline-2">Open details</button>`,
      optimizedCode: `<button type="button" onClick={onOpen} onKeyDown={handleKeyDown} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">Open details</button>`
    };
  }

  if (title.includes("font")) {
    return {
      fix: "Set `font-display: swap`, trim unused font weights, and preload the single font file needed for first paint.",
      code: `@font-face {\n  font-family: "Acme Sans";\n  src: url("/fonts/acme-sans.woff2") format("woff2");\n  font-display: swap;\n}`,
      optimizedCode: `<link rel="preload" href="/fonts/acme-sans.woff2" as="font" type="font/woff2" crossOrigin="" />`
    };
  }

  return {
    fix: "Refactor this issue with a smaller initial payload, stronger semantics, and a clearer loading strategy.",
    code: `// Trim unused work and keep the first render focused on above-the-fold UI.`,
    optimizedCode: `// Apply the change closest to the element or route creating the issue.`
  };
}

function buildHeuristicFix(issue: AuditIssue): AiFixItem {
  const snippets = buildDefaultSnippet(issue);

  return {
    issueId: issue.id,
    explanation: `${issue.title} is affecting ${issue.section} because ${issue.impact.toLowerCase()}`,
    fix: snippets.fix,
    code: snippets.code,
    optimizedCode: snippets.optimizedCode,
    priority: issue.priority
  };
}

function createHeuristicSnapshot(issues: AuditIssue[], comparison: ComparisonSnapshot): AiSnapshot {
  const ranked = sortIssues(issues).slice(0, MAX_AI_ISSUES);
  const fixes = ranked.map(buildHeuristicFix);
  const grouped = emptyGroups();

  fixes.forEach((fix) => {
    grouped[fix.priority].push(fix.issueId);
  });

  return {
    enabled: true,
    provider: "heuristic",
    summary: `Heuristic analysis predicts the strongest gains will come from critical rendering, image delivery, and the top accessibility blockers. The current simulated target is ${comparison.after.performanceScore}/100 performance and ${comparison.after.accessibilityScore}/100 accessibility after the highest-impact fixes.`,
    fixes,
    grouped
  };
}

function buildPrompt(issues: AuditIssue[], comparison: ComparisonSnapshot) {
  const summaries = issues
    .map((issue) => {
      const selectors = issue.elements
        .map((element) => element.selector)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");

      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        impact: issue.impact,
        priority: issue.priority,
        section: issue.section,
        tags: issue.tags,
        metric: issue.metric ?? null,
        savingsMs: issue.savingsMs ?? null,
        savingsBytes: issue.savingsBytes ?? null,
        selectors
      };
    })
    .slice(0, MAX_AI_ISSUES);

  return [
    "You are an expert performance engineer and accessibility specialist.",
    "Return concise, developer-friendly fixes for each issue.",
    "Keep code snippets practical and directly applicable in modern React or HTML/CSS/JS codebases.",
    "Prefer explicit implementation details over generic advice.",
    "",
    `Simulated before/after target: ${JSON.stringify(comparison)}`,
    `Issues: ${JSON.stringify(summaries)}`
  ].join("\n");
}

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "fixes"],
  properties: {
    summary: {
      type: "string"
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issueId", "explanation", "fix", "code", "optimizedCode", "priority"],
        properties: {
          issueId: { type: "string" },
          explanation: { type: "string" },
          fix: { type: "string" },
          code: { type: "string" },
          optimizedCode: { type: "string" },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"]
          }
        }
      }
    }
  }
} as const;

export async function runAiAnalysis(issues: AuditIssue[], comparison: ComparisonSnapshot): Promise<AiSnapshot> {
  if (!issues.length) {
    return {
      enabled: false,
      provider: "heuristic",
      summary: "No issues were detected, so no AI fix pass was necessary.",
      fixes: [],
      grouped: emptyGroups()
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return createHeuristicSnapshot(issues, comparison);
  }

  const ranked = sortIssues(issues).slice(0, MAX_AI_ISSUES);
  const fallback = createHeuristicSnapshot(ranked, comparison);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You explain web performance and WCAG issues clearly, with exact fixes and code."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(ranked, comparison)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pulse_ada_fix_plan",
          strict: true,
          schema: FIX_SCHEMA
        }
      }
    });

    const parsed = JSON.parse(response.output_text || "{}") as {
      summary?: string;
      fixes?: AiFixItem[];
    };

    if (!parsed.fixes?.length) {
      return fallback;
    }

    const grouped = emptyGroups();
    parsed.fixes.forEach((fix) => {
      grouped[fix.priority].push(fix.issueId);
    });

    return {
      enabled: true,
      provider: "openai",
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      summary: parsed.summary || fallback.summary,
      fixes: parsed.fixes,
      grouped
    };
  } catch {
    return fallback;
  }
}
