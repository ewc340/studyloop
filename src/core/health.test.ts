import { describe, expect, it } from "vitest";
import { getHealth } from "@/core";
import { useTestContext } from "@/test/core-harness";

describe("getHealth", () => {
  const core = useTestContext();

  it("reports the database reachable and migrations applied", async () => {
    const health = await getHealth(core.ctx);
    expect(health.database).toBe("ok");
    expect(health.migrationsApplied).toBeGreaterThanOrEqual(1);
  });

  it("stamps the check with the injected clock", async () => {
    core.clock.set("2026-03-04T05:06:07Z");
    const health = await getHealth(core.ctx);
    expect(health.checkedAt.toISOString()).toBe("2026-03-04T05:06:07.000Z");
  });
});
