import { Card } from "@/components/shared/Card";
import { IssueTable } from "@/components/issues/IssueTable";
import { AuditIssue, AuditReport } from "@/lib/types/audit";
import { formatBytes, formatMs, percent } from "@/lib/utils/format";

function ResourceList({
  title,
  items,
  render
}: {
  title: string;
  items: unknown[];
  render: (item: any, index: number) => React.ReactNode;
}) {
  return (
    <Card title={title}>
      {!items.length ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
          No findings in this category.
        </div>
      ) : (
        <div className="grid gap-3">{items.map(render)}</div>
      )}
    </Card>
  );
}

export function PerformanceTab({
  report,
  issues
}: {
  report: AuditReport;
  issues: AuditIssue[];
}) {
  const vitals = report.performance.coreWebVitals;

  return (
    <div className="grid gap-6">
      <div className="metric-grid">
        {[
          ["LCP", formatMs(vitals.lcp)],
          ["CLS", vitals.cls === null ? "n/a" : vitals.cls.toFixed(3)],
          ["INP", formatMs(vitals.inp)],
          ["TBT", formatMs(vitals.tbt)],
          ["Requests", String(report.performance.summary.requests)],
          ["Transfer", formatBytes(report.performance.summary.transferBytes)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ResourceList
          title="Render Blocking"
          items={report.performance.renderBlocking}
          render={(item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
              <div className="font-medium text-slate-100">{item.label}</div>
              <div className="mt-1 text-slate-500">
                {item.wastedMs ? `${formatMs(item.wastedMs)} render delay` : "Audit hit"}
                {item.wastedBytes ? ` · ${formatBytes(item.wastedBytes)}` : ""}
              </div>
            </div>
          )}
        />

        <ResourceList
          title="Unused CSS / JS"
          items={[...report.performance.unusedCss.slice(0, 3), ...report.performance.unusedJs.slice(0, 3)]}
          render={(item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
              <div className="font-medium text-slate-100">{item.label}</div>
              <div className="mt-1 text-slate-500">
                {item.wastedBytes ? formatBytes(item.wastedBytes) : "Unknown size"}
                {item.wastedMs ? ` · ${formatMs(item.wastedMs)}` : ""}
              </div>
            </div>
          )}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ResourceList
          title="Large Images"
          items={report.performance.images.slice(0, 6)}
          render={(image, index) => (
            <div key={`${image.src}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
              <div className="truncate font-medium text-slate-100">{image.selector}</div>
              <div className="mt-1 truncate text-slate-500">{image.src}</div>
              <div className="mt-2 text-slate-400">
                {formatBytes(image.bytes)} · {image.width}×{image.height} · {image.loading || "eager"}
              </div>
            </div>
          )}
        />

        <ResourceList
          title="Bundle Efficiency"
          items={report.performance.bundles.slice(0, 6)}
          render={(bundle, index) => (
            <div key={`${bundle.url}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
              <div className="truncate font-medium text-slate-100">{bundle.url}</div>
              <div className="mt-1 text-slate-500">
                Used {percent(bundle.percentUsed)} · Total {formatBytes(bundle.totalBytes)} · Unused {formatBytes(bundle.unusedBytes)}
              </div>
            </div>
          )}
        />
      </div>

      <ResourceList
        title="Font and Lazy Loading Signals"
        items={[...report.performance.fontIssues, ...report.performance.lazyLoadGaps].slice(0, 8)}
        render={(item, index) => (
          <div key={`${index}-${"issue" in item ? item.issue : item.src}`} className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm">
            <div className="font-medium text-slate-100">{"issue" in item ? item.issue : item.selector}</div>
            <div className="mt-1 text-slate-500">
              {"family" in item ? item.family || item.src || "Font resource" : item.src}
            </div>
          </div>
        )}
      />

      <IssueTable issues={issues} title="Performance Fix Queue" subtitle="Triage the render path, media, and JavaScript overhead first." />
    </div>
  );
}
