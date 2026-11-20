import { connection } from "next/server";
import { buildBadge } from "@/server/build-info";

/** Names the running build (`PR #<n> · <sha>` or `<branch> · <sha>`) outside production. */
export async function BuildBadge() {
  // The checkout can change under a running dev server, so read it per request, never at prerender.
  await connection();
  const badge = buildBadge();
  if (!badge) return null;
  return (
    <div
      data-testid="build-badge"
      title={`${badge.name} · ${badge.commit}`}
      // Bottom centre: clear of Next's dev indicator (bottom left) and the owner's Report issue button
      // (bottom right). It never takes taps. A long branch name truncates; the commit always shows.
      className="pointer-events-none fixed bottom-[max(0.25rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex max-w-[55vw] -translate-x-1/2 gap-1 rounded bg-zinc-900/70 px-1.5 py-0.5 font-mono text-[10px] leading-tight whitespace-nowrap text-white dark:bg-zinc-100/70 dark:text-zinc-900"
    >
      <span className="truncate">{badge.name}</span>
      <span aria-hidden>·</span>
      <span>{badge.commit}</span>
    </div>
  );
}
