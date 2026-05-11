import { randomUUID } from "node:crypto";

import type { HTTPResponse, Page } from "puppeteer";

import {
  LARGE_BUNDLE_THRESHOLD_BYTES,
  LARGE_IMAGE_THRESHOLD_BYTES,
  VERY_LARGE_IMAGE_THRESHOLD_BYTES
} from "@/lib/constants/app";
import { runAiAnalysis } from "@/lib/ai/aiService";
import { runAccessibilityAudit } from "@/lib/audit/accessibilityService";
import { launchLighthouseChrome, launchPuppeteerBrowser } from "@/lib/server/chrome";
import { withTemporaryHtmlServer } from "@/lib/server/htmlHarness";
import {
  AccessibilitySnapshot,
  AuditIssue,
  AuditReport,
  AuditRequestPayload,
  BundleInsight,
  ComparisonSnapshot,
  CoreWebVitals,
  FontInsight,
  HighlightRect,
  ImageInsight,
  KeyboardIssue,
  LazyLoadInsight,
  OpportunityItem,
  PerformanceSnapshot
} from "@/lib/types/audit";
import { clamp } from "@/lib/utils/format";
import { countByPriority, sortIssues } from "@/lib/utils/ranking";
import { createCacheKey, getTargetLabel, normalizeUrl } from "@/lib/utils/url";

interface NetworkResource {
  url: string;
  type: string;
  size: number;
  status: number;
}

interface DomAnalysis {
  title: string;
  finalUrl: string;
  domNodes: number;
  pageWidth: number;
  pageHeight: number;
  images: Array<{
    selector: string;
    src: string;
    width: number;
    height: number;
    loading: string | null;
    belowFold: boolean;
    boundingRect?: HighlightRect;
  }>;
  fontIssues: FontInsight[];
  keyboardIssues: KeyboardIssue[];
  semanticIssues: Array<{
    selector: string;
    issue: string;
    boundingRect?: HighlightRect;
  }>;
  formIssues: Array<{
    selector: string;
    issue: string;
    boundingRect?: HighlightRect;
  }>;
  lazyLoadGaps: LazyLoadInsight[];
  layoutShiftRects: HighlightRect[];
}

interface AuditContextResult {
  auditUrl: string;
  target: string;
  mode: AuditRequestPayload["mode"];
}

function numericAudit(lhr: any, id: string) {
  const value = lhr?.audits?.[id]?.numericValue;
  return typeof value === "number" ? value : null;
}

function itemsAudit(lhr: any, id: string) {
  const details = lhr?.audits?.[id]?.details;
  return Array.isArray(details?.items) ? details.items : [];
}

function scoreCategory(lhr: any, id: string) {
  const score = lhr?.categories?.[id]?.score;
  return typeof score === "number" ? Math.round(score * 100) : 0;
}

function estimateMsFromBytes(bytes = 0) {
  return Math.round(bytes / 1250);
}

function priorityFromMetric(metric: "lcp" | "cls" | "inp", value: number | null) {
  if (value === null) return null;

  if (metric === "lcp") {
    if (value > 4000) return "high" as const;
    if (value > 2500) return "medium" as const;
  }

  if (metric === "cls") {
    if (value > 0.25) return "high" as const;
    if (value > 0.1) return "medium" as const;
  }

  if (metric === "inp") {
    if (value > 500) return "high" as const;
    if (value > 200) return "medium" as const;
  }

  return null;
}

function dedupeRects(rects: HighlightRect[]) {
  const seen = new Set<string>();
  return rects.filter((rect) => {
    const key = `${rect.kind}:${rect.selector}:${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function configurePage(page: Page) {
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 PulseADAAudit/1.0"
  );
  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9"
  });

  await page.evaluateOnNewDocument(() => {
    const selectorFor = (element: Element | null) => {
      if (!element) return "";
      if (element.id) return `#${element.id}`;

      const parts: string[] = [];
      let current: Element | null = element;

      while (current && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        const className = typeof current.className === "string" ? current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";

        if (className) {
          part += `.${className}`;
        }

        const parent = current.parentElement;
        if (parent) {
          const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
          if (sameTagSiblings.length > 1) {
            part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
          }
        }

        parts.unshift(part);
        current = current.parentElement;
      }

      return parts.join(" > ");
    };

    (window as typeof window & { __pulseAuditLayoutShifts?: HighlightRect[] }).__pulseAuditLayoutShifts = [];

    try {
      const observer = new PerformanceObserver((entryList) => {
        const store = (window as typeof window & { __pulseAuditLayoutShifts?: HighlightRect[] }).__pulseAuditLayoutShifts;
        if (!store) return;

        for (const entry of entryList.getEntries() as PerformanceEntry[]) {
          const shiftEntry = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            sources?: Array<{ node?: Element | null }>;
          };

          if (shiftEntry.hadRecentInput) {
            continue;
          }

          for (const source of shiftEntry.sources ?? []) {
            if (!(source.node instanceof Element)) {
              continue;
            }

            const rect = source.node.getBoundingClientRect();
            if (!rect.width && !rect.height) {
              continue;
            }

            store.push({
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
              selector: selectorFor(source.node),
              label: "Layout shift source",
              kind: "layout-shift",
              section: "layout-shift"
            });
          }
        }
      });

      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Layout-shift observer is not available on every target.
    }
  });
}

function extractResourceSize(response: HTTPResponse) {
  const headers = response.headers();
  const directHeader = headers["content-length"] ?? headers["Content-Length"];
  const value = directHeader ? Number(directHeader) : 0;
  return Number.isFinite(value) ? value : 0;
}

async function collectDomAnalysis(page: Page): Promise<DomAnalysis> {
  const raw = await page.evaluate(() => {
    const selectorFor = (element: Element | null) => {
      if (!element) return "";
      if (element.id) return `#${element.id}`;

      const parts: string[] = [];
      let current: Element | null = element;

      while (current && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        const className = typeof current.className === "string" ? current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
        if (className) {
          part += `.${className}`;
        }
        const parent = current.parentElement;
        if (parent) {
          const peers = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
          if (peers.length > 1) {
            part += `:nth-of-type(${peers.indexOf(current) + 1})`;
          }
        }
        parts.unshift(part);
        current = current.parentElement;
      }

      return parts.join(" > ");
    };

    const rectFor = (element: Element, label: string, issueId = ""): HighlightRect => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        selector: selectorFor(element),
        label,
        issueId,
        kind: "issue" as const,
        section: "performance" as const
      };
    };

    const images = Array.from(document.images).map((image) => {
      const rect = image.getBoundingClientRect();
      return {
        selector: selectorFor(image),
        src: image.currentSrc || image.src,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        loading: image.getAttribute("loading"),
        belowFold: rect.top > window.innerHeight,
        boundingRect: {
          ...rectFor(image, "Image candidate"),
          issueId: "image-candidate"
        }
      };
    });

    const lazyLoadGaps = images
      .filter((image) => image.belowFold && image.loading !== "lazy")
      .map((image) => ({
        selector: image.selector,
        src: image.src,
        belowFold: image.belowFold,
        loading: image.loading,
        boundingRect: image.boundingRect
      }));

    const keyboardIssues = Array.from(
      document.querySelectorAll<HTMLElement>("div[onclick], span[onclick], li[onclick], img[onclick]")
    )
      .filter((element) => !element.hasAttribute("tabindex"))
      .slice(0, 10)
      .map((element) => ({
        selector: selectorFor(element),
        issue: "Element uses an `onclick` handler without keyboard support or tabindex.",
        boundingRect: {
          ...rectFor(element, "Keyboard gap"),
          section: "accessibility"
        }
      }));

    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const semanticIssues: Array<{
      selector: string;
      issue: string;
      boundingRect?: HighlightRect;
    }> = [];

    const mainLandmarks = document.querySelectorAll("main");
    if (mainLandmarks.length === 0) {
      semanticIssues.push({
        selector: "body",
        issue: "Page is missing a `<main>` landmark.",
        boundingRect: undefined
      });
    }

    for (let index = 1; index < headings.length; index += 1) {
      const previousLevel = Number(headings[index - 1].tagName.replace("H", ""));
      const currentLevel = Number(headings[index].tagName.replace("H", ""));
      if (currentLevel - previousLevel > 1) {
        semanticIssues.push({
          selector: selectorFor(headings[index]),
          issue: `Heading order jumps from H${previousLevel} to H${currentLevel}.`,
          boundingRect: {
            ...rectFor(headings[index], "Heading jump"),
            section: "accessibility"
          }
        });
      }
    }

    const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
    const formIssues = controls
      .filter((element) => {
        const id = element.id;
        const hasLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        const ariaLabel = element.getAttribute("aria-label");
        const labelledBy = element.getAttribute("aria-labelledby");
        return !hasLabel && !ariaLabel && !labelledBy && element.type !== "hidden";
      })
      .slice(0, 10)
      .map((element) => ({
        selector: selectorFor(element),
        issue: "Form control does not have an associated visible or programmatic label.",
        boundingRect: {
          ...rectFor(element, "Missing label"),
          section: "accessibility"
        }
      }));

    const fontIssues: FontInsight[] = [];
    const preloadLinks = new Set(
      Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')).map((link) => link.getAttribute("href") || "")
    );

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue("font-family").replaceAll('"', "");
            const src = rule.style.getPropertyValue("src");
            const display = rule.style.getPropertyValue("font-display");
            if (!display || display === "auto") {
              fontIssues.push({
                family,
                src,
                issue: `Font face "${family}" is missing a non-blocking font-display strategy.`
              });
            }

            const firstUrl = src.match(/url\(([^)]+)\)/)?.[1]?.replaceAll('"', "") ?? "";
            if (firstUrl && !preloadLinks.has(firstUrl)) {
              fontIssues.push({
                family,
                src: firstUrl,
                issue: `Font face "${family}" is not preloaded for first render.`
              });
            }
          }
        }
      } catch {
        // Ignore cross-origin stylesheets.
      }
    }

    const docEl = document.documentElement;
    const pageWidth = Math.max(docEl.scrollWidth, document.body?.scrollWidth || 0, window.innerWidth);
    const pageHeight = Math.max(docEl.scrollHeight, document.body?.scrollHeight || 0, window.innerHeight);
    const layoutShiftRects = (window as typeof window & { __pulseAuditLayoutShifts?: HighlightRect[] }).__pulseAuditLayoutShifts ?? [];

    return {
      title: document.title || "Untitled page",
      finalUrl: window.location.href,
      domNodes: document.querySelectorAll("*").length,
      pageWidth,
      pageHeight,
      images,
      fontIssues,
      keyboardIssues,
      semanticIssues,
      formIssues,
      lazyLoadGaps,
      layoutShiftRects
    };
  });

  return {
    ...raw,
    images: raw.images.map((image) => ({
      ...image,
      boundingRect: image.boundingRect
        ? {
            ...image.boundingRect,
            kind: "issue" as const,
            section: "performance" as const
          }
        : undefined
    })),
    keyboardIssues: raw.keyboardIssues.map((issue) => ({
      ...issue,
      boundingRect: issue.boundingRect
        ? {
            ...issue.boundingRect,
            kind: "issue" as const,
            section: "accessibility" as const
          }
        : undefined
    })),
    semanticIssues: raw.semanticIssues.map((issue) => ({
      ...issue,
      boundingRect: issue.boundingRect
        ? {
            ...issue.boundingRect,
            kind: "issue" as const,
            section: "accessibility" as const
          }
        : undefined
    })),
    formIssues: raw.formIssues.map((issue) => ({
      ...issue,
      boundingRect: issue.boundingRect
        ? {
            ...issue.boundingRect,
            kind: "issue" as const,
            section: "accessibility" as const
          }
        : undefined
    })),
    lazyLoadGaps: raw.lazyLoadGaps.map((issue) => ({
      ...issue,
      boundingRect: issue.boundingRect
        ? {
            ...issue.boundingRect,
            kind: "issue" as const,
            section: "performance" as const
          }
        : undefined
    })),
    layoutShiftRects: raw.layoutShiftRects.map((rect) => ({
      ...rect,
      kind: "layout-shift" as const,
      section: "layout-shift" as const
    }))
  };
}

function coverageToBundles(entries: Array<{ url: string; text: string; ranges: Array<{ start: number; end: number }> }>) {
  const bundles: BundleInsight[] = [];

  for (const entry of entries) {
    const totalBytes = entry.text.length;
    let usedBytes = 0;

    for (const range of entry.ranges) {
      usedBytes += Math.max(0, range.end - range.start - 1);
    }

    if (!totalBytes || !entry.url) {
      continue;
    }

    const unusedBytes = Math.max(totalBytes - usedBytes, 0);
    bundles.push({
      url: entry.url,
      totalBytes,
      usedBytes,
      unusedBytes,
      percentUsed: totalBytes ? (usedBytes / totalBytes) * 100 : 100
    });
  }

  return bundles.sort((left, right) => right.unusedBytes - left.unusedBytes);
}

function buildPerformanceIssues(
  cwv: CoreWebVitals,
  renderBlocking: OpportunityItem[],
  unusedCss: OpportunityItem[],
  unusedJs: OpportunityItem[],
  images: ImageInsight[],
  lazyLoadGaps: LazyLoadInsight[],
  fontIssues: FontInsight[],
  bundles: BundleInsight[]
) {
  const issues: AuditIssue[] = [];

  const lcpPriority = priorityFromMetric("lcp", cwv.lcp);
  if (lcpPriority) {
    issues.push({
      id: "cwv-lcp",
      title: "Largest Contentful Paint is outside the target range",
      description: "The page’s primary content is taking too long to render.",
      impact: "A slow LCP usually means users wait too long to see meaningful content.",
      priority: lcpPriority,
      section: "performance",
      source: "lighthouse",
      metric: "LCP",
      savingsMs: cwv.lcp ? Math.max(cwv.lcp - 2500, 0) : undefined,
      tags: ["core-web-vitals", "lcp"],
      elements: []
    });
  }

  const clsPriority = priorityFromMetric("cls", cwv.cls);
  if (clsPriority) {
    issues.push({
      id: "cwv-cls",
      title: "Cumulative Layout Shift needs stabilization",
      description: "Visible elements are shifting unexpectedly as the page loads.",
      impact: "Layout shifts reduce trust and can cause accidental clicks.",
      priority: clsPriority,
      section: "performance",
      source: "lighthouse",
      metric: "CLS",
      tags: ["core-web-vitals", "cls"],
      elements: []
    });
  }

  const inpPriority = priorityFromMetric("inp", cwv.inp);
  if (inpPriority) {
    issues.push({
      id: "cwv-inp",
      title: "Interaction to Next Paint is slower than recommended",
      description: "The main thread is too busy to respond quickly to interactions.",
      impact: "Slower interactivity makes the interface feel sticky or delayed.",
      priority: inpPriority,
      section: "performance",
      source: "lighthouse",
      metric: "INP",
      savingsMs: cwv.inp ? Math.max(cwv.inp - 200, 0) : undefined,
      tags: ["core-web-vitals", "inp"],
      elements: []
    });
  }

  if (renderBlocking.length) {
    const wastedMs = renderBlocking.reduce((sum, item) => sum + (item.wastedMs ?? 0), 0);
    issues.push({
      id: "render-blocking",
      title: "Render-blocking resources delay the first paint",
      description: "Stylesheets or scripts are holding back above-the-fold rendering.",
      impact: "Critical rendering is stalled until these resources finish downloading and executing.",
      priority: wastedMs > 400 ? "high" : "medium",
      section: "performance",
      source: "lighthouse",
      metric: "FCP",
      savingsMs: wastedMs,
      tags: ["critical-path", "css", "javascript"],
      lighthouseAuditId: "render-blocking-resources",
      elements: renderBlocking.slice(0, 3).map((item) => ({
        selector: item.url || item.label,
        summary: item.label
      }))
    });
  }

  const totalUnusedCss = unusedCss.reduce((sum, item) => sum + (item.wastedBytes ?? 0), 0);
  if (totalUnusedCss > 40 * 1024) {
    issues.push({
      id: "unused-css",
      title: "Unused CSS is inflating the render path",
      description: "Stylesheets contain rules that are downloaded and parsed without contributing to the current view.",
      impact: "Extra CSS increases transfer size and stylesheet evaluation work.",
      priority: totalUnusedCss > 150 * 1024 ? "high" : "medium",
      section: "performance",
      source: "lighthouse",
      savingsBytes: totalUnusedCss,
      savingsMs: estimateMsFromBytes(totalUnusedCss),
      tags: ["css"],
      lighthouseAuditId: "unused-css-rules",
      elements: unusedCss.slice(0, 3).map((item) => ({
        selector: item.url || item.label,
        summary: item.label
      }))
    });
  }

  const totalUnusedJs = unusedJs.reduce((sum, item) => sum + (item.wastedBytes ?? 0), 0);
  if (totalUnusedJs > 60 * 1024) {
    issues.push({
      id: "unused-js",
      title: "Unused JavaScript is bloating the initial bundle",
      description: "The page is shipping more JavaScript than the first view actually uses.",
      impact: "Extra JS adds download, parse, and execution time that slows interactivity.",
      priority: totalUnusedJs > 180 * 1024 ? "high" : "medium",
      section: "performance",
      source: "lighthouse",
      savingsBytes: totalUnusedJs,
      savingsMs: estimateMsFromBytes(totalUnusedJs),
      tags: ["javascript"],
      lighthouseAuditId: "unused-javascript",
      elements: unusedJs.slice(0, 3).map((item) => ({
        selector: item.url || item.label,
        summary: item.label
      }))
    });
  }

  images
    .filter((image) => image.bytes >= LARGE_IMAGE_THRESHOLD_BYTES)
    .slice(0, 5)
    .forEach((image, index) => {
      issues.push({
        id: `large-image-${index}`,
        title: "Large image payload detected",
        description: `${image.src} is heavier than a fast-loading image budget.`,
        impact: "Oversized images push up transfer cost and often delay LCP.",
        priority: image.bytes >= VERY_LARGE_IMAGE_THRESHOLD_BYTES ? "high" : "medium",
        section: "performance",
        source: "custom",
        savingsBytes: image.bytes,
        savingsMs: estimateMsFromBytes(image.bytes * 0.45),
        tags: ["image"],
        elements: [
          {
            selector: image.selector,
            summary: image.src,
            boundingRect: image.boundingRect
          }
        ]
      });
    });

  lazyLoadGaps.slice(0, 5).forEach((image, index) => {
    issues.push({
      id: `lazy-gap-${index}`,
      title: "Below-the-fold image is not lazy-loaded",
      description: `${image.selector} loads eagerly even though it starts outside the viewport.`,
      impact: "This image competes with higher-value above-the-fold resources.",
      priority: "medium",
      section: "performance",
      source: "custom",
      tags: ["image", "lazy-loading"],
      elements: [
        {
          selector: image.selector,
          summary: image.src,
          boundingRect: image.boundingRect
        }
      ]
    });
  });

  if (fontIssues.length) {
    issues.push({
      id: "font-strategy",
      title: "Font loading strategy can be improved",
      description: "Custom fonts are missing preload or non-blocking rendering settings.",
      impact: "Web fonts can delay text paint or cause reflow if they are not loaded intentionally.",
      priority: "medium",
      section: "performance",
      source: "custom",
      tags: ["fonts"],
      elements: fontIssues.slice(0, 3).map((issue) => ({
        selector: issue.src || issue.family || "font-face",
        summary: issue.issue
      }))
    });
  }

  bundles
    .filter((bundle) => bundle.totalBytes > LARGE_BUNDLE_THRESHOLD_BYTES && bundle.percentUsed < 70)
    .slice(0, 4)
    .forEach((bundle, index) => {
      issues.push({
        id: `bundle-${index}`,
        title: "JavaScript bundle has low execution efficiency",
        description: `${bundle.url} ships ${Math.round(bundle.percentUsed)}% useful code on first load.`,
        impact: "Low-usage bundles consume bandwidth and slow parse/execute time without helping the first interaction.",
        priority: bundle.unusedBytes > 250 * 1024 ? "high" : "medium",
        section: "performance",
        source: "custom",
        savingsBytes: bundle.unusedBytes,
        savingsMs: estimateMsFromBytes(bundle.unusedBytes),
        tags: ["javascript", "bundles"],
        elements: [
          {
            selector: bundle.url,
            summary: bundle.url
          }
        ]
      });
    });

  return issues;
}

function simulateOptimizedOutcome(
  performance: PerformanceSnapshot,
  accessibility: AccessibilitySnapshot,
  issues: AuditIssue[]
): ComparisonSnapshot {
  const performanceIssues = issues.filter((issue) => issue.section === "performance");
  const accessibilityIssues = issues.filter((issue) => issue.section === "accessibility");

  const savingsMs = performanceIssues.reduce((sum, issue) => sum + (issue.savingsMs ?? 0), 0);
  const estimatedPerformanceLift = Math.min(28, Math.round(savingsMs / 180));
  const estimatedAccessibilityLift = Math.min(
    20,
    accessibilityIssues.filter((issue) => issue.priority !== "low").length * 3
  );

  return {
    before: {
      performanceScore: performance.score,
      accessibilityScore: accessibility.score,
      lcp: performance.coreWebVitals.lcp,
      cls: performance.coreWebVitals.cls,
      inp: performance.coreWebVitals.inp
    },
    after: {
      performanceScore: clamp(performance.score + estimatedPerformanceLift, 0, 100),
      accessibilityScore: clamp(accessibility.score + estimatedAccessibilityLift, 0, 100),
      lcp:
        performance.coreWebVitals.lcp === null
          ? null
          : Math.max(Math.round(performance.coreWebVitals.lcp - savingsMs * 0.35), 900),
      cls:
        performance.coreWebVitals.cls === null
          ? null
          : Math.max(Number((performance.coreWebVitals.cls * 0.45).toFixed(3)), 0.01),
      inp:
        performance.coreWebVitals.inp === null
          ? null
          : Math.max(Math.round(performance.coreWebVitals.inp - savingsMs * 0.15), 90)
    },
    notes: [
      "This is a simulated improvement model based on detected wasted bytes, blocked render time, and accessibility issue severity.",
      "Largest gains usually come from image compression, bundle splitting, render-path cleanup, and fixing critical accessibility blockers first."
    ]
  };
}

async function runLighthouse(auditUrl: string) {
  const chrome = await launchLighthouseChrome();
  const { default: lighthouse } = await import("lighthouse");

  try {
    const result = await lighthouse(auditUrl, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices"],
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1440,
        height: 960,
        deviceScaleFactor: 1,
        disabled: false
      }
    });

    return result?.lhr;
  } finally {
    await chrome.kill();
  }
}

async function runCustomPageAnalysis(auditUrl: string) {
  const browser = await launchPuppeteerBrowser();

  try {
    const page = await browser.newPage();
    await configurePage(page);

    const resources: NetworkResource[] = [];
    page.on("response", (response) => {
      const request = response.request();
      resources.push({
        url: response.url(),
        type: request.resourceType(),
        size: extractResourceSize(response),
        status: response.status()
      });
    });

    await Promise.all([page.coverage.startJSCoverage(), page.coverage.startCSSCoverage()]);
    await page.goto(auditUrl, { waitUntil: "networkidle2", timeout: 120000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const dom = await collectDomAnalysis(page);
    const [jsCoverage] = await Promise.all([page.coverage.stopJSCoverage(), page.coverage.stopCSSCoverage()]);
    const screenshotBase64 = (await page.screenshot({
      fullPage: true,
      type: "png",
      encoding: "base64"
    })) as string;

    const accessibility = await runAccessibilityAudit({
      page,
      lighthouseScore: 0,
      custom: {
        keyboardIssues: dom.keyboardIssues,
        semanticIssues: dom.semanticIssues,
        formIssues: dom.formIssues
      }
    });

    return {
      dom,
      jsCoverage,
      resources,
      screenshotDataUrl: `data:image/png;base64,${screenshotBase64}`,
      accessibility
    };
  } finally {
    await browser.close();
  }
}

function hydrateImages(images: DomAnalysis["images"], resources: NetworkResource[]): ImageInsight[] {
  const resourceMap = new Map(resources.map((resource) => [resource.url, resource]));

  return images
    .map((image) => {
      const resource = resourceMap.get(image.src);
      return {
        src: image.src,
        selector: image.selector,
        bytes: resource?.size ?? 0,
        width: image.width,
        height: image.height,
        loading: image.loading,
        belowFold: image.belowFold,
        boundingRect: image.boundingRect
      };
    })
    .sort((left, right) => right.bytes - left.bytes);
}

function lighthouseOpportunityItems(items: any[]): OpportunityItem[] {
  return items.map((item) => ({
    url: item.url,
    label: item.url || item.node?.label || "Resource",
    wastedMs: typeof item.wastedMs === "number" ? item.wastedMs : undefined,
    wastedBytes: typeof item.wastedBytes === "number" ? item.wastedBytes : undefined
  }));
}

function buildPerformanceSnapshot(lhr: any, dom: DomAnalysis, resources: NetworkResource[], bundles: BundleInsight[]): PerformanceSnapshot {
  const renderBlocking = lighthouseOpportunityItems(itemsAudit(lhr, "render-blocking-resources"));
  const unusedCss = lighthouseOpportunityItems(itemsAudit(lhr, "unused-css-rules"));
  const unusedJs = lighthouseOpportunityItems(itemsAudit(lhr, "unused-javascript"));

  return {
    score: scoreCategory(lhr, "performance"),
    coreWebVitals: {
      lcp: numericAudit(lhr, "largest-contentful-paint"),
      cls: numericAudit(lhr, "cumulative-layout-shift"),
      inp: numericAudit(lhr, "interaction-to-next-paint"),
      fcp: numericAudit(lhr, "first-contentful-paint"),
      tbt: numericAudit(lhr, "total-blocking-time"),
      speedIndex: numericAudit(lhr, "speed-index")
    },
    renderBlocking,
    unusedCss,
    unusedJs,
    images: hydrateImages(dom.images, resources),
    lazyLoadGaps: dom.lazyLoadGaps,
    fontIssues: dom.fontIssues,
    bundles,
    summary: {
      requests: resources.length,
      transferBytes: resources.reduce((sum, resource) => sum + resource.size, 0),
      domNodes: dom.domNodes
    }
  };
}

async function resolveAuditContext(payload: AuditRequestPayload, run: (context: AuditContextResult) => Promise<AuditReport>) {
  if (payload.mode === "html") {
    return withTemporaryHtmlServer(payload.html ?? "", async (auditUrl) =>
      run({
        auditUrl,
        target: getTargetLabel(payload.mode, payload),
        mode: payload.mode
      })
    );
  }

  const auditUrl = normalizeUrl(payload.url ?? "");
  return run({
    auditUrl,
    target: auditUrl,
    mode: payload.mode
  });
}

export async function runAudit(payload: AuditRequestPayload): Promise<AuditReport> {
  return resolveAuditContext(payload, async ({ auditUrl, target, mode }) => {
    const cacheKey = createCacheKey(payload);
    const [lhr, custom] = await Promise.all([runLighthouse(auditUrl), runCustomPageAnalysis(auditUrl)]);

    const bundles = coverageToBundles(custom.jsCoverage);
    const performance = buildPerformanceSnapshot(lhr, custom.dom, custom.resources, bundles);
    const accessibilityScore = scoreCategory(lhr, "accessibility");
    const accessibility = {
      ...custom.accessibility.snapshot,
      score: accessibilityScore
    } satisfies AccessibilitySnapshot;

    const performanceIssues = buildPerformanceIssues(
      performance.coreWebVitals,
      performance.renderBlocking,
      performance.unusedCss,
      performance.unusedJs,
      performance.images,
      performance.lazyLoadGaps,
      performance.fontIssues,
      performance.bundles
    );

    const issues = sortIssues([...performanceIssues, ...custom.accessibility.issues]);
    const comparison = simulateOptimizedOutcome(performance, accessibility, issues);
    const ai = await runAiAnalysis(issues, comparison);

    const aiFixLookup = new Map(ai.fixes.map((fix) => [fix.issueId, fix]));
    const mergedIssues = issues.map((issue) => {
      const fix = aiFixLookup.get(issue.id);
      return fix
        ? {
            ...issue,
            aiExplanation: fix.explanation,
            aiFix: fix.fix,
            aiCode: fix.code,
            aiOptimizedCode: fix.optimizedCode
          }
        : issue;
    });

    const counts = countByPriority(mergedIssues);
    const issueRects = mergedIssues.flatMap((issue) =>
      issue.elements
        .map((element) => element.boundingRect)
        .filter((rect): rect is HighlightRect => Boolean(rect))
        .map((rect) => ({
          ...rect,
          issueId: issue.id,
          label: issue.title
        }))
    );

    const overlays = dedupeRects([
      ...issueRects,
      ...custom.accessibility.contrastRects,
      ...custom.dom.layoutShiftRects
    ]);

    const overallHealth = clamp(
      Math.round(performance.score * 0.55 + accessibility.score * 0.45 - counts.high * 4 - counts.medium * 1.5),
      0,
      100
    );

    return {
      id: randomUUID(),
      cacheKey,
      createdAt: new Date().toISOString(),
      mode,
      target,
      pageTitle: custom.dom.title,
      finalUrl: custom.dom.finalUrl || target,
      summary: {
        overallHealth,
        totalIssues: mergedIssues.length,
        issueCounts: counts,
        topFindings: mergedIssues.slice(0, 4).map((issue) => issue.title)
      },
      performance,
      accessibility,
      issues: mergedIssues,
      ai,
      comparison,
      visualDebug: {
        screenshotDataUrl: custom.screenshotDataUrl,
        pageWidth: custom.dom.pageWidth,
        pageHeight: custom.dom.pageHeight,
        overlays
      }
    };
  });
}
