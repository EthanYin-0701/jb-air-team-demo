export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupConsoleLogger } = await import("./lib/console-logger");
    setupConsoleLogger();
  }
}
