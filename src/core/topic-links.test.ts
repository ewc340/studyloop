import { describe, expect, it } from "vitest";
import {
  createTopic,
  DuplicateTopicLinkError,
  getTopicPage,
  InvalidTopicLinkError,
  linkTopics,
  topicId,
  TopicLinkCycleError,
  topicLinkId,
  TopicLinkNotFoundError,
  unlinkTopics,
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

  describe("removing a link", () => {
    it("removes it from both Topic pages, and the Topics can be linked again", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [http, caching, tcp] = await topics(ada, "HTTP", "Caching", "TCP");
      const link = await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
      await linkTopics(ada, { from: tcp.id, type: "prerequisite_of", to: caching.id });

      await unlinkTopics(ada, link.id);

      expect(names((await getTopicPage(ada, caching.id)).links.prerequisites)).toEqual(["TCP"]);
      expect((await getTopicPage(ada, http.id)).links.dependents).toEqual([]);
      await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
    });

    it("removes the link named on a Topic page", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [caching, cdn] = await topics(ada, "Caching", "CDN");
      await linkTopics(ada, { from: cdn.id, type: "related_to", to: caching.id });

      const [related] = (await getTopicPage(ada, caching.id)).links.related;
      await unlinkTopics(ada, related.linkId);

      expect((await getTopicPage(ada, cdn.id)).links.related).toEqual([]);
    });

    it("unblocks a link that would have formed a cycle through it", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const [tcp, http, caching] = await topics(ada, "TCP", "HTTP", "Caching");
      await linkTopics(ada, { from: tcp.id, type: "prerequisite_of", to: http.id });
      const middle = await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
      await expect(linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: tcp.id })).rejects.toBeInstanceOf(
        TopicLinkCycleError,
      );

      await unlinkTopics(ada, middle.id);

      await linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: tcp.id });
      expect(names((await getTopicPage(ada, tcp.id)).links.prerequisites)).toEqual(["Caching"]);
    });

    it("is not found for another Learner's link, an already removed one, or an id that names none", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      const [http, caching] = await topics(ada, "HTTP", "Caching");
      const link = await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });

      await expect(unlinkTopics(grace, link.id)).rejects.toBeInstanceOf(TopicLinkNotFoundError);
      expect(names((await getTopicPage(ada, caching.id)).links.prerequisites)).toEqual(["HTTP"]);

      await unlinkTopics(ada, link.id);
      await expect(unlinkTopics(ada, link.id)).rejects.toBeInstanceOf(TopicLinkNotFoundError);
      await expect(unlinkTopics(ada, topicLinkId("not-a-uuid"))).rejects.toBeInstanceOf(TopicLinkNotFoundError);
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

    describe("cycles", () => {
      it("rejects a prerequisite that would make two Topics each other's prerequisite", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [http, caching] = await topics(ada, "HTTP", "Caching");
        await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });

        const attempt = linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: http.id });
        await expect(attempt).rejects.toBeInstanceOf(TopicLinkCycleError);
        await expect(attempt).rejects.toThrow(
          '"Caching" can\'t be a prerequisite of "HTTP": that would form a cycle (Caching → HTTP → Caching)',
        );
        expect((await getTopicPage(ada, caching.id)).links.dependents).toEqual([]);
      });

      it("rejects a prerequisite that would close a cycle across a multi-hop chain, naming the whole cycle", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [tcp, http, caching, cdn] = await topics(ada, "TCP", "HTTP", "Caching", "CDN");
        await linkTopics(ada, { from: tcp.id, type: "prerequisite_of", to: http.id });
        await linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id });
        await linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: cdn.id });

        const attempt = linkTopics(ada, { from: cdn.id, type: "prerequisite_of", to: tcp.id });
        await expect(attempt).rejects.toBeInstanceOf(TopicLinkCycleError);
        await expect(attempt).rejects.toThrow("(CDN → TCP → HTTP → Caching → CDN)");
        await expect(
          linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: http.id }),
        ).rejects.toBeInstanceOf(TopicLinkCycleError);
      });

      it("finds a cycle through any branch of the graph", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [a, b, c, d, e] = await topics(ada, "A", "B", "C", "D", "E");
        // A → B, A → C → D → E: only the C branch leads back from E to A.
        await linkTopics(ada, { from: a.id, type: "prerequisite_of", to: b.id });
        await linkTopics(ada, { from: a.id, type: "prerequisite_of", to: c.id });
        await linkTopics(ada, { from: c.id, type: "prerequisite_of", to: d.id });
        await linkTopics(ada, { from: d.id, type: "prerequisite_of", to: e.id });

        await expect(linkTopics(ada, { from: e.id, type: "prerequisite_of", to: a.id })).rejects.toThrow(
          "(E → A → C → D → E)",
        );
      });

      it("rejects a part-of link that would form a cycle, with a message in part-of terms", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [harness, toolCalling, schemas] = await topics(ada, "Agent harness", "Tool calling", "JSON schemas");
        await linkTopics(ada, { from: schemas.id, type: "part_of", to: toolCalling.id });
        await linkTopics(ada, { from: toolCalling.id, type: "part_of", to: harness.id });

        const attempt = linkTopics(ada, { from: harness.id, type: "part_of", to: schemas.id });
        await expect(attempt).rejects.toBeInstanceOf(TopicLinkCycleError);
        await expect(attempt).rejects.toThrow(
          '"Agent harness" can\'t be part of "JSON schemas": that would form a cycle (Agent harness → JSON schemas → Tool calling → Agent harness)',
        );
      });

      it("allows chains that don't loop back, and loops made of different link types", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [a, b, c] = await topics(ada, "A", "B", "C");
        await linkTopics(ada, { from: a.id, type: "prerequisite_of", to: b.id });
        await linkTopics(ada, { from: b.id, type: "prerequisite_of", to: c.id });
        // A diamond is not a cycle.
        await linkTopics(ada, { from: a.id, type: "prerequisite_of", to: c.id });
        // Only links of one type count towards a cycle.
        await linkTopics(ada, { from: c.id, type: "part_of", to: a.id });
        await linkTopics(ada, { from: b.id, type: "part_of", to: c.id });
        // Related-to links never form cycles.
        await linkTopics(ada, { from: c.id, type: "related_to", to: a.id });
        await linkTopics(ada, { from: b.id, type: "related_to", to: a.id });
        await linkTopics(ada, { from: c.id, type: "related_to", to: b.id });

        expect(names((await getTopicPage(ada, c.id)).links.prerequisites)).toEqual(["A", "B"]);
      });

      it("lets only one of two opposite prerequisites made at the same time through", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const [http, caching] = await topics(ada, "HTTP", "Caching");

        const results = await Promise.allSettled([
          linkTopics(ada, { from: http.id, type: "prerequisite_of", to: caching.id }),
          linkTopics(ada, { from: caching.id, type: "prerequisite_of", to: http.id }),
        ]);

        expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
        const rejected = results.find((r) => r.status === "rejected");
        expect(rejected?.reason).toBeInstanceOf(TopicLinkCycleError);
      });

      it("ignores other Learners' links", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const grace = await actingAsNewLearner(core.ctx);
        const [adaHttp, adaCaching] = await topics(ada, "HTTP", "Caching");
        const [graceHttp, graceCaching] = await topics(grace, "HTTP", "Caching");
        await linkTopics(ada, { from: adaHttp.id, type: "prerequisite_of", to: adaCaching.id });

        await linkTopics(grace, { from: graceCaching.id, type: "prerequisite_of", to: graceHttp.id });
        expect(names((await getTopicPage(grace, graceHttp.id)).links.prerequisites)).toEqual(["Caching"]);
      });
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
