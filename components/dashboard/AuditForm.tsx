"use client";

import { ChangeEvent, useState } from "react";
import { FileCode2, Globe, Play, RotateCcw } from "lucide-react";

import { useAuditStore } from "@/lib/state/useAuditStore";
import { cn } from "@/lib/utils/cn";

function looksLikeUrl(value: string) {
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(normalized);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function AuditForm() {
  const runAudit = useAuditStore((state) => state.runAudit);
  const isLoading = useAuditStore((state) => state.isLoading);
  const [mode, setMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("https://example.com");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [freshScan, setFreshScan] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFormError(null);

    try {
      const content = await file.text();
      setHtml(content);
    } catch {
      setFormError("Unable to read the uploaded file.");
    }
  }

  async function onSubmit() {
    if (mode === "url") {
      if (!looksLikeUrl(url)) {
        setFormError("Enter a valid http or https URL.");
        return;
      }

      setFormError(null);
      await runAudit({
        mode,
        url,
        forceRefresh: freshScan
      });
      return;
    }

    if (!html.trim()) {
      setFormError("Upload an HTML file to continue.");
      return;
    }

    setFormError(null);
    await runAudit({
      mode,
      html,
      fileName,
      forceRefresh: freshScan
    });
  }

  return (
    <div className="rounded-[24px] border border-slate-800/80 bg-slate-950/60 p-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            key: "url",
            label: "Live URL",
            icon: Globe
          },
          {
            key: "html",
            label: "Upload HTML",
            icon: FileCode2
          }
        ].map((item) => {
          const Icon = item.icon;
          const active = mode === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setMode(item.key as "url" | "html");
                setFormError(null);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100"
                  : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        {mode === "url" ? (
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Target URL</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.yoursite.com"
              className="h-12 rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
            />
          </label>
        ) : (
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">HTML Document</span>
            <div className="dashed-surface rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4">
              <input
                type="file"
                accept=".html,.htm,text/html"
                onChange={onFileChange}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-cyan-100 hover:file:bg-cyan-400/20"
              />
              <p className="mt-3 text-xs text-slate-500">
                Relative assets referenced by the HTML file may not resolve unless they are public URLs.
              </p>
              {fileName ? <p className="mt-3 text-sm text-slate-300">Loaded: {fileName}</p> : null}
            </div>
          </label>
        )}

        <label className="inline-flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={freshScan}
            onChange={(event) => setFreshScan(event.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-500"
          />
          Run a fresh scan instead of reusing a cached report
        </label>

        {formError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0891b2)] px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {isLoading ? "Scanning..." : "Run Deep Audit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setUrl("https://example.com");
              setHtml("");
              setFileName("");
              setFreshScan(false);
              setFormError(null);
            }}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-5 text-sm font-medium text-slate-200 transition hover:border-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
