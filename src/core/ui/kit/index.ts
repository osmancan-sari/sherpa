// The component kit modules build their screens from (docs/06-modul-sozlesmesi.md,
// "Modül arayüzü"). Everything follows the core's design language and works on both layouts.
export { BarChart, type ChartPoint, LineChart } from "./charts";
export { type Column, DataTable } from "./DataTable";
export { type Step, StepRunner } from "./StepRunner";
export {
  ChoiceChips,
  EmptyState,
  ErrorState,
  type GridCell,
  HeatGrid,
  NumberStepper,
  Timeline,
  type TimelineItem,
  Timer,
} from "./pieces";

// The sky and the look (Ç4b): a module's scene stands on the core's landscape and dresses it.
export { useReducedMotion, useReducedTransparency } from "@/core/ui/look/useLook";
export { type BackdropKind, useBackdrop, useLayoutDevice, useSky } from "@/core/ui/sky/Backdrop";
export { type Device, Landscape } from "@/core/ui/sky/Landscape";
export {
  contrast,
  glassAlpha,
  hexToRgb,
  over,
  PANEL_RANGE,
  type Rgb,
  type Sky,
  skyAt,
  skyColorAt,
  skyOf,
  sunElevation,
  sunRising,
} from "@/core/ui/sky/sky";
export { token } from "@/core/ui/tokens";

// The glass language's shared pieces (Ç4b; docs/tasarim/parcalar.md, the gallery at /tasarim).
export { Button, buttonVariants, IconButton } from "./Button";
export { AiTag, Chip, type Health, Segmented, Status, Tag } from "./Choice";
export { AlertRow, OfflinePill, ProgressBar, ReadError, StepLines, Toast } from "./Feedback";
export { AiReason, Field, FieldError, Input, Select, Textarea } from "./Field";
export { ListRow } from "./ListRow";
export { OverlayClose, Sheet, SheetBody, SheetFooter, Window } from "./Overlay";
export { Panel, PanelLabel, type PanelVariant } from "./Panel";
export { Switch, SwitchRow } from "./Switch";
export { HistoryLink, TabBar, TabLink } from "./Tabs";
