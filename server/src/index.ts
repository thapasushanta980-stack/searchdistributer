import { config } from "./config.js";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { startAutopostWorker } from "./modules/social/autopost.js";
import { startNurvexaWorker } from "./modules/social/content/worker.js";
import { startOutboxWorker } from "./modules/notifications/outbox.js";

const app = await createApp();
const server = app.listen(config.PORT, () => {
  logger.info(`Search Distributor listening on ${config.siteUrl} (port ${config.PORT}, ${config.NODE_ENV})`);
});
const stopWorker = startOutboxWorker();
const stopAutopost = startAutopostWorker();
const stopNurvexa = startNurvexaWorker();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  stopWorker();
  stopAutopost();
  stopNurvexa();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
