export type AuditMode = "url" | "html";
export type IssuePriority = "high" | "medium" | "low";
export type AuditSection = "performance" | "accessibility";
export type IssueSource = "lighthouse" | "axe" | "custom" | "openai" | "heuristic";
export type OverlayKind = "issue" | "layout-shift" | "contrast";

export interface AuditRequestPayload {
  mode: AuditMode;
  url?: string;
  html?: string;
  fileName?: string;
  forceRefresh?: boolean;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  selector?: string;
  label?: string;
  issueId?: string;
  kind: OverlayKind;
  section: AuditSection | "layout-shift";
}

export interface IssueElement {
  selector: string;
  html?: string;
  summary?: string;
  boundingRect?: HighlightRect;
}

export interface AuditIssue {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: IssuePriority;
  section: AuditSection;
  source: IssueSource;
  ruleId?: string;
  metric?: string;
  savingsMs?: number;
  savingsBytes?: number;
  tags: string[];
  elements: IssueElement[];
  lighthouseAuditId?: string;
  aiExplanation?: string;
  aiFix?: string;
  aiCode?: string;
  aiOptimizedCode?: string;
}

export interface CoreWebVitals {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  tbt: number | null;
  speedIndex: number | null;
}

export interface OpportunityItem {
  url?: string;
  label: string;
  wastedMs?: number;
  wastedBytes?: number;
}

export interface BundleInsight {
  url: string;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  percentUsed: number;
}

export interface ImageInsight {
  src: string;
  selector: string;
  bytes: number;
  width: number;
  height: number;
  loading: string | null;
  belowFold: boolean;
  boundingRect?: HighlightRect;
}

export interface LazyLoadInsight {
  selector: string;
  src: string;
  belowFold: boolean;
  loading: string | null;
  boundingRect?: HighlightRect;
}

export interface FontInsight {
  family?: string;
  src?: string;
  issue: string;
}

export interface KeyboardIssue {
  selector: string;
  issue: string;
  boundingRect?: HighlightRect;
}

export interface SemanticIssue {
  selector: string;
  issue: string;
  boundingRect?: HighlightRect;
}

export interface FormIssue {
  selector: string;
  issue: string;
  boundingRect?: HighlightRect;
}

export interface PerformanceSnapshot {
  score: number;
  coreWebVitals: CoreWebVitals;
  renderBlocking: OpportunityItem[];
  unusedCss: OpportunityItem[];
  unusedJs: OpportunityItem[];
  images: ImageInsight[];
  lazyLoadGaps: LazyLoadInsight[];
  fontIssues: FontInsight[];
  bundles: BundleInsight[];
  summary: {
    requests: number;
    transferBytes: number;
    domNodes: number;
  };
}

export interface AccessibilitySnapshot {
  score: number;
  violationsCount: number;
  keyboardIssues: KeyboardIssue[];
  semanticIssues: SemanticIssue[];
  formIssues: FormIssue[];
  contrastIssueCount: number;
}

export interface ComparisonSnapshot {
  before: {
    performanceScore: number;
    accessibilityScore: number;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
  };
  after: {
    performanceScore: number;
    accessibilityScore: number;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
  };
  notes: string[];
}

export interface AiFixItem {
  issueId: string;
  explanation: string;
  fix: string;
  code: string;
  optimizedCode: string;
  priority: IssuePriority;
}

export interface AiSnapshot {
  enabled: boolean;
  provider: "openai" | "heuristic";
  model?: string;
  summary: string;
  fixes: AiFixItem[];
  grouped: Record<IssuePriority, string[]>;
}

export interface VisualDebugSnapshot {
  screenshotDataUrl: string | null;
  pageWidth: number;
  pageHeight: number;
  overlays: HighlightRect[];
}

export interface AuditReport {
  id: string;
  cacheKey: string;
  createdAt: string;
  mode: AuditMode;
  target: string;
  pageTitle: string;
  finalUrl: string;
  summary: {
    overallHealth: number;
    totalIssues: number;
    issueCounts: Record<IssuePriority, number>;
    topFindings: string[];
  };
  performance: PerformanceSnapshot;
  accessibility: AccessibilitySnapshot;
  issues: AuditIssue[];
  ai: AiSnapshot;
  comparison: ComparisonSnapshot;
  visualDebug: VisualDebugSnapshot;
}

export interface ReportListItem {
  id: string;
  cacheKey: string;
  createdAt: string;
  target: string;
  pageTitle: string;
  performanceScore: number;
  accessibilityScore: number;
  highIssues: number;
}
