import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AuditReport, ReportListItem } from "@/lib/types/audit";

const CACHE_ROOT = path.join(process.cwd(), ".audit-cache");
const REPORTS_ROOT = path.join(CACHE_ROOT, "reports");
const INDEX_PATH = path.join(CACHE_ROOT, "index.json");

interface CacheIndexItem extends ReportListItem {}

async function ensureCache() {
  await mkdir(REPORTS_ROOT, { recursive: true });
}

async function readIndex() {
  await ensureCache();

  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw) as CacheIndexItem[];
  } catch {
    return [];
  }
}

async function writeIndex(index: CacheIndexItem[]) {
  await ensureCache();
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

export async function saveReport(report: AuditReport) {
  await ensureCache();
  const reportPath = path.join(REPORTS_ROOT, `${report.id}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  const index = await readIndex();
  const item: CacheIndexItem = {
    id: report.id,
    cacheKey: report.cacheKey,
    createdAt: report.createdAt,
    target: report.target,
    pageTitle: report.pageTitle,
    performanceScore: report.performance.score,
    accessibilityScore: report.accessibility.score,
    highIssues: report.summary.issueCounts.high
  };

  const nextIndex = [item, ...index.filter((entry) => entry.id !== report.id)].slice(0, 50);
  await writeIndex(nextIndex);
}

export async function loadReportById(id: string) {
  await ensureCache();
  const reportPath = path.join(REPORTS_ROOT, `${id}.json`);
  const raw = await readFile(reportPath, "utf8");
  return JSON.parse(raw) as AuditReport;
}

export async function loadReportByCacheKey(cacheKey: string) {
  const index = await readIndex();
  const match = index.find((entry) => entry.cacheKey === cacheKey);
  if (!match) return null;

  try {
    return await loadReportById(match.id);
  } catch {
    return null;
  }
}

export async function listReports(limit = 12) {
  const index = await readIndex();
  return index.slice(0, limit);
}

export async function cacheDiagnostics() {
  await ensureCache();
  const files = await readdir(REPORTS_ROOT);
  return {
    files: files.length
  };
}
