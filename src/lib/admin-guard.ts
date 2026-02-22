import { NextResponse } from "next/server";
import { getAdminSession, AdminPayload } from "./auth";

export async function withAdmin(
  handler: (session: AdminPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handler(session);
}
