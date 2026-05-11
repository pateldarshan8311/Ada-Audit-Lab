"use client";

import { useState } from "react";
import { Bug, Contrast, Move } from "lucide-react";

import { Card } from "@/components/shared/Card";
import { AuditReport, HighlightRect } from "@/lib/types/audit";
import { cn } from "@/lib/utils/cn";

function toneForRect(rect: HighlightRect) {
  if (rect.kind === "contrast") return "border-amber-300 bg-amber-400/14";
  if (rect.kind === "layout-shift") return "border-rose-300 bg-rose-400/14";
  return rect.section === "accessibility" ? "border-cyan-300 bg-cyan-400/14" : "border-lime-300 bg-lime-400/14";
}

export function VisualDebugPanel({ report }: { report: AuditReport }) {
  const [showIssues, setShowIssues] = useState(true);
  const [showContrast, setShowContrast] = useState(true);
  const [showShifts, setShowShifts] = useState(true);

  const overlays = report.visualDebug.overlays.filter((rect) => {
    if (rect.kind === "issue" && !showIssues) return false;
    if (rect.kind === "contrast" && !showContrast) return false;
    if (rect.kind === "layout-shift" && !showShifts) return false;
    return true;
  });

  return (
    <Card
      title="Visual Debug"
      subtitle="Overlay the scanned page with issue boxes, contrast warnings, and layout shift sources."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowIssues((value) => !value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
              showIssues
                ? "border-lime-400/30 bg-lime-400/10 text-lime-200"
                : "border-slate-700 bg-slate-950 text-slate-400"
            )}
          >
            <Bug className="h-3.5 w-3.5" />
            Issues
          </button>
          <button
            type="button"
            onClick={() => setShowContrast((value) => !value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
              showContrast
                ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "border-slate-700 bg-slate-950 text-slate-400"
            )}
          >
            <Contrast className="h-3.5 w-3.5" />
            Contrast
          </button>
          <button
            type="button"
            onClick={() => setShowShifts((value) => !value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
              showShifts
                ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                : "border-slate-700 bg-slate-950 text-slate-400"
            )}
          >
            <Move className="h-3.5 w-3.5" />
            Layout shift
          </button>
        </div>
      }
    >
      {report.visualDebug.screenshotDataUrl ? (
        <div className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-950/60">
          <div className="relative">
            <img
              src={report.visualDebug.screenshotDataUrl}
              alt={`${report.pageTitle} debug screenshot`}
              className="block w-full"
            />

            {overlays.map((rect, index) => (
              <div
                key={`${rect.kind}-${rect.selector}-${index}`}
                className={cn("absolute rounded-md border-2 shadow-[0_0_0_1px_rgba(2,8,23,0.45)]", toneForRect(rect))}
                style={{
                  left: `${(rect.x / report.visualDebug.pageWidth) * 100}%`,
                  top: `${(rect.y / report.visualDebug.pageHeight) * 100}%`,
                  width: `${(rect.width / report.visualDebug.pageWidth) * 100}%`,
                  height: `${(rect.height / report.visualDebug.pageHeight) * 100}%`
                }}
                title={rect.label}
              >
                <span className="absolute -top-6 left-0 rounded bg-slate-950/95 px-2 py-1 text-[10px] font-medium text-slate-200">
                  {rect.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-400">
          No screenshot was captured for this audit.
        </div>
      )}
    </Card>
  );
}
