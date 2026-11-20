"use client";

import { useRouter } from "next/navigation";
import { authClient } from "./auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
      }}
      className="text-sm text-zinc-600 underline underline-offset-4 dark:text-zinc-400"
    >
      Sign out
    </button>
  );
}
