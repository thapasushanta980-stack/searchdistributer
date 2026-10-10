import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.isProd ? "info" : "debug",
  // Never log contact details or message bodies.
  redact: ["req.headers.cookie", "req.headers.authorization", "*.email", "*.phone", "*.message", "*.senderEmail"],
});
