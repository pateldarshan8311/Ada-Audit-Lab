import { Card } from "@/components/shared/Card";
import { CopyButton } from "@/components/shared/CopyButton";
import { AuditReport, IssuePriority } from "@/lib/types/audit";
import { cn } from "@/lib/utils/cn";

function priorityTone(priority: IssuePriority) {
  if (priority === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (priority === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

export function AiFixesTab({ report }: { report: AuditReport }) {
  const issueLookup = new Map(report.issues.map((issue) => [issue.id, issue]));

  return (
    <div className="grid gap-6">
      <Card
        title="AI Remediation Summary"
        subtitle="OpenAI-powered guidance when configured, with a deterministic fallback so the tool remains usable offline."
      >
        <div className="rounded-[22px] border border-cyan-400/20 bg-cyan-400/6 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
              {report.ai.provider}
            </span>
            {report.ai.model ? (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {report.ai.model}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{report.ai.summary}</p>
        </div>
      </Card>

      <div className="grid gap-4">
        {report.ai.fixes.map((fix) => {
          const issue = issueLookup.get(fix.issueId);

          return (
            <Card
              key={fix.issueId}
              title={issue?.title || fix.issueId}
              subtitle={issue?.description || "AI-generated remediation guidance."}
              actions={
                <div className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]", priorityTone(fix.priority))}>
                  {fix.priority}
                </div>
              }
            >
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Why it matters</div>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{fix.explanation}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fix</div>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{fix.fix}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Code</div>
                      <CopyButton value={fix.code} />
                    </div>
                    <pre className="scrollbar-thin overflow-x-auto text-xs leading-6 text-cyan-100">
                      <code>{fix.code}</code>
                    </pre>
                  </div>

                  <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Optimized Version</div>
                      <CopyButton value={fix.optimizedCode} />
                    </div>
                    <pre className="scrollbar-thin overflow-x-auto text-xs leading-6 text-emerald-100">
                      <code>{fix.optimizedCode}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
