import { IssueTrackerError, type IssueTracker } from "./issue-reports";

export interface GitHubIssueTrackerOptions {
  /** A fine-grained token for this repository with Issues and Contents read/write. */
  token: string;
  /** `owner/name`. */
  repository: string;
  /** The branch images are committed to; it shares no history with the code. */
  assetsBranch?: string;
  /** Injected so tests never touch the network. */
  fetch?: typeof globalThis.fetch;
}

/**
 * The IssueTracker on GitHub's REST API. GitHub's issue API can't take attachments, so images are
 * committed to a dedicated branch and embedded by URL.
 */
export function githubIssueTracker(options: GitHubIssueTrackerOptions): IssueTracker {
  const { token, repository, assetsBranch = "feedback-assets", fetch = globalThis.fetch } = options;
  const api = `https://api.github.com/repos/${repository}`;
  let branchReady: Promise<void> | null = null;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await send(method, path, body);
    if (!response.ok) throw await failureFor(response);
    return (await response.json()) as T;
  }

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    try {
      return await fetch(`${api}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "studyloop",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new IssueTrackerError("unavailable", { cause: error });
    }
  }

  /** Creates the assets branch as an orphan (one README commit) if it doesn't exist yet. */
  async function ensureAssetsBranch(): Promise<void> {
    const existing = await send("GET", `/git/ref/heads/${assetsBranch}`);
    if (existing.ok) return;
    if (existing.status !== 404) throw await failureFor(existing);

    const tree = await request<{ sha: string }>("POST", "/git/trees", {
      tree: [{ path: "README.md", mode: "100644", type: "blob", content: ASSETS_README }],
    });
    const commit = await request<{ sha: string }>("POST", "/git/commits", {
      message: "Start the feedback-assets branch",
      tree: tree.sha,
      parents: [],
    });
    await request("POST", "/git/refs", { ref: `refs/heads/${assetsBranch}`, sha: commit.sha });
  }

  return {
    async uploadImage({ path, bytes }) {
      branchReady ??= ensureAssetsBranch().catch((error) => {
        branchReady = null;
        throw error;
      });
      await branchReady;
      await request("PUT", `/contents/${path}`, {
        message: `Add issue report image ${path}`,
        content: Buffer.from(bytes).toString("base64"),
        branch: assetsBranch,
      });
      return { url: `https://github.com/${repository}/blob/${assetsBranch}/${path}?raw=true` };
    },

    async createIssue({ title, body, labels }) {
      const issue = await request<{ number: number; html_url: string }>("POST", "/issues", { title, body, labels });
      return { number: issue.number, url: issue.html_url };
    },
  };
}

const ASSETS_README = `# feedback-assets

Images attached to issues reported from the studyloop app. Unrelated to the code on main; never merge it.
`;

/** Why GitHub refused, from its documented status codes and rate-limit headers. */
async function failureFor(response: Response): Promise<IssueTrackerError> {
  const message = await response.text().catch(() => "");
  const cause = `GitHub answered ${response.status}: ${message}`;
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" || /rate limit/i.test(message)));
  if (rateLimited) return new IssueTrackerError("rate-limited", { cause });
  if (response.status === 401) return new IssueTrackerError("unauthorized", { cause });
  // A fine-grained token without access to the repository sees it as missing.
  if (response.status === 403 || response.status === 404) return new IssueTrackerError("forbidden", { cause });
  return new IssueTrackerError("unavailable", { cause });
}
