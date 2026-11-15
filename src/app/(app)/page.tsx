import { AskBackdrop } from "@/core/ui/sky/ShellBackdrop";
import { TodayScreen } from "@/core/ui/today/TodayScreen";

export default function TodayPage() {
  return (
    <>
      {/* Today stands on the full landscape (docs/tasarim/ilkeler.md, decision 2). */}
      <AskBackdrop kind={{ kind: "full" }} />
      <TodayScreen />
    </>
  );
}
