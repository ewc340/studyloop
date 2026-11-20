/** Runs once when the server starts. Startup work runs in the Node.js runtime only. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { onServerStart } = await import("./instrumentation-node");
    await onServerStart();
  }
}
