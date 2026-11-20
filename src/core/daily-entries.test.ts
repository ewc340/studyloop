import { describe, expect, it } from "vitest";
import { createTopic, getDailyEntry, saveDailyEntry } from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

describe("Daily Entries", () => {
  const core = useTestContext();

  it("writes today's Daily Entry with what was learned and tagged Topics, each with a Confidence", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const caching = await createTopic(ada, { name: "Caching" });
    const toolCalling = await createTopic(ada, { name: "Tool calling" });

    await saveDailyEntry(ada, {
      date: "2026-01-01",
      body: "Read about cache invalidation",
      topics: [
        { topicId: toolCalling.id, confidence: 2 },
        { topicId: caching.id, confidence: 4 },
      ],
    });

    expect(await getDailyEntry(ada, "2026-01-01")).toMatchObject({
      date: "2026-01-01",
      body: "Read about cache invalidation",
      topics: [
        { topic: { id: caching.id, name: "Caching" }, confidence: 4 },
        { topic: { id: toolCalling.id, name: "Tool calling" }, confidence: 2 },
      ],
    });
  });

  it("has no Daily Entry for a date nothing was written on", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    expect(await getDailyEntry(ada, "2026-01-01")).toBeNull();
  });
});
