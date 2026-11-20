import { expect, test, type Page } from "@playwright/test";

// A fresh Learner per test: tests share the e2e database, which also persists between local runs.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({ "x-e2e-learner": `e2e-entries-${Date.now()}-${testInfo.testId}`.toLowerCase() });
});

async function tagTopic(page: Page, name: string, confidence: number) {
  await page.getByRole("combobox", { name: "Topics" }).fill(name);
  await page.getByRole("option", { name: new RegExp(`^(Create “)?${name}”?$`) }).click();
  await rateConfidence(page, name, confidence);
}

async function rateConfidence(page: Page, topicName: string, confidence: number) {
  const group = page.getByRole("group", { name: `Confidence in ${topicName}` });
  await group.locator("label", { hasText: new RegExp(`^${confidence}$`) }).click();
  await expect(group.getByRole("radio", { name: String(confidence) })).toBeChecked();
}

test("a Learner writes today's Daily Entry, then adds to it later without starting another", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Daily Entries" }).click();
  await expect(page.getByText("No Daily Entries yet.")).toBeVisible();

  await page.getByRole("link", { name: "Write today’s entry" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Today/ })).toBeVisible();
  await page.getByLabel("What did you work on and learn?").fill("Cache invalidation strategies");
  await tagTopic(page, "Caching", 2);
  await page.getByRole("button", { name: "Save Daily Entry" }).click();

  const list = page.getByTestId("entry-list");
  await expect(list.getByRole("listitem").filter({ hasText: "Cache invalidation strategies" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Caching Confidence 2/5" })).toBeVisible();

  await page.getByRole("link", { name: "Add to today’s entry" }).click();
  const body = page.getByLabel("What did you work on and learn?");
  await expect(body).toHaveValue("Cache invalidation strategies");
  await body.fill("Cache invalidation strategies\nThen: CDN edge caching");
  await rateConfidence(page, "Caching", 3);
  await page.getByRole("button", { name: "Save Daily Entry" }).click();

  await expect(list.getByRole("link", { name: "Caching Confidence 3/5" })).toBeVisible();
  await expect(list.locator(":scope > li")).toHaveCount(1);
  await expect(list).toContainText("Then: CDN edge caching");
});

test("backfilled Daily Entries show on the Topic page with the Topic's Confidence history", async ({ page }) => {
  for (const [date, heading, body, confidence] of [
    ["2025-03-14", "Fri, 14 Mar 2025", "Read about write-back caches", 4],
    ["2025-03-10", "Mon, 10 Mar 2025", "First look at cache keys", 2],
  ] as const) {
    await page.goto("/entries");
    await page.getByLabel("Another date").fill(date);
    await page.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.getByLabel("What did you work on and learn?").fill(body);
    await tagTopic(page, "Caching", confidence);
    await page.getByRole("button", { name: "Save Daily Entry" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Daily Entries" })).toBeVisible();
  }

  // Newest date first, whatever order they were written in.
  const dates = page.getByTestId("entry-list").locator(":scope > li > a");
  await expect(dates).toHaveText(["Fri, 14 Mar 2025", "Mon, 10 Mar 2025"]);

  await page.getByRole("link", { name: "Caching Confidence 4/5" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible();
  await expect(page.getByTestId("latest-confidence")).toHaveText("4/5on Fri, 14 Mar 2025");
  await expect(page.getByTestId("confidence-history").locator("tbody tr")).toHaveText([
    "Fri, 14 Mar 20254/5",
    "Mon, 10 Mar 20252/5",
  ]);

  const timeline = page.getByRole("region", { name: "Timeline" }).getByRole("listitem");
  await expect(timeline).toHaveCount(2);
  await expect(timeline.nth(0)).toContainText("Mon, 10 Mar 2025 · Confidence 2/5");
  await expect(timeline.nth(0)).toContainText("First look at cache keys");
  await expect(timeline.nth(1)).toContainText("Fri, 14 Mar 2025 · Confidence 4/5");
});

test("a Daily Entry can't be written for a future date", async ({ page }) => {
  await page.goto("/entries/2999-01-01");
  await expect(page.getByText("This date hasn’t happened yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Daily Entry" })).toHaveCount(0);
});
