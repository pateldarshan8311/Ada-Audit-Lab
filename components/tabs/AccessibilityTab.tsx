import { Card } from "@/components/shared/Card";
import { IssueTable } from "@/components/issues/IssueTable";
import { AuditIssue, AuditReport } from "@/lib/types/audit";

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export function AccessibilityTab({
  report,
  issues
}: {
  report: AuditReport;
  issues: AuditIssue[];
}) {
  return (
    <div className="grid gap-6">
      <div className="metric-grid">
        <CountCard label="axe Violations" value={report.accessibility.violationsCount} />
        <CountCard label="Contrast Highlights" value={report.accessibility.contrastIssueCount} />
        <CountCard label="Keyboard Gaps" value={report.accessibility.keyboardIssues.length} />
        <CountCard label="Semantic Issues" value={report.accessibility.semanticIssues.length} />
        <CountCard label="Form Label Issues" value={report.accessibility.formIssues.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Keyboard Navigation">
          <div className="grid gap-3">
            {report.accessibility.keyboardIssues.length ? (
              report.accessibility.keyboardIssues.map((issue) => (
                <div key={issue.selector} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                  <div className="font-medium text-slate-100">{issue.selector}</div>
                  <div className="mt-1 text-slate-500">{issue.issue}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                No custom keyboard findings were detected.
              </div>
            )}
          </div>
        </Card>

        <Card title="Semantic HTML">
          <div className="grid gap-3">
            {report.accessibility.semanticIssues.length ? (
              report.accessibility.semanticIssues.map((issue) => (
                <div key={issue.selector} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                  <div className="font-medium text-slate-100">{issue.selector}</div>
                  <div className="mt-1 text-slate-500">{issue.issue}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                Semantic structure looks clean from the custom pass.
              </div>
            )}
          </div>
        </Card>

        <Card title="Forms and Labels">
          <div className="grid gap-3">
            {report.accessibility.formIssues.length ? (
              report.accessibility.formIssues.map((issue) => (
                <div key={issue.selector} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                  <div className="font-medium text-slate-100">{issue.selector}</div>
                  <div className="mt-1 text-slate-500">{issue.issue}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                No unlabeled form controls were detected by the custom scan.
              </div>
            )}
          </div>
        </Card>
      </div>

      <IssueTable issues={issues} title="Accessibility Fix Queue" subtitle="Focus on the issues that block screen readers, keyboard navigation, and contrast compliance first." />
    </div>
  );
}
