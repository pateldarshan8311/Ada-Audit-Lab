import { ArrowRight, TrendingUp } from "lucide-react";

import { Card } from "@/components/shared/Card";
import { ComparisonSnapshot } from "@/lib/types/audit";
import { formatCwv } from "@/lib/utils/format";

function DeltaRow({
  label,
  before,
  after,
  metric
}: {
  label: string;
  before: number | null;
  after: number | null;
  metric: "score" | "lcp" | "cls" | "inp";
}) {
  const formatter =
    metric === "score"
      ? (value: number | null) => (value === null ? "n/a" : `${Math.round(value)}`)
      : (value: number | null) => formatCwv(metric, value);

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">Simulated before vs. after applying top fixes</div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-slate-300">{formatter(before)}</span>
        <ArrowRight className="h-4 w-4 text-slate-500" />
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">{formatter(after)}</span>
      </div>
    </div>
  );
}

export function ComparisonPanel({ comparison }: { comparison: ComparisonSnapshot }) {
  return (
    <Card
      title="Before vs After"
      subtitle="Projected gains after fixing the highest-impact performance and ADA findings."
      actions={
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
          <TrendingUp className="h-3.5 w-3.5" />
          Simulated optimization model
        </div>
      }
    >
      <div className="grid gap-3">
        <DeltaRow
          label="Performance Score"
          before={comparison.before.performanceScore}
          after={comparison.after.performanceScore}
          metric="score"
        />
        <DeltaRow
          label="Accessibility Score"
          before={comparison.before.accessibilityScore}
          after={comparison.after.accessibilityScore}
          metric="score"
        />
        <DeltaRow label="Largest Contentful Paint" before={comparison.before.lcp} after={comparison.after.lcp} metric="lcp" />
        <DeltaRow label="Cumulative Layout Shift" before={comparison.before.cls} after={comparison.after.cls} metric="cls" />
        <DeltaRow label="Interaction to Next Paint" before={comparison.before.inp} after={comparison.after.inp} metric="inp" />

        <div className="mt-2 grid gap-2">
          {comparison.notes.map((note) => (
            <div key={note} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
              {note}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
