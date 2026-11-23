"use client";

import { useState } from "react";
import {
  Checklist,
  FlowLayout,
  Panel,
  type PomodoroState,
  PomodoroLayout,
  ResumeNote,
  SessionEnd,
  SessionFile,
  SessionSections,
  TimeUpCard,
} from "@/core/ui/kit";
import type { FlowState } from "@/core/ui/kit";
import { token } from "@/core/ui/tokens";

// The gallery's scene layouts (Okul çekirdek A; docs/tasarim/parcalar.md, "Sahne yerleşimleri"):
// each layout at a fixed moment, on the phone's layout and the board's, with its shared pieces.
// The time is held, so the pictures do not move.

const AT = new Date("2026-11-23T11:12:48Z");
const START = new Date("2026-11-23T11:00:00Z");
const TEAL = token("color-swatch-teal");
const BLUE = token("color-swatch-blue");
const PLAN = { focusMinutes: 25, breakMinutes: 5, rounds: 3 };
const BREAK: PomodoroState = {
  round: 1,
  phase: "break",
  since: "2026-11-23T11:12:00Z",
  pausedAt: null,
  pausedMs: 0,
  extraMs: 0,
  focusMs: 25 * 60_000,
};
const ON_BREAK: FlowState = {
  since: "2026-10-23T10:00:00Z",
  breakSince: "2026-11-23T11:08:28Z",
  breakMs: 0,
  extraMs: 0,
};

const SECTIONS = [
  {
    key: "1",
    title: "Oku: Jacobian'ın tanımı",
    measure: "2 tur",
    state: "current" as const,
    open: { label: "Aç", href: "/tasarim" },
  },
  { key: "2", title: "Oku: hız kinematiği", measure: "1 tur", state: "next" as const },
  { key: "3", title: "Çöz: Jacobian soruları 1–4", measure: "4 soru", state: "next" as const },
];

function Frame({
  label,
  device,
  children,
}: {
  label: string;
  device: "pano" | "telefon";
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-ink-2 text-sm">{label}</figcaption>
      <div
        className={
          device === "telefon"
            ? "bg-focus-tone rounded-panel flex min-h-200 w-97.5 flex-col p-5"
            : "bg-focus-tone rounded-panel flex min-h-150 flex-col p-10"
        }
      >
        {children}
      </div>
    </figure>
  );
}

export function LayoutPieces() {
  const [step, setStep] = useState(2);
  const noop = () => undefined;
  return (
    <section
      aria-label="Sahne yerleşimleri"
      className="flex flex-col gap-4"
      data-testid="gallery-layouts"
    >
      <h2 className="text-section font-bold">Sahne yerleşimleri</h2>
      <div className="flex flex-wrap items-start gap-5">
        <Frame label="Pomodoro, odak (telefon)" device="telefon">
          <PomodoroLayout
            device="telefon"
            plan={PLAN}
            state={null}
            startedAt={START}
            now={AT}
            onChange={noop}
            onFinish={noop}
            color={TEAL}
            title="Jacobian'ın tanımı"
            subtitle="Robotics · quiz Salı 8 Ara 09:30"
            boxes={<SessionSections sections={SECTIONS} color={TEAL} />}
          />
        </Frame>
        <Frame label="Pomodoro, kısa mola (telefon)" device="telefon">
          <PomodoroLayout
            device="telefon"
            plan={PLAN}
            state={BREAK}
            startedAt={START}
            now={AT}
            onChange={noop}
            onFinish={noop}
            color={TEAL}
            title="Kısa mola"
            subtitle="Robotics · quiz Salı 8 Ara 09:30"
          />
        </Frame>
        <Frame label="Akış, kaldığın yerle (telefon)" device="telefon">
          <FlowLayout
            device="telefon"
            plan={{ plannedMinutes: 90 }}
            state={null}
            startedAt={START}
            now={AT}
            onChange={noop}
            onFinish={noop}
            color={BLUE}
            title="Assignment 2"
            subtitle="Algoritma · teslim Per 26 Kas 23:59"
            boxes={
              <>
                <ResumeNote text="Merge yazıldı; test 3 geçmiyor, indise bak" />
                <Panel variant="dense" className="py-1">
                  <SessionFile
                    title="Assignment 2.pdf"
                    detail="Ödev metni"
                    open={{ label: "Aç", href: "/tasarim" }}
                  />
                </Panel>
              </>
            }
          />
        </Frame>
        <Frame label="Akış, mola (telefon)" device="telefon">
          <FlowLayout
            device="telefon"
            plan={{ plannedMinutes: 90 }}
            state={{ ...ON_BREAK, since: "2026-11-23T10:17:28Z" }}
            startedAt={START}
            now={AT}
            onChange={noop}
            onFinish={noop}
            color={BLUE}
            title="Assignment 2"
            subtitle="Algoritma · teslim Per 26 Kas 23:59"
          />
        </Frame>
        <Frame label="Kontrol listesi (telefon)" device="telefon">
          <Checklist
            device="telefon"
            title="Proposal teslimi"
            subtitle="Robotics projesi · teslim Cum 4 Ara 23:59"
            color={TEAL}
            current={step}
            onStep={(index) => setStep(index + 1)}
            steps={[
              {
                key: "hazir",
                title: "Dosya hazır",
                detail: "proposal.pdf",
                rowAction: { label: "Değiştir", onClick: noop },
              },
              { key: "ad", title: "Dosya adı", detail: "ogrenciNo_proposal.pdf" },
              {
                key: "yukle",
                title: "Ninova'ya yükle",
                detail: "Ödev sayfası açılır, dosyayı sen yüklersin",
                action: { label: "Ninova'yı aç", onClick: noop },
              },
              { key: "gor", title: "Yüklendiği görülsün", detail: "Sonraki okumada kapanır" },
            ]}
            quiet={[
              { label: "Yükledim", onClick: () => setStep(step + 1) },
              { label: "Sonra yap", onClick: noop },
            ]}
          />
        </Frame>
        <Frame label="Süre doldu (telefon)" device="telefon">
          <TimeUpCard
            device="telefon"
            text="Bitti dersen oturum kapanır; kalan iş 2. oturuma kalır. Bitmediyse 5 dakika eklenir; istediğin kadar ekleyebilirsin."
            onDone={noop}
            onMore={noop}
            third={{ label: "Bugünlük yeter", onClick: noop }}
          />
        </Frame>
        <Frame label="Oturum bitti (telefon)" device="telefon">
          <SessionEnd />
        </Frame>
      </div>
      <Frame label="Pomodoro, odak (pano)" device="pano">
        <PomodoroLayout
          device="pano"
          plan={PLAN}
          state={null}
          startedAt={START}
          now={AT}
          onChange={noop}
          onFinish={noop}
          color={TEAL}
          title="Jacobian'ın tanımı"
          subtitle="Robotics · quiz Salı 8 Ara 09:30"
          boxes={<SessionSections sections={SECTIONS} color={TEAL} />}
        />
      </Frame>
      <Frame label="Akış, süre doldu (pano)" device="pano">
        <FlowLayout
          device="pano"
          plan={{ plannedMinutes: 10 }}
          state={null}
          startedAt={START}
          now={AT}
          onChange={noop}
          onFinish={noop}
          color={BLUE}
          title="Assignment 2"
          subtitle="Algoritma · teslim Per 26 Kas 23:59"
          third={{ label: "Bugünlük yeter", onClick: noop }}
          boxes={
            <>
              <ResumeNote
                text="Merge yazıldı; test 3 geçmiyor, indise bak"
                detail="geçen oturumdan çıkarken yazdın"
              />
              <Panel variant="dense" className="py-1">
                <SessionFile
                  title="Assignment 2.pdf"
                  detail="Ödev metni"
                  open={{ label: "Aç", href: "/tasarim" }}
                />
              </Panel>
            </>
          }
        />
      </Frame>
    </section>
  );
}
