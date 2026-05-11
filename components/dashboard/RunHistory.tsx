"use client";

import { History, Link2 } from "lucide-react";

import { Card } from "@/components/shared/Card";
import { useAuditStore } from "@/lib/state/useAuditStore";
import { formatDate } from "@/lib/utils/format";

export function RunHistory() {
  const history = useAuditStore((state) => state.history);
  const localRuns = useAuditStore((state) => state.localRuns);
  const loadReportById = useAuditStore((state) => state.loadReportById);

  const combined = [...history]
    .concat(
      localRuns
        .filter((run) => !history.find((entry) => entry.id === run.id))
        .map((run) => ({
          id: run.id,
          cacheKey: `local:${run.id}`,
          createdAt: run.createdAt,
          target: run.target,
          pageTitle: run.pageTitle,
          performanceScore: run.performanceScore,
          accessibilityScore: run.accessibilityScore,
          highIssues: run.highIssues
        }))
    )
    .slice(0, 8);

  return (
    <Card
      title="Run History"
      subtitle="Cached reports on this machine. Click a run to reopen it instantly."
      actions={
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
          <History className="h-3.5 w-3.5" />
          {combined.length} stored runs
        </div>
      }
    >
      {!combined.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-400">
          No cached runs yet. Your first audit will appear here automatically.
        </div>
      ) : (
        <div className="grid gap-3">
          {combined.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => loadReportById(item.id)}
              className="flex flex-col gap-3 rounded-[22px] border border-slate-800 bg-slate-950/55 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-950/80 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                  <Link2 className="h-4 w-4 text-cyan-300" />
                  {item.pageTitle}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.target}</div>
                <div className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt)}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                  Perf {item.performanceScore}
                </span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                  ADA {item.accessibilityScore}
                </span>
                <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-rose-200">
                  High {item.highIssues}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
