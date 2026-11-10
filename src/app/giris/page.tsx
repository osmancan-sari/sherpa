import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { readPendingLogin } from "./pending";
import { initialLoginState, type LoginState } from "./state";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sherpa</h1>
          <p className="text-muted-foreground text-sm">
            E-postana tek kullanımlık bir kod gönderilir.
          </p>
        </div>
        {/* The form starts on whichever step this device is at, which only the request knows. */}
        <Suspense fallback={<div className="min-h-32" />}>
          <LoginFormAtCurrentStep />
        </Suspense>
      </div>
    </main>
  );
}

/** If a code was sent from this device and is still fresh, the form opens on the code step. */
async function LoginFormAtCurrentStep() {
  const pendingEmail = await readPendingLogin();
  const initial: LoginState = pendingEmail
    ? { step: "code", email: pendingEmail }
    : initialLoginState;
  return <LoginForm initial={initial} />;
}
