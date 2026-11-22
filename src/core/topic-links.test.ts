import { describe, expect, it } from "vitest";
import { createTopic, getTopicPage, linkTopics, type LearnerContext } from "@/core";
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
});
