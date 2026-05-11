import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { MongoClient } from "mongodb";

import { AuditReport, ReportListItem } from "@/lib/types/audit";

interface ReportStoreHealth {
  driver: "filesystem" | "mongodb";
  status: "ok" | "degraded";
}

interface ReportStore {
  driver: "filesystem" | "mongodb";
  ready(): Promise<void>;
  healthcheck(): Promise<ReportStoreHealth>;
  saveReport(report: AuditReport): Promise<void>;
  loadReportById(id: string): Promise<AuditReport>;
  loadReportByCacheKey(cacheKey: string): Promise<AuditReport | null>;
  listReports(limit?: number): Promise<ReportListItem[]>;
  close(): Promise<void>;
}

interface StoredReportDocument extends AuditReport {
  performanceScore: number;
  accessibilityScore: number;
  highIssues: number;
}

const FILE_CACHE_ROOT = path.join(process.cwd(), "data", ".audit-cache");
const FILE_REPORTS_ROOT = path.join(FILE_CACHE_ROOT, "reports");
const FILE_INDEX_PATH = path.join(FILE_CACHE_ROOT, "index.json");

function createStoredDocument(report: AuditReport): StoredReportDocument {
  return {
    ...report,
    performanceScore: report.performance.score,
    accessibilityScore: report.accessibility.score,
    highIssues: report.summary.issueCounts.high
  };
}

function toListItem(report: AuditReport): ReportListItem {
  return {
    id: report.id,
    cacheKey: report.cacheKey,
    createdAt: report.createdAt,
    target: report.target,
    pageTitle: report.pageTitle,
    performanceScore: report.performance.score,
    accessibilityScore: report.accessibility.score,
    highIssues: report.summary.issueCounts.high
  };
}

function stripStoredDocument(document: StoredReportDocument): AuditReport {
  const { accessibilityScore: _accessibilityScore, highIssues: _highIssues, performanceScore: _performanceScore, ...report } = document;
  return report;
}

class FileReportStore implements ReportStore {
  driver = "filesystem" as const;

  async ready() {
    await mkdir(FILE_REPORTS_ROOT, { recursive: true });
  }

  async healthcheck() {
    await this.ready();
    return {
      driver: this.driver,
      status: "ok" as const
    };
  }

  async saveReport(report: AuditReport) {
    await this.ready();
    const reportPath = path.join(FILE_REPORTS_ROOT, `${report.id}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    const index = await this.readIndex();
    const item = toListItem(report);
    const nextIndex = [item, ...index.filter((entry) => entry.id !== report.id)].slice(0, 50);
    await writeFile(FILE_INDEX_PATH, JSON.stringify(nextIndex, null, 2), "utf8");
  }

  async loadReportById(id: string) {
    await this.ready();
    const reportPath = path.join(FILE_REPORTS_ROOT, `${id}.json`);
    const raw = await readFile(reportPath, "utf8");
    return JSON.parse(raw) as AuditReport;
  }

  async loadReportByCacheKey(cacheKey: string) {
    const index = await this.readIndex();
    const match = index.find((entry) => entry.cacheKey === cacheKey);

    if (!match) {
      return null;
    }

    try {
      return await this.loadReportById(match.id);
    } catch {
      return null;
    }
  }

  async listReports(limit = 12) {
    const index = await this.readIndex();
    return index.slice(0, limit);
  }

  async close() {}

  private async readIndex() {
    await this.ready();

    try {
      const raw = await readFile(FILE_INDEX_PATH, "utf8");
      return JSON.parse(raw) as ReportListItem[];
    } catch {
      return [];
    }
  }
}

class MongoReportStore implements ReportStore {
  driver = "mongodb" as const;
  private readonly client: MongoClient;
  private readonly dbName: string;
  private initialized = false;

  constructor(connectionString: string, dbName: string) {
    this.client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 10000
    });
    this.dbName = dbName;
  }

  async ready() {
    await this.client.connect();

    if (this.initialized) {
      return;
    }

    const collection = this.collection();
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ cacheKey: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    this.initialized = true;
  }

  async healthcheck() {
    try {
      await this.ready();
      await this.database().command({ ping: 1 });

      return {
        driver: this.driver,
        status: "ok" as const
      };
    } catch {
      return {
        driver: this.driver,
        status: "degraded" as const
      };
    }
  }

  async saveReport(report: AuditReport) {
    await this.ready();
    const document = createStoredDocument(report);
    await this.collection().updateOne(
      { id: report.id },
      {
        $set: document
      },
      { upsert: true }
    );
  }

  async loadReportById(id: string) {
    await this.ready();
    const document = await this.collection().findOne({ id });

    if (!document) {
      throw new Error("Report not found.");
    }

    return stripStoredDocument(document);
  }

  async loadReportByCacheKey(cacheKey: string) {
    await this.ready();
    const document = await this.collection().findOne({ cacheKey });
    return document ? stripStoredDocument(document) : null;
  }

  async listReports(limit = 12) {
    await this.ready();

    return this.collection()
      .find(
        {},
        {
          projection: {
            _id: 0,
            id: 1,
            cacheKey: 1,
            createdAt: 1,
            target: 1,
            pageTitle: 1,
            performanceScore: 1,
            accessibilityScore: 1,
            highIssues: 1
          }
        }
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as Promise<ReportListItem[]>;
  }

  async close() {
    await this.client.close();
  }

  private database() {
    return this.client.db(this.dbName);
  }

  private collection() {
    return this.database().collection<StoredReportDocument>("reports");
  }
}

export function createReportStore(): ReportStore {
  const connectionString = process.env.MONGODB_URI?.trim();

  if (connectionString) {
    return new MongoReportStore(connectionString, process.env.MONGODB_DB_NAME?.trim() || "pulse_ada_audit_lab");
  }

  return new FileReportStore();
}
