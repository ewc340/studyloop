import { expect, test } from "@playwright/test";

test("a signed-in Learner sees the home page and a healthy database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("signed-in-as")).toHaveText("Signed in as E2E Learner");
  await expect(page.getByTestId("health")).toContainText("Database: ok");
});

test.describe("without a session", () => {
  test.use({ extraHTTPHeaders: {} });

  test("visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  });
});
