import { describe, expect, it } from "vitest";
import { E2E_PORT, instancePort } from "./ports";

const allFree = async () => true;

describe("a QA instance's port", () => {
  it("is 3000 plus the PR number", async () => {
    expect(await instancePort(31, { isFree: allFree })).toBe(3031);
  });

  it("is the next free port when that one is taken", async () => {
    const isFree = async (port: number) => port !== 3031 && port !== 3032;
    expect(await instancePort(31, { isFree })).toBe(3033);
  });

  it("never takes the e2e and screenshot server's port, so they can't silently test a QA instance", async () => {
    expect(E2E_PORT).toBe(3100);
    expect(await instancePort(100, { isFree: allFree })).toBe(3101);
    expect(await instancePort(99, { isFree: async (port) => port !== 3099 })).toBe(3101);
  });

  it("skips ports other instances hold, even while their servers are stopped", async () => {
    expect(await instancePort(31, { isFree: allFree, reserved: [3031, 3032] })).toBe(3033);
  });

  it("keeps the instance's previous port when it's still free", async () => {
    expect(await instancePort(31, { isFree: allFree, previous: 3040 })).toBe(3040);
    expect(await instancePort(31, { isFree: async (port) => port !== 3040, previous: 3040 })).toBe(3031);
  });
});
