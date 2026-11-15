import type { Metadata } from "next";
import { Suspense } from "react";
import { Backdrop } from "@/core/ui/sky/Backdrop";
import { LoginForm } from "./login-form";
import { readPendingLogin } from "./pending";
import { initialLoginState, type LoginState } from "./state";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center px-6 pt-[max(--spacing(27),env(safe-area-inset-top))] pb-10 md:justify-center md:pt-10">
      {/* The full landscape, by the hour (docs/tasarim/ekranlar/giris-ekranlari.md). */}
      <Backdrop kind={{ kind: "full" }} />
      <div className="glass-main rounded-panel w-login md:w-login-board flex max-w-full flex-col gap-5 p-5.5 md:p-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="tracking-title text-4xl font-bold">Sherpa</h1>
          <p className="text-ink-2 text-base leading-snug">
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
