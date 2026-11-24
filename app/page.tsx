import Experience from "@/components/Experience";
import { getDeadlines } from "@/lib/deadlines-server";
import { THEME } from "@/lib/sites";

/** Siden bygges på nytt minst én gang i timen, så fristene følger Enova. */
export const revalidate = 3600;

export default async function Page() {
  const deadlines = await getDeadlines();
  return <Experience theme={THEME} deadlines={deadlines} />;
}
