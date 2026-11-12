import Experience from "@/components/Experience";
import { siteTheme } from "@/lib/sites";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { site } = await searchParams;
  return <Experience theme={siteTheme(site)} />;
}
