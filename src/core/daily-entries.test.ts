import { describe, expect, it } from "vitest";
import {
  createTopic,
  FutureDailyEntryError,
  getDailyEntry,
  getToday,
  InvalidDailyEntryError,
  listDailyEntries,
  saveDailyEntry,
  setLearnerTimezone,
} from "@/core";
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
    expect(await getDailyEntry(ada, "2026-02-30")).toBeNull();
  });

  describe("at most one per date", () => {
    it("adding to today's entry later in the day updates it instead of starting another", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      const toolCalling = await createTopic(ada, { name: "Tool calling" });
      await saveDailyEntry(ada, {
        date: "2026-01-01",
        body: "Morning: cache invalidation",
        topics: [{ topicId: caching.id, confidence: 2 }],
      });

      core.clock.advance(6 * 60 * 60 * 1000);
      await saveDailyEntry(ada, {
        date: "2026-01-01",
        body: "Morning: cache invalidation\nAfternoon: tool calling",
        topics: [
          { topicId: caching.id, confidence: 3 },
          { topicId: toolCalling.id, confidence: 1 },
        ],
      });

      const entries = await listDailyEntries(ada);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        date: "2026-01-01",
        body: "Morning: cache invalidation\nAfternoon: tool calling",
        topics: [
          { topic: { name: "Caching" }, confidence: 3 },
          { topic: { name: "Tool calling" }, confidence: 1 },
        ],
      });
    });

    it("untagging a Topic removes it from the entry", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      await saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [{ topicId: caching.id, confidence: 2 }] });
      await saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [] });

      expect((await getDailyEntry(ada, "2026-01-01"))?.topics).toEqual([]);
    });

    it("lets two Learners each write an entry for the same date", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      await saveDailyEntry(ada, { date: "2026-01-01", body: "Ada's day", topics: [] });
      await saveDailyEntry(grace, { date: "2026-01-01", body: "Grace's day", topics: [] });

      expect(await getDailyEntry(ada, "2026-01-01")).toMatchObject({ body: "Ada's day" });
      expect(await getDailyEntry(grace, "2026-01-01")).toMatchObject({ body: "Grace's day" });
    });
  });

  describe("dates", () => {
    it("backfills a past date", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await saveDailyEntry(ada, { date: "2025-06-01", body: "Forgot to log this", topics: [] });

      expect(await getDailyEntry(ada, "2025-06-01")).toMatchObject({ body: "Forgot to log this" });
    });

    it("rejects a future date, and writes nothing", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(saveDailyEntry(ada, { date: "2026-01-02", body: "Tomorrow", topics: [] })).rejects.toBeInstanceOf(
        FutureDailyEntryError,
      );
      expect(await listDailyEntries(ada)).toEqual([]);
    });

    it("decides what today is in the Learner's own timezone", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      // 05:00 UTC on 1 January is still 31 December in Los Angeles, and already 1 January in Auckland.
      core.clock.set("2026-01-01T05:00:00Z");

      await setLearnerTimezone(ada, "America/Los_Angeles");
      expect(await getToday(ada)).toBe("2025-12-31");
      await expect(saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [] })).rejects.toBeInstanceOf(
        FutureDailyEntryError,
      );

      await setLearnerTimezone(ada, "Pacific/Auckland");
      expect(await getToday(ada)).toBe("2026-01-01");
      await expect(saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [] })).resolves.toMatchObject({
        date: "2026-01-01",
      });
    });

    it.each(["2026-02-30", "2026-1-1", "yesterday", ""])("rejects %j, which isn't a calendar date", async (date) => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(saveDailyEntry(ada, { date, body: "x", topics: [] })).rejects.toBeInstanceOf(
        InvalidDailyEntryError,
      );
    });
  });

  describe("browsing by date", () => {
    it("lists the Learner's Daily Entries newest date first, whatever order they were written in", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      for (const date of ["2025-12-30", "2026-01-01", "2025-12-31"]) {
        await saveDailyEntry(ada, { date, body: `Studied on ${date}`, topics: [] });
      }

      expect((await listDailyEntries(ada)).map((e) => e.date)).toEqual(["2026-01-01", "2025-12-31", "2025-12-30"]);
    });

    it("never shows another Learner's Daily Entries", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      await saveDailyEntry(ada, { date: "2026-01-01", body: "Ada's day", topics: [] });

      expect(await listDailyEntries(grace)).toEqual([]);
      expect(await getDailyEntry(grace, "2026-01-01")).toBeNull();
    });
  });
});
