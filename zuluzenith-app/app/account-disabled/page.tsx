// app/account-disabled/page.tsx
export default function AccountDisabledPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 font-space-grotesk text-lg font-bold">
        Account not active
      </h1>
      <p className="text-sm text-muted-foreground">
        Your account has been deactivated or isn&apos;t linked to a store
        yet. Ask your Office manager to check your access.
      </p>
    </div>
  );
}
