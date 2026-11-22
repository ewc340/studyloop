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
});
