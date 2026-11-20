import { describe, expect, it } from "vitest";
import { githubIssueTracker, IssueTrackerError } from "@/core";

interface SentRequest {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

/**
 * Stands in for GitHub's REST API: replies to "METHOD path" with the scripted reply (the last one
 * repeats), and records every request. Anything unscripted is a 404, like GitHub.
 */
function fakeGitHub(script: Record<string, Reply | Reply[]>) {
  const sent: SentRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    sent.push({ method, url, headers: new Headers(init?.headers), body: init?.body && JSON.parse(String(init.body)) });
    const path = new URL(url).pathname;
    const scripted = script[`${method} ${path}`];
    const reply = Array.isArray(scripted) ? (scripted.length > 1 ? scripted.shift()! : scripted[0]) : scripted;
    if (reply instanceof Error) throw reply;
    const { status, body, headers } = reply ?? { status: 404, body: { message: "Not Found" } };
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
  };
  return { fetch, sent };
}

const REPO = "/repos/ewc340/studyloop";

function trackerFor(github: ReturnType<typeof fakeGitHub>) {
  return githubIssueTracker({ token: "github_pat_test", repository: "ewc340/studyloop", fetch: github.fetch });
}

const branchExists = { status: 200, body: { object: { sha: "abc" } } };

describe("GitHub issue tracker", () => {
  it("creates an issue with its title, body and labels, authenticated with the token", async () => {
    const github = fakeGitHub({
      [`POST ${REPO}/issues`]: {
        status: 201,
        body: { number: 42, html_url: "https://github.com/ewc340/studyloop/issues/42" },
      },
    });

    const issue = await trackerFor(github).createIssue({ title: "T", body: "B", labels: ["needs-triage", "bug"] });

    expect(issue).toEqual({ number: 42, url: "https://github.com/ewc340/studyloop/issues/42" });
    const [request] = github.sent;
    expect(request.body).toEqual({ title: "T", body: "B", labels: ["needs-triage", "bug"] });
    expect(request.headers.get("authorization")).toBe("Bearer github_pat_test");
  });

  it("commits an image to the feedback-assets branch and returns a URL issues can embed", async () => {
    const github = fakeGitHub({
      [`GET ${REPO}/git/ref/heads/feedback-assets`]: branchExists,
      [`PUT ${REPO}/contents/2026-11-20/x-page.png`]: { status: 201, body: {} },
    });

    const { url } = await trackerFor(github).uploadImage({
      path: "2026-11-20/x-page.png",
      contentType: "image/png",
      bytes: new TextEncoder().encode("png bytes"),
    });

    expect(url).toBe("https://github.com/ewc340/studyloop/blob/feedback-assets/2026-11-20/x-page.png?raw=true");
    const put = github.sent.find((r) => r.method === "PUT")!;
    expect(put.body).toMatchObject({ branch: "feedback-assets", content: btoa("png bytes") });
  });

  it("creates the feedback-assets branch, unrelated to main, the first time it's needed", async () => {
    const github = fakeGitHub({
      [`GET ${REPO}/git/ref/heads/feedback-assets`]: [{ status: 404, body: { message: "Not Found" } }, branchExists],
      [`POST ${REPO}/git/trees`]: { status: 201, body: { sha: "tree1" } },
      [`POST ${REPO}/git/commits`]: { status: 201, body: { sha: "commit1" } },
      [`POST ${REPO}/git/refs`]: { status: 201, body: {} },
      [`PUT ${REPO}/contents/a.png`]: { status: 201, body: {} },
      [`PUT ${REPO}/contents/b.png`]: { status: 201, body: {} },
    });
    const tracker = trackerFor(github);
    const image = { contentType: "image/png", bytes: new Uint8Array([1]) };

    await tracker.uploadImage({ ...image, path: "a.png" });
    await tracker.uploadImage({ ...image, path: "b.png" });

    const commit = github.sent.find((r) => r.url.endsWith("/git/commits"))!;
    expect(commit.body).toMatchObject({ tree: "tree1", parents: [] });
    const ref = github.sent.filter((r) => r.url.endsWith("/git/refs"));
    expect(ref).toHaveLength(1);
    expect(ref[0].body).toEqual({ ref: "refs/heads/feedback-assets", sha: "commit1" });
  });
});
