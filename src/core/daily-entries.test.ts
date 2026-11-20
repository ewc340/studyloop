import { describe, expect, it } from "vitest";
import {
  createTopic,
  FutureDailyEntryError,
  getDailyEntry,
  getToday,
  getTopicPage,
  InvalidConfidenceError,
  InvalidDailyEntryError,
  listDailyEntries,
  saveDailyEntry,
  setLearnerTimezone,
  TopicNotFoundError,
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

  describe("Confidence", () => {
    it.each([0, 6, 2.5, -1, Number.NaN])("rejects %s, which isn't a whole number from 1 to 5", async (confidence) => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });

      await expect(
        saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [{ topicId: caching.id, confidence }] }),
      ).rejects.toBeInstanceOf(InvalidConfidenceError);
      expect(await listDailyEntries(ada)).toEqual([]);
    });

    it("accepts every rating from 1 to 5", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const topics = [];
      for (const name of ["A", "B", "C", "D", "E"]) topics.push(await createTopic(ada, { name }));

      const entry = await saveDailyEntry(ada, {
        date: "2026-01-01",
        body: "",
        topics: topics.map((t, i) => ({ topicId: t.id, confidence: i + 1 })),
      });
      expect(entry.topics.map((t) => t.confidence)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("tagging Topics", () => {
    it("can't tag another Learner's Topic", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      const gracesTopic = await createTopic(grace, { name: "Caching" });

      await expect(
        saveDailyEntry(ada, { date: "2026-01-01", body: "x", topics: [{ topicId: gracesTopic.id, confidence: 3 }] }),
      ).rejects.toBeInstanceOf(TopicNotFoundError);
      expect(await listDailyEntries(ada)).toEqual([]);
    });

    it("tags a Topic at most once, with one Confidence", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });

      await expect(
        saveDailyEntry(ada, {
          date: "2026-01-01",
          body: "x",
          topics: [
            { topicId: caching.id, confidence: 2 },
            { topicId: caching.id, confidence: 4 },
          ],
        }),
      ).rejects.toBeInstanceOf(InvalidDailyEntryError);
    });
  });

  describe("what was learned", () => {
    it("drops surrounding whitespace", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const entry = await saveDailyEntry(ada, { date: "2026-01-01", body: "  Read the RFC \n", topics: [] });
      expect(entry.body).toBe("Read the RFC");
    });

    it("may be left blank when a Topic is tagged", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      const entry = await saveDailyEntry(ada, {
        date: "2026-01-01",
        body: " ",
        topics: [{ topicId: caching.id, confidence: 3 }],
      });
      expect(entry.body).toBe("");
    });

    it("rejects an entry with nothing written and no Topics", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(saveDailyEntry(ada, { date: "2026-01-01", body: "  ", topics: [] })).rejects.toBeInstanceOf(
        InvalidDailyEntryError,
      );
    });
  });

  describe("on the Topic page", () => {
    it("shows the Daily Entries tagging the Topic on its timeline, oldest first", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      const toolCalling = await createTopic(ada, { name: "Tool calling" });
      await saveDailyEntry(ada, {
        date: "2026-01-01",
        body: "Write-through vs write-back",
        topics: [{ topicId: caching.id, confidence: 3 }],
      });
      await saveDailyEntry(ada, {
        date: "2025-12-31",
        body: "Cache keys",
        topics: [{ topicId: caching.id, confidence: 2 }],
      });
      await saveDailyEntry(ada, {
        date: "2025-12-30",
        body: "Only tool calling today",
        topics: [{ topicId: toolCalling.id, confidence: 4 }],
      });

      expect((await getTopicPage(ada, caching.id)).timeline).toEqual([
        {
          kind: "dailyEntry",
          occurredAt: new Date("2025-12-31T00:00:00Z"),
          date: "2025-12-31",
          body: "Cache keys",
          confidence: 2,
        },
        {
          kind: "dailyEntry",
          occurredAt: new Date("2026-01-01T00:00:00Z"),
          date: "2026-01-01",
          body: "Write-through vs write-back",
          confidence: 3,
        },
      ]);
    });

    it("places a Daily Entry on the timeline at the start of its date in the Learner's timezone", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await setLearnerTimezone(ada, "America/Los_Angeles");
      const caching = await createTopic(ada, { name: "Caching" });
      await saveDailyEntry(ada, { date: "2025-12-31", body: "", topics: [{ topicId: caching.id, confidence: 3 }] });

      const [entry] = (await getTopicPage(ada, caching.id)).timeline;
      expect(entry.occurredAt).toEqual(new Date("2025-12-31T08:00:00Z"));
    });

    it("shows the latest Confidence, from the most recent date, and its history oldest first", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      for (const [date, confidence] of [
        ["2025-12-20", 1],
        ["2026-01-01", 4],
        // Backfilled after the newer entry: history follows the dates, not the order they were written in.
        ["2025-12-25", 2],
      ] as const) {
        await saveDailyEntry(ada, { date, body: "", topics: [{ topicId: caching.id, confidence }] });
      }

      expect((await getTopicPage(ada, caching.id)).confidence).toEqual({
        latest: { date: "2026-01-01", confidence: 4 },
        history: [
          { date: "2025-12-20", confidence: 1 },
          { date: "2025-12-25", confidence: 2 },
          { date: "2026-01-01", confidence: 4 },
        ],
      });
    });

    it("re-rating a Topic in the same day's entry replaces that day's Confidence", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      await saveDailyEntry(ada, { date: "2026-01-01", body: "", topics: [{ topicId: caching.id, confidence: 2 }] });
      await saveDailyEntry(ada, { date: "2026-01-01", body: "", topics: [{ topicId: caching.id, confidence: 5 }] });

      expect((await getTopicPage(ada, caching.id)).confidence).toEqual({
        latest: { date: "2026-01-01", confidence: 5 },
        history: [{ date: "2026-01-01", confidence: 5 }],
      });
    });

    it("has no Confidence until a Daily Entry rates the Topic", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });
      expect((await getTopicPage(ada, caching.id)).confidence).toEqual({ latest: null, history: [] });
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
