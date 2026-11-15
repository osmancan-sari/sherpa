import { redirect } from "next/navigation";

// Ç4c: the evening closing has no page of its own; it opens inside the evening's scene (or the
// standard scene shell from the evening card). An old link lands on Today.
export default function ClosingPage() {
  redirect("/");
}
