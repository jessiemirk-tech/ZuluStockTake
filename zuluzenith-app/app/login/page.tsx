// app/login/page.tsx
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 font-space-grotesk text-2xl font-bold">
        Zulu<span className="text-primary">Zenith</span>
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Sign in to continue.
      </p>
      <LoginForm redirectTo={params.next ?? "/"} />
    </div>
  );
}
