import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="text-2xl font-normal">Sign in</h1>
      <p className="mt-1 text-sm text-muted">to your watchlists and portfolio</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
