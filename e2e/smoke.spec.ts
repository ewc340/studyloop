import { expect, test } from "@playwright/test";

test("home page renders and reaches the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "studyloop" })).toBeVisible();
  await expect(page.getByTestId("health")).toContainText("Database: ok");
});
