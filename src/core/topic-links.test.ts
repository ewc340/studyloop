import { describe, expect, it } from "vitest";
import {
  createTopic,
  DuplicateTopicLinkError,
  getTopicPage,
  InvalidTopicLinkError,
  linkTopics,
  topicId,
  TopicNotFoundError,
  type LearnerContext,
  type TopicLinkType,
} from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

describe("Topic Links", () => {
  const core = useTestContext();

  async function topics(learner: LearnerContext, ...names: string[]) {
    return Promise.all(names.map((name) => createTopic(learner, { name })));
  }

  function names(neighbours: { topic: { name: string } }[]) {
    return neighbours.map((n) => n.topic.name);
  }

  it("a prerequisite link shows as a prerequisite on one Topic page and a dependent on the other", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const [http, caching] = await topics(ada, "HTTP", "Caching");

    await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });

    expect(names((await getTopicPage(ada, caching.id)).links.prerequisites)).toEqual(["HTTP"]);
    expect(names((await getTopicPage(ada, http.id)).links.dependents)).toEqual(["Caching"]);
  });

  it("a part-of link shows as a part on the whole's page and a parent on the part's page", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const [harness, toolCalling] = await topics(ada, "Agent harness", "Tool calling");

    await linkTopics(ada, { from: toolCalling.id, type: "part_of", to: harness.id });

    expect(names((await getTopicPage(ada, harness.id)).links.parts)).toEqual(["Tool calling"]);
    expect(names((await getTopicPage(ada, toolCalling.id)).links.parents)).toEqual(["Agent harness"]);
  });

  it("a related-to link shows as related on both Topic pages", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const [caching, cdn] = await topics(ada, "Caching", "CDN");

    await linkTopics(ada, { from: caching.id, type: "related_to", to: cdn.id });

    expect(names((await getTopicPage(ada, caching.id)).links.related)).toEqual(["CDN"]);
    expect(names((await getTopicPage(ada, cdn.id)).links.related)).toEqual(["Caching"]);
  });

  it("groups each Topic's neighbours by link type and direction, each group by name", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const [caching, http, tcp, redis, cdn, systemDesign, memoisation] = await topics(
      ada,
      "Caching",
      "HTTP",
      "TCP",
      "redis",
      "CDN",
      "System design",
      "Memoisation",
    );
    await linkTopics(ada, { from: tcp.id, type: "prerequisite_of", to: caching.id });
    await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
    await linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: cdn.id });
    await linkTopics(ada, { from: redis.id, type: "part_of", to: caching.id });
    await linkTopics(ada, { from: caching.id, type: "part_of", to: systemDesign.id });
    await linkTopics(ada, { from: memoisation.id, type: "related_to", to: caching.id });
    await linkTopics(ada, { from: caching.id, type: "related_to", to: cdn.id });

    const { links } = await getTopicPage(ada, caching.id);
    expect({
      prerequisites: names(links.prerequisites),
      dependents: names(links.dependents),
      parts: names(links.parts),
      parents: names(links.parents),
      related: names(links.related),
    }).toEqual({
      prerequisites: ["HTTP", "TCP"],
      dependents: ["CDN"],
      parts: ["redis"],
      parents: ["System design"],
      related: ["CDN", "Memoisation"],
    });
  });

  describe("rejected links", () => {
    it("rejects linking a Topic to itself", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [caching] = await topics(ada, "Caching");

      for (const type of ["prerequisite_of", "part_of", "related_to"] as const) {
        const attempt = linkTopics(ada, { from: caching.id, type, to: caching.id });
        await expect(attempt).rejects.toBeInstanceOf(InvalidTopicLinkError);
        await expect(attempt).rejects.toThrow("A Topic can't be linked to itself");
      }
    });

    it("rejects a link that already exists, with a message naming it", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [http, caching] = await topics(ada, "HTTP", "Caching");
      await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
      await linkTopics(ada, { from: http.id, type: "part_of", to: caching.id });

      const prerequisite = linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
      await expect(prerequisite).rejects.toBeInstanceOf(DuplicateTopicLinkError);
      await expect(prerequisite).rejects.toThrow('"HTTP" is already a prerequisite of "Caching"');
      await expect(linkTopics(ada, { from: http.id, type: "part_of", to: caching.id })).rejects.toThrow(
        '"HTTP" is already part of "Caching"',
      );
    });

    it("rejects relating two Topics that are already related, whichever way round", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [caching, cdn] = await topics(ada, "Caching", "CDN");
      await linkTopics(ada, { from: caching.id, type: "related_to", to: cdn.id });

      for (const [from, to] of [
        [caching, cdn],
        [cdn, caching],
      ]) {
        const attempt = linkTopics(ada, { from: from.id, type: "related_to", to: to.id });
        await expect(attempt).rejects.toBeInstanceOf(DuplicateTopicLinkError);
        await expect(attempt).rejects.toThrow(`"${from.name}" is already related to "${to.name}"`);
      }
      expect(names((await getTopicPage(ada, caching.id)).links.related)).toEqual(["CDN"]);
    });

    it("rejects linking another Learner's Topic, or one that doesn't exist", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      const [caching] = await topics(ada, "Caching");
      const [http] = await topics(grace, "HTTP");

      await expect(linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id })).rejects.toBeInstanceOf(
        TopicNotFoundError,
      );
      await expect(linkTopics(ada, { from: caching.id, type: "related_to", to: http.id })).rejects.toBeInstanceOf(
        TopicNotFoundError,
      );
      await expect(
        linkTopics(ada, { from: caching.id, type: "related_to", to: topicId("not-a-uuid") }),
      ).rejects.toBeInstanceOf(TopicNotFoundError);
      expect((await getTopicPage(grace, http.id)).links.related).toEqual([]);
    });

    it("rejects an unknown link type", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [http, caching] = await topics(ada, "HTTP", "Caching");
      const type = "depends_on" as TopicLinkType;
      await expect(linkTopics(ada, { from: http.id, type, to: caching.id })).rejects.toBeInstanceOf(
        InvalidTopicLinkError,
      );
    });
  });
});
