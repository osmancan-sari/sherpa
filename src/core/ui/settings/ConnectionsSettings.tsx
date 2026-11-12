"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistry } from "@/core/app/CoreProvider";
import { useDeviceTokens, useModuleRows } from "@/core/app/hooks";
import { useCreateDeviceToken, useRevokeDeviceToken } from "@/core/app/token-actions";
import { scopeChoices } from "@/core/contract/ingest";
import type { DeviceToken } from "@/core/data/tokens";
import { formatDayLabel, formatTime } from "@/lib/date";
import { ClientOnly } from "../ClientOnly";

// Settings → Bağlantılar (Ç3d; docs/02-mimari.md, "Cihaz anahtarları ve giriş ucu"): device
// tokens for the phone's automation and the collectors. A token is shown once, right after it
// is made; the list shows its first characters, scopes, last use, and lets it be revoked.

export function ConnectionsSettings() {
  return (
    <ClientOnly>
      <ConnectionsBody />
    </ClientOnly>
  );
}

const when = (stamp: string) => `${formatDayLabel(new Date(stamp))} ${formatTime(new Date(stamp))}`;

function ConnectionsBody() {
  const registry = useRegistry();
  const modules = useModuleRows();
  const tokens = useDeviceTokens();
  const choices = useMemo(() => {
    const active = new Set(
      (modules.data ?? []).filter((row) => row.status === "active").map((row) => row.slug),
    );
    return scopeChoices(registry.list.filter((def) => active.has(def.slug)));
  }, [registry, modules.data]);
  const labelOf = (scope: string) =>
    choices.find((choice) => choice.scope === scope)?.label ?? scope;
  const [made, setMade] = useState<{ token: string; scopes: string[] } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Telefonun otomasyonu ve bilgisayardaki toplayıcılar Sherpa&apos;ya bir anahtarla yazar.
        Anahtar yalnızca seçilen uçlara yazar, hiçbir şey okuyamaz.
      </p>

      {made ? (
        <MadeToken token={made.token} scopes={made.scopes} onDone={() => setMade(null)} />
      ) : (
        <NewToken choices={choices} onMade={setMade} />
      )}

      {(tokens.data ?? []).length > 0 ? (
        <ul className="flex flex-col" aria-label="Anahtarlar">
          {tokens.data!.map((token) => (
            <TokenRow key={token.id} token={token} labelOf={labelOf} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NewToken({
  choices,
  onMade,
}: {
  choices: ReturnType<typeof scopeChoices>;
  onMade: (made: { token: string; scopes: string[] }) => void;
}) {
  const create = useCreateDeviceToken();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const ready = name.trim().length > 0 && name.trim().length <= 60 && scopes.length > 0;

  return (
    <form
      aria-label="Yeni anahtar"
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        create.mutate(
          { name, scopes },
          {
            onSuccess: ({ token }) => {
              onMade({ token, scopes });
              setName("");
              setScopes([]);
            },
          },
        );
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Ad</span>
        <Input
          value={name}
          maxLength={60}
          placeholder="iPhone Kestirmeler"
          onChange={(event) => setName(event.target.value)}
          className="h-11 md:h-9"
        />
      </label>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="text-muted-foreground mb-1.5">Yazabileceği uçlar</legend>
        {choices.map((choice) => (
          <label key={choice.scope} className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-5"
              checked={scopes.includes(choice.scope)}
              onChange={(event) =>
                setScopes((current) =>
                  event.target.checked
                    ? [...current, choice.scope]
                    : current.filter((scope) => scope !== choice.scope),
                )
              }
            />
            <span>{choice.label}</span>
            <code className="text-muted-foreground text-xs">{choice.scope}</code>
          </label>
        ))}
      </fieldset>
      <Button
        type="submit"
        variant="outline"
        className="h-11 w-fit md:h-9"
        disabled={!ready || create.isPending}
      >
        Anahtar üret
      </Button>
    </form>
  );
}

function MadeToken({
  token,
  scopes,
  onDone,
}: {
  token: string;
  scopes: string[];
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4" role="status">
      <p className="text-sm font-medium">Anahtar hazır. Bir daha gösterilmez; şimdi kopyala.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          readOnly
          value={token}
          aria-label="Yeni anahtar"
          data-testid="new-token"
          onFocus={(event) => event.target.select()}
          className="h-11 min-w-0 flex-1 font-mono text-xs md:h-9"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(token)
              .then(() => setCopied(true))
              .catch(() => {});
          }}
        >
          {copied ? "Kopyalandı" : "Kopyala"}
        </Button>
      </div>
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span>İstek: POST, başlıkta Authorization: Bearer &lt;anahtar&gt;, gövde JSON.</span>
        {scopes.map((scope) => (
          <code key={scope} className="break-all">
            {origin}/api/ingest/{scope}
          </code>
        ))}
      </div>
      <Button type="button" className="h-11 w-fit md:h-9" onClick={onDone}>
        Tamam
      </Button>
    </div>
  );
}

function TokenRow({ token, labelOf }: { token: DeviceToken; labelOf: (scope: string) => string }) {
  const revoke = useRevokeDeviceToken();
  const [confirm, setConfirm] = useState(false);
  const revoked = token.revoked_at !== null;
  return (
    <li
      className="border-border flex flex-wrap items-start justify-between gap-3 border-t py-3"
      data-testid="device-token"
    >
      <div className={`flex min-w-0 flex-col gap-1 text-sm ${revoked ? "opacity-60" : ""}`}>
        <span className="font-medium">
          {token.name} <span className="text-muted-foreground font-mono">{token.hint}…</span>
        </span>
        <span className="text-muted-foreground">{token.scopes.map(labelOf).join(", ")}</span>
        <span className="text-muted-foreground">
          {revoked
            ? `İptal edildi: ${when(token.revoked_at!)}`
            : token.last_used_at
              ? `Son kullanım: ${when(token.last_used_at)}`
              : "Henüz kullanılmadı"}
        </span>
      </div>
      {revoked ? null : confirm ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            className="h-11 md:h-9"
            onClick={() => revoke.mutate(token.id)}
          >
            Evet, iptal et
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 md:h-9"
            onClick={() => setConfirm(false)}
          >
            Vazgeç
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => setConfirm(true)}
        >
          İptal et
        </Button>
      )}
    </li>
  );
}
