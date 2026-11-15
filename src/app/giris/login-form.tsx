"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/core/ui/kit/Button";
import { Input } from "@/core/ui/kit/Field";
import { login } from "./actions";
import type { LoginState } from "./state";

// The sign-in steps (docs/tasarim/ekranlar/giris-ekranlari.md; frames LT1–LP3). The flow and
// its texts are the code's as before.

export function LoginForm({ initial }: { initial: LoginState }) {
  const [state, formAction, pending] = useActionState(login, initial);

  if (state.step === "code") {
    return (
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={state.email} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="token" className="text-ink-2 text-sm">
            Giriş kodu
          </label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
            aria-invalid={state.error ? true : undefined}
            className="tracking-code h-15 rounded-2xl text-center font-mono text-2xl tabular-nums"
          />
          <p className="text-ink-2 text-sm">
            <span className="break-all">{state.email}</span> adresine gelen kodu yaz.
          </p>
        </div>

        <Message error={state.error} notice={state.notice} />

        <Button
          type="submit"
          name="intent"
          value="verify"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          Giriş yap
        </Button>
        <div className="flex justify-between gap-2">
          <Button
            type="submit"
            name="intent"
            value="resend"
            variant="quiet"
            className="text-note px-2.5"
            formNoValidate
            disabled={pending}
          >
            Kodu yeniden gönder
          </Button>
          <Button
            type="submit"
            name="intent"
            value="reset"
            variant="quiet"
            className="text-note px-2.5"
            formNoValidate
            disabled={pending}
          >
            Başka e-posta
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-ink-2 text-sm">
          E-posta
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.email ?? ""}
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      <Message error={state.error} />

      <Button
        type="submit"
        name="intent"
        value="request"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        Kod gönder
      </Button>
    </form>
  );
}

/** An error in coral under the field, a notice in light; each with its icon. */
function Message({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-note text-behind flex items-start gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="text-note text-ink flex items-start gap-2">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {notice}
      </p>
    );
  }
  return null;
}
