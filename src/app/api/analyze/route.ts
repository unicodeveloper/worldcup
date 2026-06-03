import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMatchReport } from "@/lib/report";

const HOST_ADVANTAGE = 55;

const requestSchema = z.object({
  teamA: z.string().min(2).max(60),
  teamB: z.string().min(2).max(60),
  lineupConfirmed: z.boolean().optional().default(false),
  host: z.string().max(60).optional() // host nation (gets home advantage), if any
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Provide two valid team names." }, { status: 400 });
  }

  const { teamA, teamB, lineupConfirmed, host } = parsed.data;
  const a = teamA.trim();
  const b = teamB.trim();

  if (a.toLowerCase() === b.toLowerCase()) {
    return NextResponse.json({ error: "Choose two different teams." }, { status: 400 });
  }

  const homeAdvantage = host === a ? HOST_ADVANTAGE : host === b ? -HOST_ADVANTAGE : 0;

  try {
    const report = await buildMatchReport(a, b, lineupConfirmed, homeAdvantage);
    return NextResponse.json(report);
  } catch (error) {
    console.error("analyze failed", error);
    return NextResponse.json({ error: "Could not analyze this match right now." }, { status: 502 });
  }
}
