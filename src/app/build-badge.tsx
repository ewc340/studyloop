import { connection } from "next/server";
import { buildBadgeLabel } from "@/server/build-info";

/** Names the running build (`PR #<n> · <sha>` or `<branch> · <sha>`) outside production. */
export async function BuildBadge() {
  // The checkout can change under a running dev server, so read it per request, never at prerender.
  await connection();
  const label = buildBadgeLabel();
  if (!label) return null;
  return (
    <div
      data-testid="build-badge"
      title="The build you're looking at"
      className="pointer-events-none fixed bottom-[max(0.25rem,env(safe-area-inset-bottom))] left-1 z-30 max-w-[60vw] truncate rounded bg-zinc-900/70 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-white dark:bg-zinc-100/70 dark:text-zinc-900"
    >
      {label}
    </div>
  );
}
