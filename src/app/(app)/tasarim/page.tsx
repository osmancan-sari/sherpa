import type { Metadata } from "next";
import { ClientOnly } from "@/core/ui/ClientOnly";
import { DesignGallery } from "@/core/ui/gallery/DesignGallery";

export const metadata: Metadata = { title: "Tasarım" };

/** The design gallery (docs/tasarim/README.md): signed in only, not in the menu. */
export default function DesignPage() {
  return (
    <ClientOnly>
      <DesignGallery />
    </ClientOnly>
  );
}
