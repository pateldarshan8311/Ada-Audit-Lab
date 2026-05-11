import { createHash } from "node:crypto";

import { AuditMode, AuditRequestPayload } from "@/lib/types/audit";

export function normalizeUrl(input: string) {
  const value = input.trim();
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(normalized);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  return url.toString();
}

export function getTargetLabel(mode: AuditMode, payload: AuditRequestPayload) {
  if (mode === "html") {
    return payload.fileName?.trim() || "Uploaded HTML document";
  }

  return normalizeUrl(payload.url ?? "");
}

export function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createCacheKey(payload: AuditRequestPayload) {
  if (payload.mode === "html") {
    return `html:${hashContent(payload.html ?? "")}`;
  }

  return `url:${normalizeUrl(payload.url ?? "")}`;
}
