"use client";

import { useState } from "react";
import { authClient } from "../auth-client";

export function SignInWithGitHub() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({ provider: "github", callbackURL: "/" });
      }}
      className="rounded-md bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Redirecting to GitHub…" : "Sign in with GitHub"}
    </button>
  );
}
