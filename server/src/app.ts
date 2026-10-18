import compression from "compression";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./db.js";
import { canonicalRedirects } from "./middleware/redirects.js";
import { errorHandler, notFoundApi } from "./middleware/common.js";
import { admin } from "./routes/admin.js";
import { api } from "./routes/api.js";
import { seoRoutes } from "./routes/seo.js";
import { studioHtml } from "./studio-ui/page.js";
import { studioJs } from "./studio-ui/script.js";
import { mountSsr } from "./ssr.js";

export async function createApp(): Promise<Express> {
  const app = express();
  app.disable("x-powered-by");
  if (config.isProd) app.set("trust proxy", 1);

  app.use(
    helmet({
      // Vite's dev server injects inline scripts; the CSP is enforced in production builds.
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "https:"],
              fontSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/@") || (req.url ?? "").includes("/node_modules/") || (req.url ?? "").startsWith("/src/") } }));

  app.get("/healthz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use(canonicalRedirects);
  app.use(seoRoutes);
  app.use("/api/v1", express.json({ limit: "32kb" }), api);
  app.use("/api/admin/v1", express.json({ limit: "256kb" }), admin);
  app.use("/api", notFoundApi);

  // Content Studio page. It holds no secrets; all data comes from /api/admin/v1/studio behind the admin login.
  app.get("/studio", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.type("html").send(studioHtml);
  });
  app.get("/studio/app.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("js").send(studioJs);
  });

  await mountSsr(app);
  app.use(errorHandler);
  return app;
}
