import { describe, expect, it } from "vitest";
import { createTopic, DuplicateTopicNameError, getTopicPage, InvalidTopicError } from "@/core";
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
});
