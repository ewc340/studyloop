import { expect, test } from "@playwright/test";

// A fresh Learner per test: tests share the e2e database, which also persists between local runs.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({ "x-e2e-learner": `e2e-topics-${Date.now()}-${testInfo.testId}`.toLowerCase() });
});

test("a Learner creates Topics, finds one by name and opens its Topic page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Topics" }).click();
  await expect(page.getByText("No Topics yet.")).toBeVisible();

  for (const [name, description] of [
    ["Caching", "HTTP and application caches"],
    ["Tool calling", ""],
  ]) {
    await page.getByRole("link", { name: "New Topic" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description").fill(description);
    await page.getByRole("button", { name: "Create Topic" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByRole("link", { name: "← Topics" }).click();
  }

  await page.getByLabel("Search Topics").fill("cach");
  await page.getByRole("button", { name: "Search" }).click();
  const list = page.getByTestId("topic-list");
  await expect(list.getByRole("link")).toHaveCount(1);
  await list.getByRole("link", { name: /Caching/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();
  await expect(page.getByTestId("topic-header")).toContainText("HTTP and application caches");
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByTestId("timeline-empty")).toBeVisible();
});

test("a Topic name already in use, in any case, is rejected", async ({ page }) => {
  await page.goto("/topics/new");
  await page.getByLabel("Name").fill("Caching");
  await page.getByRole("button", { name: "Create Topic" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();

  await page.goto("/topics/new");
  await page.getByLabel("Name").fill("caching");
  await page.getByRole("button", { name: "Create Topic" }).click();
  await expect(page.getByText('A Topic named "Caching" already exists')).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("caching");
});

test("searching for a missing Topic offers to create it", async ({ page }) => {
  await page.goto("/topics?q=Agent%20harness");
  await page.getByRole("button", { name: "Create “Agent harness”" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agent harness" })).toBeVisible();
});

test("an unknown Topic is not found", async ({ page }) => {
  // The page streams, so the status is already sent by the time the Topic is looked up; check what's shown.
  await page.goto("/topics/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
