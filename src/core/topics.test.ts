import { describe, expect, it } from "vitest";
import {
  createTopic,
  DuplicateTopicNameError,
  findOrCreateTopic,
  findTopics,
  getTopicPage,
  InvalidTopicError,
  topicId,
  TopicNotFoundError,
} from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

describe("Topics", () => {
  const core = useTestContext();

  it("creates a Topic with a name and description, shown on its Topic page", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const topic = await createTopic(ada, { name: "Caching", description: "HTTP and application caches" });

    const page = await getTopicPage(ada, topic.id);
    expect(page.topic).toMatchObject({ name: "Caching", description: "HTTP and application caches" });
  });

  describe("Topic page", () => {
    it("starts with an empty timeline", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const topic = await createTopic(ada, { name: "Caching" });
      expect((await getTopicPage(ada, topic.id)).timeline).toEqual([]);
    });

    it("is not found for another Learner's Topic", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      const topic = await createTopic(ada, { name: "Caching" });
      await expect(getTopicPage(grace, topic.id)).rejects.toBeInstanceOf(TopicNotFoundError);
    });

    it("is not found for an id that doesn't name a Topic", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(getTopicPage(ada, topicId("00000000-0000-4000-8000-000000000000"))).rejects.toBeInstanceOf(
        TopicNotFoundError,
      );
      await expect(getTopicPage(ada, topicId("not-a-uuid"))).rejects.toBeInstanceOf(TopicNotFoundError);
    });
  });

  it("needs only a name; surrounding whitespace is dropped", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const topic = await createTopic(ada, { name: "  Tool calling  ", description: "   " });
    expect(topic).toMatchObject({ name: "Tool calling", description: null });
  });

  it("rejects a blank name", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    await expect(createTopic(ada, { name: "   " })).rejects.toBeInstanceOf(InvalidTopicError);
  });

  describe("names are unique per Learner, ignoring case", () => {
    it("rejects a name the Learner already uses, in any case, naming the existing Topic", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching" });

      const attempt = createTopic(ada, { name: " CACHING " });
      await expect(attempt).rejects.toBeInstanceOf(DuplicateTopicNameError);
      await expect(attempt).rejects.toMatchObject({ existing: { id: caching.id, name: "Caching" } });
    });

    it("lets two Learners use the same name", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      await createTopic(ada, { name: "Caching" });
      await expect(createTopic(grace, { name: "caching" })).resolves.toMatchObject({ name: "caching" });
    });
  });

  describe("creating a Topic inline while tagging", () => {
    it("creates the Topic when the Learner has none by that name", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const topic = await findOrCreateTopic(ada, " Prompt caching ");
      expect(topic.name).toBe("Prompt caching");
      expect((await findTopics(ada)).map((t) => t.id)).toEqual([topic.id]);
    });

    it("returns the Learner's existing Topic with that name, in any case, instead of failing", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const caching = await createTopic(ada, { name: "Caching", description: "HTTP caches" });

      expect(await findOrCreateTopic(ada, "CACHING")).toEqual(caching);
      expect(await findTopics(ada)).toHaveLength(1);
    });

    it("still rejects a blank name", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(findOrCreateTopic(ada, "  ")).rejects.toBeInstanceOf(InvalidTopicError);
    });
  });

  describe("finding Topics by name", () => {
    async function names(...args: Parameters<typeof findTopics>) {
      return (await findTopics(...args)).map((t) => t.name);
    }

    it("lists all the Learner's Topics alphabetically, ignoring case", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      for (const name of ["caching", "Tool calling", "Agent harness"]) await createTopic(ada, { name });

      expect(await names(ada)).toEqual(["Agent harness", "caching", "Tool calling"]);
      expect(await names(ada, { query: "  " })).toEqual(["Agent harness", "caching", "Tool calling"]);
    });

    it("matches any part of the name, ignoring case", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      for (const name of ["Tool calling", "HTTP caching", "Agent harness"]) await createTopic(ada, { name });

      expect(await names(ada, { query: "CALL" })).toEqual(["Tool calling"]);
      expect(await names(ada, { query: "a" })).toEqual(["Agent harness", "HTTP caching", "Tool calling"]);
      expect(await names(ada, { query: "kubernetes" })).toEqual([]);
    });

    it("treats % and _ in the query as ordinary characters", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      for (const name of ["p99_latency", "p99 latency", "100% uptime"]) await createTopic(ada, { name });

      expect(await names(ada, { query: "_" })).toEqual(["p99_latency"]);
      expect(await names(ada, { query: "%" })).toEqual(["100% uptime"]);
    });

    it("never finds another Learner's Topics", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      await createTopic(ada, { name: "Caching" });

      expect(await names(grace)).toEqual([]);
      expect(await names(grace, { query: "cach" })).toEqual([]);
    });
  });
});
