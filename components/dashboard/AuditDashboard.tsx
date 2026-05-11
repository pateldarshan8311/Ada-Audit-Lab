"use client";

import { useEffect } from "react";
import { AlertCircle, Gauge, Shield, Sparkles, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { AuditForm } from "@/components/dashboard/AuditForm";
import { IssueFilters } from "@/components/issues/IssueFilters";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { OverviewTab } from "@/components/tabs/OverviewTab";
import { PerformanceTab } from "@/components/tabs/PerformanceTab";
import { AccessibilityTab } from "@/components/tabs/AccessibilityTab";
import { AiFixesTab } from "@/components/tabs/AiFixesTab";
import { Card } from "@/components/shared/Card";
import { useAuditStore } from "@/lib/state/useAuditStore";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

const tabs = [
  {
    key: "overview",
    label: "Overview",
    icon: Sparkles
  },
  {
    key: "performance",
    label: "Performance",
    icon: Gauge
  },
  {
    key: "accessibility",
    label: "Accessibility",
    icon: Shield
  },
  {
    key: "ai-fixes",
    label: "AI Fixes",
    icon: Wrench
  }
] as const;

export function AuditDashboard() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report");
  const hydrateHistory = useAuditStore((state) => state.hydrateHistory);
  const loadReportById = useAuditStore((state) => state.loadReportById);
  const activeTab = useAuditStore((state) => state.activeTab);
  const setActiveTab = useAuditStore((state) => state.setActiveTab);
  const isLoading = useAuditStore((state) => state.isLoading);
  const progress = useAuditStore((state) => state.progress);
  const stage = useAuditStore((state) => state.stage);
  const error = useAuditStore((state) => state.error);
  const report = useAuditStore((state) => state.report);
  const filteredIssues = useAuditStore((state) => state.filteredIssues);

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  useEffect(() => {
    if (reportId) {
      void loadReportById(reportId);
    }
  }, [loadReportById, reportId]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card
          title="Scan Target"
          subtitle="Run a full local audit against a live URL or inspect uploaded HTML during development."
        >
          <AuditForm />
        </Card>

        <Card
          title="Audit Workflow"
          subtitle="This environment caches previous reports locally and deep-links to any saved run."
        >
          <div className="grid gap-3">
            <div className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current state</div>
              <div className="mt-2 text-lg font-semibold text-slate-100">{isLoading ? stage : "Ready to scan"}</div>
              <div className="mt-2 text-sm text-slate-400">
                {report ? `Loaded ${report.pageTitle} · ${formatDate(report.createdAt)}` : "No report loaded yet."}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-300">
              Each scan combines Lighthouse scores, Puppeteer resource analysis, custom DOM heuristics, axe-core
              accessibility findings, AI remediation, visual overlays, and a simulated before-vs-after model.
            </div>

            {isLoading ? <ProgressBar progress={progress} label={stage} /> : null}
          </div>
        </Card>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Audit error
          </div>
          <div className="mt-2">{error}</div>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="panel rounded-[24px] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">{report.pageTitle}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {report.finalUrl} · {report.summary.totalIssues} total issues · {report.ai.provider} remediation
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                        active
                          ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100"
                          : "border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Card title="Filters" subtitle="Prioritize the issues that matter most to your next pass.">
            <IssueFilters />
          </Card>

          {activeTab === "overview" ? <OverviewTab report={report} issues={filteredIssues()} /> : null}
          {activeTab === "performance" ? (
            <PerformanceTab report={report} issues={filteredIssues().filter((issue) => issue.section === "performance")} />
          ) : null}
          {activeTab === "accessibility" ? (
            <AccessibilityTab report={report} issues={filteredIssues().filter((issue) => issue.section === "accessibility")} />
          ) : null}
          {activeTab === "ai-fixes" ? <AiFixesTab report={report} /> : null}
        </>
      ) : (
        <Card title="No Report Yet" subtitle="Run a scan to unlock the dashboard, AI fixes, overlays, and export actions.">
          <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-slate-500" />
            <h3 className="mt-4 text-lg font-semibold text-slate-100">Start with a live URL or uploaded HTML file</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              The first audit will populate performance diagnostics, ADA findings, AI remediation snippets, visual debug
              overlays, before-vs-after simulation, downloadable reports, and cached history.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
