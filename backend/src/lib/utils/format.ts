import { IssuePriority } from "@/lib/types/audit";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatBytes(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${round(size, size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatMs(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }

  if (Math.abs(value) >= 1000) {
    return `${round(value / 1000, 2)} s`;
  }

  return `${round(value)} ms`;
}

export function formatScore(score: number) {
  return `${Math.round(score)}`;
}

export function formatCwv(metric: string, value: number | null) {
  if (metric === "cls") {
    return value === null ? "n/a" : round(value, 3).toString();
  }

  return formatMs(value);
}

export function priorityWeight(priority: IssuePriority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

export function scoreTone(score: number) {
  if (score >= 90) return "text-emerald-300";
  if (score >= 70) return "text-cyan-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

export function percent(value: number) {
  return `${round(value, 1)}%`;
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
