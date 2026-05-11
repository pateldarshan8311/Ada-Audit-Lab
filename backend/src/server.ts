import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";

import { runAudit } from "@/lib/audit/auditService";
import { AuditRequestPayload } from "@/lib/types/audit";
import { createCacheKey } from "@/lib/utils/url";
import { createReportStore } from "@/lib/server/reportStore";

dotenv.config();

const app = express();
const reportStore = createReportStore();
const port = Number(process.env.PORT) || 4000;

const auditRequestSchema = z
  .object({
    mode: z.enum(["url", "html"]),
    url: z.string().optional(),
    html: z.string().optional(),
    fileName: z.string().optional(),
    forceRefresh: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.mode === "url" && !value.url?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "A valid URL is required."
      });
    }

    if (value.mode === "html" && !value.html?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["html"],
        message: "An HTML document is required."
      });
    }
  });

function getAllowedOrigins() {
  const configured = process.env.CORS_ALLOWED_ORIGINS?.trim();
  const fallback = process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:3000,https://ada-audit-lab.netlify.app";

  return (configured || fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set(getAllowedOrigins());

      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/health", async (_request, response) => {
  const storage = await reportStore.healthcheck();

  response.json({
    status: storage.status === "ok" ? "ok" : "degraded",
    storage,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/reports", async (_request, response, next) => {
  try {
    const reports = await reportStore.listReports();
    response.json({ reports });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/:id", async (request, response, next) => {
  try {
    const report = await reportStore.loadReportById(request.params.id);
    response.json(report);
  } catch (error) {
    next({
      status: 404,
      message: "Report not found.",
      cause: error
    });
  }
});

app.post("/api/audit", async (request, response, next) => {
  try {
    const body = auditRequestSchema.parse(request.body) as AuditRequestPayload;
    const cacheKey = createCacheKey(body);

    if (!body.forceRefresh) {
      const cached = await reportStore.loadReportByCacheKey(cacheKey);

      if (cached) {
        response.json({
          cached: true,
          report: cached
        });
        return;
      }
    }

    const report = await runAudit(body);
    await reportStore.saveReport(report);

    response.json({
      cached: false,
      report
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Backend error:", error);

  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 400;

  const message =
    error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(" ")
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "The request could not be completed.";

  response.status(status).json({
    error: message
  });
});

async function startServer() {
  await reportStore.ready();

  const server = app.listen(port, () => {
    console.log(`Pulse ADA backend listening on port ${port}`);
    console.log(`Allowed origins: ${getAllowedOrigins().join(", ")}`);
    console.log(`Storage driver: ${reportStore.driver}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await reportStore.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
