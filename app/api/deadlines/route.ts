import { NextResponse } from "next/server";
import { getDeadlines } from "@/lib/deadlines-server";

/** Fristlisten med kilde og tidspunkt. Siden henter den på nytt når en frist passeres. */
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getDeadlines());
}
