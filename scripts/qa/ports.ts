import net from "node:net";

/** The fixed port of the e2e and agent-screenshot server (playwright.config.ts, ralph/screenshots.ts). */
export const E2E_PORT = 3100;

const BASE_PORT = 3000;
const MAX_PORT = 65535;

export interface PortChoice {
  isFree: (port: number) => Promise<boolean>;
  /** Ports other QA instances hold, even while their servers are stopped. */
  reserved?: number[];
  /** This instance's port from an earlier run, kept when it's still free. */
  previous?: number;
}

/**
 * The port for PR `pr`'s QA instance: its previous port if still free, else 3000 + PR number or the
 * next free port above it. Never the e2e port: e2e and screenshots reuse a server already listening
 * there, so a QA instance on it would be tested in their place.
 */
export async function instancePort(pr: number, { isFree, reserved = [], previous }: PortChoice): Promise<number> {
  const usable = async (port: number) => port !== E2E_PORT && !reserved.includes(port) && (await isFree(port));
  if (previous !== undefined && (await usable(previous))) return previous;
  for (let port = BASE_PORT + pr; port <= MAX_PORT; port++) {
    if (await usable(port)) return port;
  }
  throw new Error(`No free port for PR #${pr}`);
}

/** Whether nothing is listening on `port` (on any interface). */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}
