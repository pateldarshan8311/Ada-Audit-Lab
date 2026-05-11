"use client";

import { create } from "zustand";

import { MAX_HISTORY_ITEMS } from "@/lib/constants/app";
import { AuditIssue, AuditReport, AuditRequestPayload, IssuePriority, ReportListItem } from "@/lib/types/audit";
import { sortIssues } from "@/lib/utils/ranking";

type TabKey = "overview" | "performance" | "accessibility" | "ai-fixes";
type PriorityFilter = "all" | IssuePriority;
type SectionFilter = "all" | "performance" | "accessibility";

interface PersistedRun {
  id: string;
  target: string;
  pageTitle: string;
  createdAt: string;
  performanceScore: number;
  accessibilityScore: number;
  highIssues: number;
}

interface AuditStore {
  activeTab: TabKey;
  priorityFilter: PriorityFilter;
  sectionFilter: SectionFilter;
  includeLowPriority: boolean;
  isLoading: boolean;
  progress: number;
  stage: string;
  error: string | null;
  report: AuditReport | null;
  history: ReportListItem[];
  localRuns: PersistedRun[];
  setActiveTab: (tab: TabKey) => void;
  setPriorityFilter: (priority: PriorityFilter) => void;
  setSectionFilter: (section: SectionFilter) => void;
  setIncludeLowPriority: (value: boolean) => void;
  hydrateHistory: () => Promise<void>;
  loadReportById: (id: string) => Promise<void>;
  runAudit: (payload: AuditRequestPayload) => Promise<void>;
  clearError: () => void;
  filteredIssues: () => AuditIssue[];
}

const STAGES = [
  { progress: 12, label: "Validating target and preparing browser session" },
  { progress: 28, label: "Running Lighthouse categories and gathering render-path data" },
  { progress: 52, label: "Collecting JavaScript coverage, images, fonts, and layout shifts" },
  { progress: 76, label: "Scanning accessibility issues with axe-core" },
  { progress: 92, label: "Generating AI fix guidance and final comparison model" }
] as const;

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function getApiUrl(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error || data.message || "The request failed.";
  } catch {
    return "The request failed.";
  }
}

function readLocalRuns() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem("pulse-ada-runs");
    return raw ? (JSON.parse(raw) as PersistedRun[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRuns(runs: PersistedRun[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("pulse-ada-runs", JSON.stringify(runs.slice(0, MAX_HISTORY_ITEMS)));
}

function setReportSearchParam(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("report", id);
  window.history.replaceState({}, "", url.toString());
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  activeTab: "overview",
  priorityFilter: "all",
  sectionFilter: "all",
  includeLowPriority: true,
  isLoading: false,
  progress: 0,
  stage: "Ready to scan",
  error: null,
  report: null,
  history: [],
  localRuns: [],
  setActiveTab: (activeTab) => set({ activeTab }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setSectionFilter: (sectionFilter) => set({ sectionFilter }),
  setIncludeLowPriority: (includeLowPriority) => set({ includeLowPriority }),
  clearError: () => set({ error: null }),
  hydrateHistory: async () => {
    const localRuns = readLocalRuns();

    try {
      const response = await fetch(getApiUrl("/reports"), {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { reports?: ReportListItem[] };

      set({
        history: data.reports ?? [],
        localRuns
      });
    } catch {
      set({
        localRuns
      });
    }
  },
  loadReportById: async (id) => {
    set({ isLoading: true, error: null, stage: "Loading cached report", progress: 24 });

    try {
      const response = await fetch(getApiUrl(`/reports/${id}`), {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const report = (await response.json()) as AuditReport;
      setReportSearchParam(report.id);
      set({
        report,
        isLoading: false,
        progress: 100,
        stage: "Loaded cached report"
      });
    } catch (error) {
      set({
        isLoading: false,
        progress: 0,
        stage: "Ready to scan",
        error: error instanceof Error ? error.message : "Unable to load the selected report."
      });
    }
  },
  runAudit: async (payload) => {
    let timer: number | undefined;
    let stageIndex = 0;

    set({
      isLoading: true,
      error: null,
      progress: STAGES[0].progress,
      stage: STAGES[0].label
    });

    timer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, STAGES.length - 1);
      set({
        progress: STAGES[stageIndex].progress,
        stage: STAGES[stageIndex].label
      });
    }, 1400);

    try {
      const response = await fetch(getApiUrl("/audit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as {
        error?: string;
        report?: AuditReport;
      };

      if (!response.ok || !data.report) {
        throw new Error(data.error || "The audit request failed.");
      }

      const report = data.report;
      setReportSearchParam(report.id);

      const entry: PersistedRun = {
        id: report.id,
        target: report.target,
        pageTitle: report.pageTitle,
        createdAt: report.createdAt,
        performanceScore: report.performance.score,
        accessibilityScore: report.accessibility.score,
        highIssues: report.summary.issueCounts.high
      };

      const localRuns = [entry, ...readLocalRuns().filter((run) => run.id !== report.id)].slice(0, MAX_HISTORY_ITEMS);
      writeLocalRuns(localRuns);

      set({
        report,
        localRuns,
        isLoading: false,
        progress: 100,
        stage: "Audit complete"
      });

      await get().hydrateHistory();
    } catch (error) {
      set({
        isLoading: false,
        progress: 0,
        stage: "Ready to scan",
        error: error instanceof Error ? error.message : "The audit request failed."
      });
    } finally {
      if (timer) {
        window.clearInterval(timer);
      }
    }
  },
  filteredIssues: () => {
    const state = get();
    const issues = sortIssues(state.report?.issues ?? []);

    return issues.filter((issue) => {
      if (state.priorityFilter !== "all" && issue.priority !== state.priorityFilter) {
        return false;
      }

      if (state.sectionFilter !== "all" && issue.section !== state.sectionFilter) {
        return false;
      }

      if (!state.includeLowPriority && issue.priority === "low") {
        return false;
      }

      return true;
    });
  }
}));
