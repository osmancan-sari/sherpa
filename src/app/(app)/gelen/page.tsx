import type { Metadata } from "next";
import { InboxScreen } from "@/core/ui/inbox/InboxScreen";

export const metadata: Metadata = { title: "Gelen kutusu" };

export default function InboxPage() {
  return <InboxScreen />;
}
