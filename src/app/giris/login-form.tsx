"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";
import { initialLoginState } from "./state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialLoginState);

  if (state.step === "code") {
    return (
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={state.email} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="token">Giriş kodu</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
            className="h-12 text-center font-mono text-xl tracking-[0.3em] md:text-xl"
          />
          <p className="text-muted-foreground text-sm">
            <span className="break-all">{state.email}</span> adresine gelen kodu yaz.
          </p>
        </div>

        <Message error={state.error} notice={state.notice} />

        <Button
          type="submit"
          name="intent"
          value="verify"
          size="lg"
          className="h-11"
          disabled={pending}
        >
          Giriş yap
        </Button>
        <div className="flex justify-between gap-2">
          <Button
            type="submit"
            name="intent"
            value="resend"
            variant="ghost"
            className="h-11"
            formNoValidate
            disabled={pending}
          >
            Kodu yeniden gönder
          </Button>
          <Button
            type="submit"
            name="intent"
            value="reset"
            variant="ghost"
            className="h-11"
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-posta</Label>
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
          className="h-11"
        />
      </div>

      <Message error={state.error} />

      <Button
        type="submit"
        name="intent"
        value="request"
        size="lg"
        className="h-11"
        disabled={pending}
      >
        Kod gönder
      </Button>
    </form>
  );
}

function Message({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {notice}
      </p>
    );
  }
  return null;
}
