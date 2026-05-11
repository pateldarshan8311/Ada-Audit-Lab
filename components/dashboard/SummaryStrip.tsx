import { AlertTriangle, Gauge, ShieldCheck, Sparkles } from "lucide-react";

import { AuditReport } from "@/lib/types/audit";
import { scoreTone } from "@/lib/utils/format";

const items = [
  {
    key: "overall",
    label: "Overall Health",
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
    icon: ShieldCheck
  },
  {
    key: "issues",
    label: "High Priority Issues",
    icon: AlertTriangle
  }
] as const;

export function SummaryStrip({ report }: { report: AuditReport }) {
  const values = {
    overall: report.summary.overallHealth,
    performance: report.performance.score,
    accessibility: report.accessibility.score,
    issues: report.summary.issueCounts.high
  };

  return (
    <div className="metric-grid">
      {items.map((item) => {
        const Icon = item.icon;
        const value = values[item.key];
        const tone =
          item.key === "issues"
            ? value === 0
              ? "text-emerald-300"
              : value < 4
                ? "text-amber-300"
                : "text-rose-300"
            : scoreTone(value);

        return (
          <div key={item.key} className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-400">{item.label}</div>
              <Icon className="h-4 w-4 text-slate-500" />
            </div>
            <div className={`mt-3 text-3xl font-semibold tracking-tight ${tone}`}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}
