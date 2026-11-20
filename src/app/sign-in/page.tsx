import { SignInWithGitHub } from "./sign-in-button";

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">studyloop</h1>
      <p className="text-zinc-700 dark:text-zinc-300">Sign in to see your loop.</p>
      <SignInWithGitHub />
    </main>
  );
}
