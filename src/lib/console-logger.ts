import fs from "fs";
import path from "path";
import util from "util";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const LOG_FILE = path.join(OUTPUT_DIR, "console.log");

let initialized = false;

/**
 * Patches the global console methods so that every console call is
 * also appended to `output/console.log` (in addition to the normal
 * stdout/stderr output).
 */
export function setupConsoleLogger() {
  if (initialized) return;
  initialized = true;

  // Serverless platforms such as Vercel mount the app directory read-only,
  // so mkdir throws EROFS. Letting that escape from instrumentation crashes
  // every server route (e.g. /api/models), so fall back to plain console output.
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch {
    return;
  }

  const methods = ["log", "info", "warn", "error", "debug"] as const;

  for (const method of methods) {
    const original = console[method].bind(console);

    console[method] = (...args: unknown[]) => {
      original(...args);

      const timestamp = new Date().toISOString();
      const message = util.format(...args);

      fs.appendFile(
        LOG_FILE,
        `[${timestamp}] [${method.toUpperCase()}] ${message}\n`,
        (err) => {
          if (err) {
            original("Failed to write to console.log:", err);
          }
        }
      );
    };
  }
}
