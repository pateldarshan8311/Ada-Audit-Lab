"use client";

import { Download, Link2, Loader2 } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { AuditReport } from "@/lib/types/audit";

function downloadBlob(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function ReportActions({ report }: { report: AuditReport }) {
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  function downloadJson() {
    downloadBlob(
      `pulse-ada-${report.id}.json`,
      new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json"
      })
    );
  }

  async function downloadPdf() {
    setIsPdfLoading(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });

      let y = 42;
      const pageWidth = 515;
      const lineHeight = 18;

      const writeBlock = (text: string, size = 11, color = "#d6e2f0", gap = 12) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(color);
        const lines = pdf.splitTextToSize(text, pageWidth);
        if (y + lines.length * lineHeight > 780) {
          pdf.addPage();
          y = 42;
        }
        pdf.text(lines, 40, y);
        y += lines.length * lineHeight + gap;
      };

      pdf.setFillColor(9, 18, 32);
      pdf.rect(0, 0, 595, 842, "F");
      pdf.setTextColor("#f8fafc");
      pdf.setFontSize(22);
      pdf.text("Pulse ADA Audit Report", 40, y);
      y += 30;

      writeBlock(`${report.pageTitle} · ${report.target}`, 12, "#cbd5e1");
      writeBlock(
        `Performance ${report.performance.score} | Accessibility ${report.accessibility.score} | Overall ${report.summary.overallHealth}`,
        12,
        "#67e8f9"
      );
      writeBlock(`Top findings: ${report.summary.topFindings.join(", ")}`, 11, "#e2e8f0");

      writeBlock("Core Web Vitals", 14, "#f8fafc", 8);
      writeBlock(
        `LCP ${report.performance.coreWebVitals.lcp ?? "n/a"} ms | CLS ${report.performance.coreWebVitals.cls ?? "n/a"} | INP ${report.performance.coreWebVitals.inp ?? "n/a"} ms`,
        11,
        "#cbd5e1"
      );

      writeBlock("Priority Fixes", 14, "#f8fafc", 8);
      report.issues.slice(0, 8).forEach((issue, index) => {
        writeBlock(`${index + 1}. ${issue.title} (${issue.priority})`, 11, "#67e8f9", 6);
        writeBlock(issue.aiFix || issue.impact, 10, "#cbd5e1", 10);
      });

      pdf.save(`pulse-ada-${report.id}.pdf`);
    } finally {
      setIsPdfLoading(false);
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <Card title="Report Actions" subtitle="Download a report artifact or copy a deep link to this cached run.">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadJson}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
        >
          <Download className="h-4 w-4" />
          Download JSON
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
        >
          {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF
        </button>
        <button
          type="button"
          onClick={copyShareLink}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
        >
          <Link2 className="h-4 w-4" />
          Copy Share Link
        </button>
      </div>
    </Card>
  );
}
