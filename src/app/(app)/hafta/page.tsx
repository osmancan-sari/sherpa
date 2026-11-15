import { redirect } from "next/navigation";

// Ç4c: the week is Takvim now (docs/tasarim/ekranlar/takvim.md); an old link goes there.
export default function WeekPage() {
  redirect("/takvim");
}
