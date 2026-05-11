import { Card } from "@/components/shared/Card";
import { CopyButton } from "@/components/shared/CopyButton";
import { AuditIssue } from "@/lib/types/audit";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatMs } from "@/lib/utils/format";

function badgeTone(priority: AuditIssue["priority"]) {
  if (priority === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (priority === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

export function IssueTable({
  issues,
  title = "Issues",
  subtitle = "Prioritized developer-facing findings."
}: {
  issues: AuditIssue[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      {!issues.length ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
          No issues matched the current filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]", badgeTone(issue.priority))}>
                      {issue.priority}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {issue.section}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {issue.source}
                    </span>
                    {issue.metric ? (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        {issue.metric}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-slate-50">{issue.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{issue.description}</p>
                    <p className="mt-2 text-sm text-slate-500">{issue.impact}</p>
                  </div>
                </div>

                <div className="grid shrink-0 gap-2 text-sm text-slate-300 sm:min-w-[180px]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Savings</div>
                    <div className="mt-1 font-medium text-slate-100">
                      {issue.savingsMs ? formatMs(issue.savingsMs) : "n/a"}
                      {issue.savingsBytes ? ` · ${formatBytes(issue.savingsBytes)}` : ""}
                    </div>
                  </div>
                  {issue.aiCode ? <CopyButton value={issue.aiCode} className="justify-center" /> : null}
                </div>
              </div>

              {issue.elements.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {issue.elements.slice(0, 4).map((element) => (
                    <span
                      key={`${issue.id}-${element.selector}`}
                      className="rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-400"
                    >
                      {element.selector}
                    </span>
                  ))}
                </div>
              ) : null}

              {issue.aiFix ? (
                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/6 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">AI fix preview</div>
                  <p className="mt-2 text-sm text-slate-200">{issue.aiFix}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
