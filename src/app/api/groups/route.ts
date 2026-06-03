import { NextResponse } from "next/server";
import { buildGroupsView } from "@/lib/groups";

export async function GET() {
  try {
    const view = await buildGroupsView();
    return NextResponse.json(view);
  } catch (error) {
    console.error("groups failed", error);
    return NextResponse.json({ error: "Could not build the group view." }, { status: 502 });
  }
}
