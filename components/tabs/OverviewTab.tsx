import { Card } from "@/components/shared/Card";
import { ComparisonPanel } from "@/components/dashboard/ComparisonPanel";
import { RunHistory } from "@/components/dashboard/RunHistory";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { VisualDebugPanel } from "@/components/dashboard/VisualDebugPanel";
import { IssueTable } from "@/components/issues/IssueTable";
import { ReportActions } from "@/components/reports/ReportActions";
import { AuditReport } from "@/lib/types/audit";

export function OverviewTab({
  report,
  issues
}: {
  report: AuditReport;
  issues: AuditReport["issues"];
}) {
  return (
    <div className="grid gap-6">
      <SummaryStrip report={report} />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <ComparisonPanel comparison={report.comparison} />
        <ReportActions report={report} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <VisualDebugPanel report={report} />
        <RunHistory />
      </div>

      <Card title="Executive Findings" subtitle="The highest-impact issues to fix first across both performance and accessibility.">
        <div className="grid gap-3">
          {report.summary.topFindings.map((finding) => (
            <div key={finding} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
              {finding}
            </div>
          ))}
        </div>
      </Card>

      <IssueTable issues={issues} title="Prioritized Issue Queue" subtitle="A single triage list ordered by severity, savings, and developer value." />
    </div>
  );
}
