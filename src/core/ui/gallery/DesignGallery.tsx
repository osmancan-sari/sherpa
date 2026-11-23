"use client";

import { Check, Ellipsis, Pencil, Play, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  AiTag,
  AlertRow,
  Button,
  Chip,
  DayBox,
  LoadBar,
  WeekBars,
  DateInput,
  Field,
  IconButton,
  Input,
  ListMore,
  ListRow,
  OfflinePill,
  Panel,
  ProgressBar,
  ReadError,
  Segmented,
  Select,
  Sheet,
  Status,
  StepLines,
  Stepper,
  Switch,
  SwitchRow,
  Tag,
  Textarea,
  TimeStrip,
  type TimeStripPiece,
  Toast,
  Window,
} from "@/core/ui/kit";
import { Picker, PickerHome } from "@/core/ui/kit/Picker";
import { HistoryLink, TabBar, TabLink } from "@/core/ui/kit/Tabs";
import { useLook } from "@/core/ui/look/useLook";
import { ModulePieces } from "./ModulePieces";
import { Backdrop, type BackdropKind } from "@/core/ui/sky/Backdrop";
import { type Sky, skyOf } from "@/core/ui/sky/sky";
import { token } from "@/core/ui/tokens";
import { cn } from "@/lib/utils";

// The design gallery (/tasarim; docs/tasarim/README.md): every shared piece of the kit and each
// of its states, drawn with the real components, over the sky's four states and the calm
// backdrop, with the "Saydamlığı azalt" and "Hareketi azalt" switches. A new piece enters the kit
// and this page before any screen uses it. Not in the menu; linked at the end of Settings.

const STATES = [
  { value: "safak", label: "Şafak" },
  { value: "gunduz", label: "Gündüz" },
  { value: "batim", label: "Gün batımı" },
  { value: "gece", label: "Gece" },
] as const;
type State = (typeof STATES)[number]["value"];

const SKY: Record<State, Sky> = {
  safak: skyOf(-9.53),
  gunduz: skyOf(25, { rising: false }),
  batim: skyOf(-0.33, { rising: false }),
  gece: skyOf(-30),
};

const BLUE = token("color-swatch-blue");
const SUN = token("color-swatch-sun");
const VIOLET = token("color-swatch-violet");
const TEAL = token("color-swatch-teal");
const GREEN = token("color-swatch-green");

export function DesignGallery() {
  const [state, setState] = useState<State>("gunduz");
  const [ground, setGround] = useState<"calm" | "full">("calm");
  const [look, setLook] = useLook();
  const kind: BackdropKind = { kind: ground };
  return (
    <div
      className="relative flex flex-col gap-8 px-4 py-5.5 md:px-10 md:py-6"
      data-testid="gallery"
    >
      {/* Behind the whole gallery (not the screen), so a full-page picture shows it all. */}
      <div className="absolute inset-0 -z-[5]">
        <Backdrop kind={kind} sky={SKY[state]} contained />
      </div>
      <header className="flex flex-col gap-4">
        <h1 className="text-title tracking-title font-bold md:text-3xl">Tasarım</h1>
        <p className="text-ink-2 text-note max-w-read">
          Ortak parçalar gerçek bileşenleriyle. Değerler tokens.css dosyasından, kurallar
          docs/tasarim/parcalar.md dosyasından.
        </p>
        <Panel variant="soft" className="gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Gökyüzü" options={STATES} value={state} onChange={setState} />
            <Segmented
              label="Zemin"
              options={[
                { value: "calm", label: "Sakin zemin" },
                { value: "full", label: "Tam manzara" },
              ]}
              value={ground}
              onChange={setGround}
            />
          </div>
          <div className="flex flex-wrap gap-x-6">
            <SwitchRow
              label="Saydamlığı azalt"
              checked={look.transparency.on}
              onChange={(on) => setLook("transparency", on)}
            />
            <SwitchRow
              label="Hareketi azalt"
              checked={look.motion.on}
              onChange={(on) => setLook("motion", on)}
            />
          </div>
        </Panel>
      </header>

      <div className="grid items-start gap-11 md:grid-cols-2 xl:grid-cols-3">
        <Column>
          <Section title="Panel">
            <Panel variant="main" className="gap-1.5 px-5 py-4.5">
              <span className="panel-label">Ana panel</span>
              <span className="text-base">Tam manzaranın üstünde: dolgu %42, köşe 28.</span>
            </Panel>
            <Panel variant="dense" className="gap-1.5 px-5 py-4.5">
              <span className="panel-label">Yoğun panel</span>
              <span className="text-base">Liste, tablo ve formda: dolgu %50, köşe 24.</span>
            </Panel>
            <Panel variant="soft" className="gap-1.5 px-4.5 py-3.5">
              <span className="panel-label">İkincil panel</span>
              <span className="text-note">Not, özet ve küçük kutular: dolgu %34, köşe 22.</span>
            </Panel>
          </Section>

          <Section title="Liste satırı">
            <Panel variant="dense">
              <ListRow
                dot={BLUE}
                title="İstatistik ödevi"
                subtitle="Okul · 60 dk · Pazar"
                trailing={
                  <>
                    <IconButton label="Düzenle">
                      <Pencil aria-hidden />
                    </IconButton>
                    <IconButton label="Başla">
                      <Play aria-hidden />
                    </IconButton>
                    <IconButton label="Bitti">
                      <Check aria-hidden />
                    </IconButton>
                  </>
                }
              />
              <ListRow dot={SUN} title="Sabah" subtitle="Rutin · 4 dk" />
              <ListRow
                dot={BLUE}
                selected
                title="Seçili satır"
                subtitle="Klavyeyle ya da dokunuşla seçili"
              />
              <ListRow dot={VIOLET} pending title="Bekleyen iş" subtitle="İş · bekliyor · soluk" />
              <ListRow
                title="Noktasız satır"
                subtitle="Ayar ve form satırı"
                trailing={<Switch label="Örnek" checked onChange={() => undefined} />}
              />
              <ListRow block title="Diş hekimi" subtitle="18:30–19:15 · sabit" />
            </Panel>
          </Section>

          <Section title="Açılır liste">
            <MoreExample />
          </Section>

          <Section title="Takvim: gün kutusu, yük, haftalar">
            <CalendarExample />
          </Section>
        </Column>

        <Column>
          <Section title="Düğmeler">
            <Row>
              <Button variant="primary" size="lg">
                Başla
              </Button>
              <Button variant="secondary" size="lg">
                Ertele
              </Button>
              <Button variant="quiet" size="lg">
                Başka bir şey yapıyorum
              </Button>
            </Row>
            <Row>
              <Button variant="primary">Kaydet</Button>
              <Button variant="secondary">Vazgeç</Button>
              <Button variant="danger">Sil</Button>
              <Button variant="primary" disabled>
                Kaydet
              </Button>
            </Row>
            <Row>
              <Button size="sm">X dk&apos;m var</Button>
              <Button size="sm">Yeniden planla</Button>
              <Button size="sm">+ Yeni giriş</Button>
            </Row>
            <Row>
              <IconButton label="Düzenle">
                <Pencil aria-hidden />
              </IconButton>
              <IconButton label="Başla">
                <Play aria-hidden />
              </IconButton>
              <IconButton label="Bitti">
                <Check aria-hidden />
              </IconButton>
              <IconButton label="Daha fazla">
                <Ellipsis aria-hidden />
              </IconButton>
              <IconButton label="Kapat">
                <X aria-hidden />
              </IconButton>
              <IconButton label="Seçili" pressed>
                <Check aria-hidden />
              </IconButton>
            </Row>
          </Section>

          <Section title="Anahtar, seçim, hap">
            <Row>
              <Switch label="Açık" checked onChange={() => undefined} />
              <span className="text-note">Açık</span>
              <Switch label="Kapalı" checked={false} onChange={() => undefined} />
              <span className="text-note">Kapalı</span>
            </Row>
            <Row>
              <SegmentedDemo />
            </Row>
            <Row>
              <Chip dot={BLUE}>Okul</Chip>
              <Chip dot={TEAL}>Ev</Chip>
              <Chip dot={SUN} selected>
                Sağlık
              </Chip>
              <Chip dot={VIOLET}>İş</Chip>
            </Row>
            <Row>
              <Tag>temel</Tag>
              <Tag>bekliyor</Tag>
              <AiTag>45 dk</AiTag>
            </Row>
          </Section>

          <Section title="Sayaç">
            <StepperDemo />
          </Section>

          <Section title="Durum">
            <Row>
              <Status health="ok" />
              <Status health="attention" />
              <Status health="behind" />
            </Row>
          </Section>

          <Section title="Sekme ve geçmiş düğmesi">
            <Row>
              <TabBar label="Bölümler">
                <TabLink href="/tasarim" selected>
                  Sabah
                </TabLink>
                <TabLink href="/tasarim">Akşam</TabLink>
              </TabBar>
              <HistoryLink href="/tasarim">Düzenlilik</HistoryLink>
              <HistoryLink href="/tasarim" open>
                Geçmiş
              </HistoryLink>
            </Row>
          </Section>

          <Section title="Açılır seçici">
            {/* Okul çekirdek A: the phone's facet picker beside the home entry. */}
            <div className="flex max-w-sm items-center gap-2.5" data-testid="gallery-picker">
              <PickerHome href="/tasarim" selected>
                Ana sayfa
              </PickerHome>
              <Picker
                label="Bölümler"
                placeholder="Ders seç"
                className="flex-1"
                items={[
                  {
                    key: "dl",
                    label: "Deep Learning",
                    href: "/tasarim",
                    dot: token("color-swatch-violet"),
                    detail: "YZV303E · sıradaki: Midterm · 30 Kas",
                  },
                  {
                    key: "rob",
                    label: "Robotics",
                    href: "/tasarim",
                    dot: token("color-swatch-teal"),
                    detail: "YZV406E · sıradaki: Midterm · 24 Kas",
                  },
                  {
                    key: "alg",
                    label: "Algoritma",
                    href: "/tasarim",
                    dot: token("color-swatch-blue"),
                    detail: "BBF301E · sıradaki: Assignment 2 · 26 Kas",
                  },
                ]}
              />
            </div>
          </Section>

          <Section title="Saatli şerit">
            <Panel variant="dense" className="px-4 pt-3">
              <TimeStrip
                from={stripAt("07:02")}
                to={stripAt("23:00")}
                now={stripAt("14:10")}
                pieces={STRIP}
                parts={[
                  {
                    key: "wake",
                    start: stripAt("07:02"),
                    end: stripAt("07:50"),
                    label: "uyanışa bağlı",
                  },
                  {
                    key: "bed",
                    start: stripAt("22:20"),
                    end: stripAt("23:00"),
                    label: "yatışa bağlı",
                  },
                ]}
                label="Örnek şerit"
              />
            </Panel>
          </Section>

          <Section title="İlerleme">
            <Panel variant="dense" className="gap-3.5 px-4.5 py-4">
              <div className="flex flex-col gap-2">
                <div className="text-note flex items-baseline">
                  <span>25 dk geçti</span>
                  <span className="text-ink-2 ml-auto">tahmin 45 dk</span>
                </div>
                <ProgressBar value={0.56} color={BLUE} label="Süre" />
              </div>
              <StepLines total={7} done={3} color={SUN} />
            </Panel>
          </Section>
        </Column>

        <Column>
          <Section title="Alan">
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Başlık">
                {({ id }) => <Input id={id} defaultValue="Sunum slaytları" />}
              </Field>
              <Field label="Başlık (boş)">
                {({ id }) => <Input id={id} placeholder="Ne yapılacak?" />}
              </Field>
              <Field label="Odakta">
                {({ id }) => (
                  <Input id={id} defaultValue="Sunum slay" className="border-focus shadow-focus" />
                )}
              </Field>
              <Field label="Süre (dk)" aiReason="Benzer işler 40–50 dk sürdü.">
                {({ id, describedBy }) => (
                  <Input id={id} ai defaultValue="45" aria-describedby={describedBy} />
                )}
              </Field>
              <Field label="Saat" hint="SS:dd; rakamla yazılır">
                {({ id }) => <Input id={id} defaultValue="08:00" inputMode="numeric" />}
              </Field>
              <Field label="Hatalı" error="Saat 00:00 ile 24:00 arasında olmalı.">
                {({ id }) => <Input id={id} defaultValue="25:70" aria-invalid />}
              </Field>
              <Field label="Tarih" hint="Türkçe yazılır: gg.aa.yyyy">
                {({ id }) => <DateDemo id={id} />}
              </Field>
            </div>
            <Field label="Seçim">
              {({ id }) => (
                <Select id={id} defaultValue="hafta-ici">
                  <option value="hafta-ici">Hafta içi</option>
                  <option value="her-gun">Her gün</option>
                </Select>
              )}
            </Field>
            <Field label="Çok satır">
              {({ id }) => <Textarea id={id} defaultValue={"Hocaya e-posta at\nKitabı iade et"} />}
            </Field>
          </Section>

          <Section title="Uyarı satırı ve bildirim">
            <AlertRow action={{ label: "Takvime bak", href: "/tasarim" }}>
              Cuma iki teslim üst üste: 1 saat Perşembe akşamına alındı.
            </AlertRow>
            <AlertRow tone="info" action={{ label: "Modüle git", href: "/tasarim" }}>
              Bugün uygun saat kalmadı: Spor.
            </AlertRow>
            <Toast action={{ label: "Geri al", onClick: () => undefined }}>
              İş bitti: İstatistik ödevi
            </Toast>
            <Toast>Kaydedildi</Toast>
            <Row>
              <OfflinePill />
            </Row>
            <ReadError onRetry={() => undefined} />
          </Section>

          <Section title="Pencere ve alttan sayfa">
            <OverlayDemo />
          </Section>

          <Section title="Sahne tonları">
            <div className="grid grid-cols-3 gap-2.5">
              <ToneSwatch label="Sakin" kind={{ kind: "full" }} sky={SKY[state]} />
              <ToneSwatch label="Odak" kind={{ kind: "focus" }} sky={SKY[state]} />
              <ToneSwatch label="Enerji" kind={{ kind: "energy", color: GREEN }} sky={SKY[state]} />
            </div>
          </Section>
        </Column>
      </div>

      <ModulePieces />
    </div>
  );
}

/** The counter, small (a form row) and large (a full-screen view); the first at its least. */
function StepperDemo() {
  const [minutes, setMinutes] = useState(480);
  const [seconds, setSeconds] = useState(0);
  const [focus, setFocus] = useState(25);
  return (
    <Panel variant="dense" className="gap-1 px-4 py-2">
      <div className="flex min-h-12.5 items-center justify-between gap-3">
        <span className="text-ink-2 text-note">Süre (en azında)</span>
        <Stepper
          label="Süre"
          value={seconds}
          min={0}
          max={600}
          step={15}
          format={(value) => (value === 0 ? "süresiz" : `${value} sn`)}
          onChange={setSeconds}
        />
      </div>
      <div className="border-line flex min-h-12.5 items-center justify-between gap-3 border-t">
        <span className="text-ink-2 text-note">Uyku hedefi</span>
        <Stepper
          label="Uyku hedefi"
          value={minutes}
          min={240}
          max={720}
          step={30}
          format={(value) => String(value / 60).replace(".", ",")}
          unit="saat"
          onChange={setMinutes}
        />
      </div>
      <div className="border-line flex justify-center border-t py-3">
        <Stepper
          size="lg"
          label="Dakika"
          value={focus}
          min={5}
          max={90}
          step={5}
          unit="dk"
          onChange={setFocus}
        />
      </div>
    </Panel>
  );
}

function DateDemo({ id }: { id: string }) {
  const [day, setDay] = useState("2026-11-20");
  return <DateInput id={id} value={day} onChange={(event) => setDay(event.target.value)} />;
}

function Column({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-10">{children}</div>;
}

/** A clock time on a fixed day for the gallery's strip. */
function stripAt(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 10, 13, hours, minutes);
}

/** The gallery's strip: past and coming work, travel, a fixed block. */
const STRIP: TimeStripPiece[] = [
  {
    key: "a",
    kind: "work",
    start: stripAt("07:07"),
    end: stripAt("07:50"),
    label: "Duş",
    color: SUN,
  },
  {
    key: "b",
    kind: "work",
    start: stripAt("08:15"),
    end: stripAt("09:30"),
    label: "Rapor: giriş",
    color: VIOLET,
  },
  {
    key: "c",
    kind: "travel",
    start: stripAt("09:55"),
    end: stripAt("10:30"),
    label: "yol 35 dk",
    color: BLUE,
  },
  {
    key: "d",
    kind: "block",
    start: stripAt("10:30"),
    end: stripAt("12:20"),
    label: "Derin Öğrenme dersi",
  },
  {
    key: "e",
    kind: "work",
    start: stripAt("14:10"),
    end: stripAt("15:40"),
    label: "Proje önerisi taslağı",
    color: BLUE,
  },
  {
    key: "f",
    kind: "work",
    start: stripAt("17:00"),
    end: stripAt("17:15"),
    label: "Süpürme",
    color: TEAL,
  },
  { key: "g", kind: "block", start: stripAt("18:30"), end: stripAt("19:15"), label: "Diş hekimi" },
];

/** Takvim's pieces: a week's days (gone by, today, selected), its load, the coming weeks. */
function CalendarExample() {
  const [selected, setSelected] = useState<number | null>(15);
  const days = [
    { name: "Per", date: 12, past: true, today: false, due: [] },
    { name: "Cum", date: 13, past: false, today: true, due: [] },
    { name: "Cmt", date: 14, past: false, today: false, due: [] },
    {
      name: "Paz",
      date: 15,
      past: false,
      today: false,
      due: [{ key: "a", title: "İstatistik ödevi", color: BLUE }],
    },
  ];
  return (
    <Panel variant="dense" className="gap-3 p-4">
      <div className="grid grid-cols-4 gap-1.5">
        {days.map((day) => (
          <DayBox
            key={day.date}
            name={day.name}
            date={day.date}
            label={`${day.name} ${day.date}`}
            today={day.today}
            past={day.past}
            selected={selected === day.date}
            board={false}
            due={day.due}
            onClick={() => setSelected(selected === day.date ? null : day.date)}
          />
        ))}
      </div>
      <LoadBar
        label="İş 11 sa 10 dk, vakit 17 sa 40 dk"
        demand={670}
        capacity={1060}
        parts={[
          { key: "okul", color: BLUE, minutes: 420 },
          { key: "is", color: VIOLET, minutes: 180 },
          { key: "ev", color: TEAL, minutes: 70 },
        ]}
      />
      <WeekBars
        onPick={() => undefined}
        weeks={[16, 23, 30, 7, 14, 21, 28, 4].map((date, index) => ({
          key: String(index),
          date,
          month: index === 0 ? "Kas" : index === 3 ? "Ara" : index === 7 ? "Oca" : "",
          demand: index === 2 ? 2040 : 540 + index * 60,
          capacity: 1800,
          over: index === 2,
          label: `${date} haftası`,
        }))}
      />
    </Panel>
  );
}

/** "Hepsini göster" / "Küçült": the list opens downward. */
function MoreExample() {
  const [open, setOpen] = useState(false);
  return (
    <Panel variant="dense" label="Sıradakiler">
      <ListRow dot={BLUE} title="İstatistik ödevi" subtitle="Okul · 60 dk · Pazar" />
      <ListRow dot={TEAL} title="Süpürme" subtitle="Ev · 15 dk · 1/2" />
      {open ? (
        <>
          <ListRow block title="Diş hekimi" subtitle="18:30–19:15 · sabit" />
          <ListRow dot={VIOLET} title="Rapor: yöntem bölümü" subtitle="İş · 45 dk" />
        </>
      ) : null}
      <ListMore open={open} onToggle={() => setOpen(!open)} />
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="panel-label text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2.5", className)}>{children}</div>;
}

function SegmentedDemo() {
  const [often, setOften] = useState<"her-gun" | "n-gunde">("her-gun");
  const [minutes, setMinutes] = useState<"15" | "30" | "60">("30");
  return (
    <>
      <Segmented
        label="Sıklık"
        options={[
          { value: "her-gun", label: "Her gün" },
          { value: "n-gunde", label: "N günde bir" },
        ]}
        value={often}
        onChange={setOften}
      />
      <Segmented
        label="Süre"
        options={[
          { value: "15", label: "15" },
          { value: "30", label: "30" },
          { value: "60", label: "60" },
        ]}
        value={minutes}
        onChange={setMinutes}
      />
    </>
  );
}

function OverlayDemo() {
  const [win, setWin] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [module, setModule] = useState("okul");
  return (
    <Row>
      <Button onClick={() => setWin(true)}>Pencereyi aç</Button>
      <Button onClick={() => setSheet(true)}>Sayfayı aç</Button>
      <Window
        open={win}
        onOpenChange={setWin}
        title="Saat 16:49. Şimdi yatıyor musun?"
        description="Yatış aralığının başı: 22:00."
        actions={
          <>
            <Button onClick={() => setWin(false)}>Vazgeç</Button>
            <Button variant="primary" onClick={() => setWin(false)}>
              Evet, yatıyorum
            </Button>
          </>
        }
      />
      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        title="Yeni giriş"
        footer={
          <>
            <span className="flex-1" />
            <Button onClick={() => setSheet(false)}>Vazgeç</Button>
            <Button variant="primary" onClick={() => setSheet(false)}>
              Ekle
            </Button>
          </>
        }
      >
        <Input placeholder="Ne yapılacak?" aria-label="Ne yapılacak?" />
        <Row>
          {[
            { key: "okul", label: "Okul", dot: BLUE },
            { key: "ev", label: "Ev", dot: TEAL },
            { key: "is", label: "İş", dot: VIOLET },
          ].map((item) => (
            <Chip
              key={item.key}
              dot={item.dot}
              selected={module === item.key}
              onClick={() => setModule(item.key)}
            >
              {item.label}
            </Chip>
          ))}
        </Row>
      </Sheet>
    </Row>
  );
}

function ToneSwatch({ label, kind, sky }: { label: string; kind: BackdropKind; sky: Sky }) {
  return (
    <div className="rounded-dense border-edge relative flex h-30 items-end overflow-hidden border p-2.5">
      <Backdrop kind={kind} sky={sky} contained />
      <span className="text-meta relative font-semibold">{label}</span>
    </div>
  );
}
