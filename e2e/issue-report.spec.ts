import { expect, test, type Page } from "@playwright/test";

// The owner as configured for the e2e server (ISSUE_REPORTING_OWNER_EMAIL in playwright.config.ts),
// which also swaps GitHub for an in-memory issue tracker.
const OWNER = "e2e-owner";

test.describe("as the owner", () => {
  test.use({ extraHTTPHeaders: { "x-e2e-learner": OWNER } });

  test("reports a bug from a Topic page with private content masked, and gets a link to the issue", async ({
    page,
  }) => {
    const topicName = `Private topic ${Date.now()}`;
    await page.goto("/topics/new");
    await page.getByLabel("Name").fill(topicName);
    await page.getByLabel("Description").fill("Notes nobody else should read");
    await page.getByRole("button", { name: "Create Topic" }).click();
    await expect(page.getByRole("heading", { level: 1, name: topicName })).toBeVisible();

    await page.getByRole("button", { name: "Report issue" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Report an issue" })).toBeVisible();

    const capture = sheet.getByRole("img", { name: "Capture of this page, private content masked" });
    await expect(capture).toBeVisible();
    const masking = await maskingOf(page, "Timeline");
    expect(masking.privateElements).toBeGreaterThanOrEqual(2);
    expect(masking.unmaskedPrivateElements).toEqual([]);
    expect(masking.publicTextVisible).toBe(true);

    // A screenshot the owner took on their phone, which isn't masked.
    const phoneScreenshot = await page.screenshot();
    await sheet.getByLabel("Description").fill("Timeline is empty after creating a Topic\n\nExpected a hint.");
    await sheet.getByLabel("Attach images").setInputFiles({
      name: "phone.png",
      mimeType: "image/png",
      buffer: phoneScreenshot,
    });
    await expect(sheet.getByRole("img", { name: "Attachment 1" })).toBeVisible();
    await sheet.getByRole("button", { name: "Preview" }).click();

    await expect(sheet).toContainText("This will be public.");
    await expect(sheet).toContainText("Attached images are not masked.");
    const preview = sheet.getByTestId("issue-preview");
    await expect(preview).toContainText("Timeline is empty after creating a Topic");
    await expect(preview.getByRole("list", { name: "Labels" })).toHaveText(["needs-triage", "bug"].join(""));
    await expect(preview).toContainText("![Page capture](uploaded when you submit)");
    await expect(preview).toContainText("![Attachment 1](uploaded when you submit)");
    await expect(preview).toContainText("| Route | `/topics/[id]` |");
    await expect(preview).toContainText("(phone)");
    await expect(preview).not.toContainText(topicName);

    await sheet.getByRole("button", { name: "Submit issue" }).click();
    const link = sheet.getByRole("link", { name: /^issue #\d+$/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^https:\/\/issue-tracker\.test\/issues\/\d+$/);
  });

  test("the capture of the Topics list masks names, descriptions and the search box", async ({ page }) => {
    const topicName = `Searchable topic ${Date.now()}`;
    await page.goto("/topics/new");
    await page.getByLabel("Name").fill(topicName);
    await page.getByLabel("Description").fill("Private description");
    await page.getByRole("button", { name: "Create Topic" }).click();
    await expect(page.getByRole("heading", { level: 1, name: topicName })).toBeVisible();

    await page.goto(`/topics?q=${encodeURIComponent(topicName)}`);
    await expect(page.getByTestId("topic-list")).toContainText(topicName);
    await page.getByRole("button", { name: "Report issue" }).click();
    await expect(page.getByRole("img", { name: "Capture of this page, private content masked" })).toBeVisible();

    const masking = await maskingOf(page, "Topics");
    // The search box, and the Topic's name and description.
    expect(masking.privateElements).toBe(3);
    expect(masking.unmaskedPrivateElements).toEqual([]);
    expect(masking.publicTextVisible).toBe(true);
  });

  test("a report without a description isn't sent", async ({ page }) => {
    await page.goto("/topics");
    await page.getByRole("button", { name: "Report issue" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Preview" }).click();
    await expect(sheet.getByLabel("Description")).toBeFocused();
    await expect(sheet.getByTestId("issue-preview")).toHaveCount(0);
  });
});

test("other Learners don't see the Report issue control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
  await expect(page.getByRole("button", { name: "Report issue" })).toHaveCount(0);
});

/**
 * Compares the page capture with the live page: every private element's area in the capture must be
 * solid mask colour, and some public text must still show (so the check can fail).
 */
async function maskingOf(page: Page, publicHeadingText: string) {
  return page.evaluate(async (headingText) => {
    const MASK = [0xa1, 0xa1, 0xaa];
    const img = document.querySelector<HTMLImageElement>('img[alt="Capture of this page, private content masked"]')!;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(img, 0, 0);
    const scale = img.naturalWidth / document.documentElement.clientWidth;

    /** Pixels on a grid inside the element's box (inset from its anti-aliased edges), as captured. */
    function samples(element: Element): number[][] {
      const rect = element.getBoundingClientRect();
      const points: number[][] = [];
      for (let x = rect.left + 3; x < rect.right - 3; x += 3) {
        for (let y = rect.top + 3; y < rect.bottom - 3; y += 2) {
          const pixel = context.getImageData(Math.round(x * scale), Math.round((y + window.scrollY) * scale), 1, 1);
          points.push([...pixel.data.slice(0, 3)]);
        }
      }
      return points;
    }
    const isMask = (rgb: number[]) => rgb.every((value, i) => Math.abs(value - MASK[i]) <= 4);

    const privateElements = [...document.querySelectorAll("[data-private]")].filter(
      (element) => !element.closest("dialog") && element.getBoundingClientRect().width > 0,
    );
    const unmaskedPrivateElements = privateElements
      // An element too small to sample counts as unmasked, so nothing passes unchecked.
      .filter((element) => {
        const points = samples(element);
        return points.length === 0 || !points.every(isMask);
      })
      .map((element) => element.outerHTML.slice(0, 80));
    const publicHeading = [...document.querySelectorAll("h1, h2")].find((h) => h.textContent === headingText)!;
    const publicTextVisible = samples(publicHeading).some((rgb) => !isMask(rgb) && Math.max(...rgb) < 128);

    return { privateElements: privateElements.length, unmaskedPrivateElements, publicTextVisible };
  }, publicHeadingText);
}
