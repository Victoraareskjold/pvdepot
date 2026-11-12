import Planner from "@/components/Planner";
import { siteTheme } from "@/lib/sites";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { site } = await searchParams;
  return (
    <main>
      <Planner theme={siteTheme(site)} />
    </main>
  );
}
