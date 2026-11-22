import { expect, test, type Page } from "@playwright/test";

// A fresh Learner per test: tests share the e2e database, which also persists between local runs.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-e2e-learner": `e2e-topic-links-${Date.now()}-${testInfo.testId}`.toLowerCase(),
  });
});

// Locators go through roles: the router keeps the previous Topic page mounted but hidden, and role
// queries skip hidden elements.

async function createTopic(page: Page, name: string) {
  await page.goto(`/topics?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: `Create “${name}”` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function openTopic(page: Page, name: string) {
  await page.goto(`/topics?q=${encodeURIComponent(name)}`);
  await page.getByTestId("topic-list").getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

function linkedTopics(page: Page) {
  return page.getByRole("region", { name: "Linked Topics" });
}

/** The open Topic page's links to its neighbours in one group, e.g. "Prerequisites". */
function linked(page: Page, group: string) {
  return linkedTopics(page).getByRole("region", { name: group, exact: true }).getByRole("link");
}

function addLinkForm(page: Page) {
  return page.getByRole("form", { name: "Add a link" });
}

/** On the open Topic page, links it to `other` with the given link type, e.g. "Has prerequisite". */
async function addLink(page: Page, linkType: string, other: string) {
  const form = addLinkForm(page);
  await form.getByRole("combobox", { name: "Link type" }).selectOption({ label: linkType });
  await form.getByRole("combobox", { name: "Linked Topic" }).fill(other);
  await form.getByRole("option", { name: other, exact: true }).click();
  await expect(form.getByRole("list", { name: "Selected Linked Topic" })).toHaveText(`${other}×`);
  await form.getByRole("button", { name: "Add link" }).click();
}

test("a Learner links Topics of each type, navigates between them and removes a link", async ({ page }) => {
  for (const name of ["Caching", "HTTP", "CDN", "System design", "Redis"]) await createTopic(page, name);
  // The last Topic created is open: Redis.
  await addLink(page, "Is part of", "Caching");
  await expect(linked(page, "Part of")).toHaveText(["Caching"]);

  await linked(page, "Part of").getByText("Caching").click();
  await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();
  await expect(linked(page, "Parts")).toHaveText(["Redis"]);

  await addLink(page, "Has prerequisite", "HTTP");
  await expect(linked(page, "Prerequisites")).toHaveText(["HTTP"]);
  await addLink(page, "Is a prerequisite of", "CDN");
  await expect(linked(page, "Prerequisite of")).toHaveText(["CDN"]);
  await addLink(page, "Is part of", "System design");
  await expect(linked(page, "Part of")).toHaveText(["System design"]);
  await addLink(page, "Is related to", "CDN");
  await expect(linked(page, "Related")).toHaveText(["CDN"]);
  // The picked Topic is cleared once linked.
  await expect(addLinkForm(page).getByRole("list", { name: "Selected Linked Topic" })).toHaveCount(0);

  await linked(page, "Prerequisites").getByText("HTTP").click();
  await expect(page.getByRole("heading", { level: 1, name: "HTTP" })).toBeVisible();
  await expect(linked(page, "Prerequisite of")).toHaveText(["Caching"]);

  await linkedTopics(page).getByRole("button", { name: "Remove link to Caching" }).click();
  await expect(linkedTopics(page)).toContainText("No linked Topics yet.");
  await openTopic(page, "Caching");
  await expect(linked(page, "Prerequisites")).toHaveCount(0);
  await expect(linked(page, "Prerequisite of")).toHaveText(["CDN"]);
});

test("a link that would form a cycle, or already exists, is rejected with a clear message", async ({ page }) => {
  for (const name of ["TCP", "HTTP", "Caching"]) await createTopic(page, name);
  // Caching is open.
  await addLink(page, "Has prerequisite", "HTTP");
  await expect(linked(page, "Prerequisites")).toHaveText(["HTTP"]);
  await openTopic(page, "HTTP");
  await addLink(page, "Has prerequisite", "TCP");
  await expect(linked(page, "Prerequisites")).toHaveText(["TCP"]);

  await openTopic(page, "TCP");
  await addLink(page, "Has prerequisite", "Caching");
  const form = addLinkForm(page);
  await expect(form.getByRole("alert")).toHaveText(
    '"Caching" can\'t be a prerequisite of "TCP": that would form a cycle (Caching → TCP → HTTP → Caching)',
  );
  await expect(linked(page, "Prerequisites")).toHaveCount(0);
  // The rejected link stays filled in, to fix and retry.
  await expect(form.getByRole("combobox", { name: "Link type" })).toHaveValue("prerequisite_of:in");
  await expect(form.getByRole("list", { name: "Selected Linked Topic" })).toHaveText("Caching×");

  await addLink(page, "Is a prerequisite of", "HTTP");
  await expect(form.getByRole("alert")).toHaveText('"TCP" is already a prerequisite of "HTTP"');
});
