import { expect, test, type Page } from "@playwright/test";

// A fresh Learner per test: tests share the e2e database, which also persists between local runs.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-e2e-learner": `e2e-job-search-${Date.now()}-${testInfo.testId}`.toLowerCase(),
  });
});

async function createCompany(page: Page, name: string, notes = "") {
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Notes").fill(notes);
  await page.getByRole("button", { name: "Create Company" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function createApplication(page: Page, role: string, appliedOn: string) {
  await page.getByRole("link", { name: "New Application" }).click();
  await page.getByLabel("Role").fill(role);
  await page.getByLabel("Applied on").fill(appliedOn);
  await page.getByRole("button", { name: "Create Application" }).click();
  await expect(page.getByRole("heading", { level: 1, name: role })).toBeVisible();
}

async function changeStatus(page: Page, status: string, on: string) {
  await page.getByLabel("New status").selectOption({ label: status });
  await page.getByLabel("On", { exact: true }).fill(on);
  await page.getByRole("button", { name: "Record status change" }).click();
}

test("a Learner records a Company and an Application, and follows its status changes on its timeline", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Companies" }).click();
  await expect(page.getByText("No Companies yet.")).toBeVisible();
  await page.getByRole("link", { name: "New Company" }).click();
  await page.getByLabel("Name").fill("Acme");
  await page.getByLabel("Notes").fill("Recruiter reached out on LinkedIn");
  await page.getByRole("button", { name: "Create Company" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Acme" })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Name").fill("Acme Robotics");
  await page.getByRole("button", { name: "Save Company" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Acme Robotics" })).toBeVisible();
  await expect(page.getByTestId("company-header")).toContainText("Recruiter reached out on LinkedIn");

  await page.getByRole("link", { name: "New Application" }).click();
  await page.getByLabel("Role").fill("Backend Engineer");
  await page.getByLabel("Applied on").fill("2025-11-01");
  await page.getByLabel("Source").fill("Referral from Sam");
  await page.getByLabel("Link").fill("https://jobs.example.test/acme/backend");
  await page.getByRole("button", { name: "Create Application" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Backend Engineer" })).toBeVisible();
  const header = page.getByTestId("application-header");
  await expect(header).toContainText("Acme Robotics");
  await expect(header).toContainText("Referral from Sam");
  await expect(header.getByRole("link", { name: "https://jobs.example.test/acme/backend" })).toBeVisible();
  const timeline = page.getByTestId("application-timeline").getByRole("listitem");
  await expect(timeline).toHaveText(["Applied1 Nov 2025"]);

  await changeStatus(page, "Interviewing", "2025-11-20");
  await expect(timeline).toHaveText(["Applied1 Nov 2025", "Interviewing20 Nov 2025"]);
  // Backfilled: the screening call came before the interviews.
  await changeStatus(page, "Screening", "2025-11-10");
  await expect(timeline).toHaveText(["Applied1 Nov 2025", "Screening10 Nov 2025", "Interviewing20 Nov 2025"]);
  await expect(header).toContainText("Interviewing");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Role").fill("Senior Backend Engineer");
  await page.getByRole("button", { name: "Save Application" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Senior Backend Engineer" })).toBeVisible();
  await expect(timeline).toHaveCount(3);

  await header.getByRole("link", { name: "Acme Robotics" }).click();
  await expect(page.getByTestId("company-applications")).toContainText("Senior Backend Engineer");
});

test("Applications are grouped by status and can be filtered by one", async ({ page }) => {
  await createCompany(page, "Globex");
  await createApplication(page, "SRE", "2025-10-01");
  await changeStatus(page, "Rejected", "2025-10-15");
  await expect(page.getByTestId("application-header")).toContainText("Rejected");
  await page.getByRole("link", { name: "Globex" }).click();
  await createApplication(page, "Platform Engineer", "2025-10-05");

  await page.goto("/applications");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Applied", "Rejected"]);
  await expect(page.getByTestId("applications-applied")).toContainText("Platform Engineer");
  await expect(page.getByTestId("applications-rejected")).toContainText("SRE");

  const filter = page.getByRole("navigation", { name: "Filter by status" });
  await filter.getByRole("link", { name: "Rejected 1" }).click();
  await expect(filter.getByRole("link", { name: "Rejected 1" })).toHaveAttribute("aria-current", "page");
  const list = page.getByTestId("application-list");
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list).toContainText("SRE");

  await filter.getByRole("link", { name: "Offer 0" }).click();
  await expect(page.getByText("No Applications with status Offer.")).toBeVisible();

  await filter.getByRole("link", { name: "All 2" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Applied", "Rejected"]);
});

test("a status change dated before the applied date is rejected", async ({ page }) => {
  await createCompany(page, "Initech");
  await createApplication(page, "Data Engineer", "2025-09-10");
  await changeStatus(page, "Screening", "2025-09-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "A status change can't be dated before the applied date" }),
  ).toBeVisible();
  await expect(page.getByTestId("application-timeline").getByRole("listitem")).toHaveCount(1);
});

test("an unknown Company or Application is not found", async ({ page }) => {
  // These pages stream, so the status is already sent by the time the record is looked up; check what's shown.
  await page.goto("/companies/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/applications/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
