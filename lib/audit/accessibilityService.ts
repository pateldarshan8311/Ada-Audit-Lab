import path from "node:path";

import type { Page } from "puppeteer";

import {
  AccessibilitySnapshot,
  AuditIssue,
  FormIssue,
  HighlightRect,
  KeyboardIssue,
  SemanticIssue
} from "@/lib/types/audit";

interface CustomAccessibilityFindings {
  keyboardIssues: KeyboardIssue[];
  semanticIssues: SemanticIssue[];
  formIssues: FormIssue[];
}

interface AccessibilityAuditInput {
  page: Page;
  lighthouseScore: number;
  custom: CustomAccessibilityFindings;
}

interface ElementSnapshot {
  selector: string;
  html?: string;
  summary: string;
  boundingRect?: HighlightRect;
}

const AXE_SCRIPT_PATH = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

function impactToPriority(impact?: string | null) {
  if (impact === "critical" || impact === "serious") return "high" as const;
  if (impact === "moderate") return "medium" as const;
  return "low" as const;
}

async function getElementSnapshot(
  page: Page,
  selector: string,
  issueId: string,
  label: string,
  kind: "issue" | "contrast" = "issue"
): Promise<ElementSnapshot> {
  try {
    const snapshot = await page.evaluate(
      ({ selector: innerSelector, issueId: innerIssueId, label: innerLabel, kind: innerKind }) => {
        const element = document.querySelector(innerSelector);
        if (!(element instanceof Element)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const html = element.outerHTML.slice(0, 320);
        const boundingRect: HighlightRect = {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          selector: innerSelector,
          issueId: innerIssueId,
          label: innerLabel,
          kind: innerKind,
          section: "accessibility"
        };

        return {
          selector: innerSelector,
          html,
          summary: innerLabel,
          boundingRect
        };
      },
      {
        selector,
        issueId,
        label,
        kind
      }
    );

    if (snapshot) {
      return snapshot;
    }
  } catch {
    // Ignore lookup failures for unstable selectors.
  }

  return {
    selector,
    summary: label
  };
}

function createCustomIssue(id: string, title: string, description: string, impact: string, selector: string, rect?: HighlightRect) {
  const snapshot = rect
    ? [
        {
          selector,
          summary: title,
          boundingRect: rect
        }
      ]
    : [{ selector, summary: title }];

  return {
    id,
    title,
    description,
    impact,
    priority: "medium" as const,
    section: "accessibility" as const,
    source: "custom" as const,
    tags: ["wcag", "custom"],
    elements: snapshot
  };
}

export async function runAccessibilityAudit({
  page,
  lighthouseScore,
  custom
}: AccessibilityAuditInput): Promise<{
  snapshot: AccessibilitySnapshot;
  issues: AuditIssue[];
  contrastRects: HighlightRect[];
}> {
  const hasAxe = await page.evaluate(() => typeof (window as Window & { axe?: unknown }).axe !== "undefined");
  if (!hasAxe) {
    await page.addScriptTag({
      path: AXE_SCRIPT_PATH
    });
  }

  const axeResults = await page.evaluate(async () => {
    const axe = (window as Window & {
      axe: {
        run: (
          context?: Element | Document,
          options?: Record<string, unknown>
        ) => Promise<{
          violations: Array<{
            id: string;
            help: string;
            description: string;
            impact?: string | null;
            tags: string[];
            nodes: Array<{
              html: string;
              target: Array<string | string[]>;
              failureSummary?: string;
            }>;
          }>;
        }>;
      };
    }).axe;

    return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"]
      }
    });
  });

  const issues: AuditIssue[] = [];
  const contrastRects: HighlightRect[] = [];

  for (const violation of axeResults.violations) {
    const issueId = `axe-${violation.id}`;
    const nodes = await Promise.all(
      violation.nodes.slice(0, 4).map(async (node, index) => {
        const rawSelector = node.target[0];
        const selector =
          typeof rawSelector === "string"
            ? rawSelector
            : Array.isArray(rawSelector)
              ? rawSelector.join(" ")
              : `unresolved-node-${index}`;
        const snapshot = await getElementSnapshot(
          page,
          selector,
          issueId,
          node.failureSummary ?? violation.help,
          violation.id === "color-contrast" ? "contrast" : "issue"
        );

        if (snapshot.boundingRect && violation.id === "color-contrast") {
          contrastRects.push(snapshot.boundingRect);
        }

        return {
          ...snapshot,
          html: snapshot.html ?? node.html,
          summary: node.failureSummary ?? violation.help
        };
      })
    );

    issues.push({
      id: issueId,
      title: violation.help,
      description: violation.description,
      impact: `${violation.nodes.length} element(s) are failing ${violation.help}.`,
      priority: impactToPriority(violation.impact),
      section: "accessibility",
      source: "axe",
      ruleId: violation.id,
      tags: violation.tags,
      elements: nodes
    });
  }

  custom.keyboardIssues.forEach((issue, index) => {
    issues.push(
      createCustomIssue(
        `keyboard-${index}`,
        "Keyboard access gap",
        issue.issue,
        "Mouse-only interaction patterns block keyboard users and assistive technology.",
        issue.selector,
        issue.boundingRect
      )
    );
  });

  custom.semanticIssues.forEach((issue, index) => {
    issues.push(
      createCustomIssue(
        `semantic-${index}`,
        "Semantic structure issue",
        issue.issue,
        "Improving semantic structure helps navigation landmarks, headings, and screen reader flow.",
        issue.selector,
        issue.boundingRect
      )
    );
  });

  custom.formIssues.forEach((issue, index) => {
    issues.push(
      createCustomIssue(
        `form-${index}`,
        "Form labeling issue",
        issue.issue,
        "Inputs without clear labels are difficult to understand and operate with assistive tech.",
        issue.selector,
        issue.boundingRect
      )
    );
  });

  return {
    snapshot: {
      score: lighthouseScore,
      violationsCount: axeResults.violations.length,
      keyboardIssues: custom.keyboardIssues,
      semanticIssues: custom.semanticIssues,
      formIssues: custom.formIssues,
      contrastIssueCount: contrastRects.length
    },
    issues,
    contrastRects
  };
}
