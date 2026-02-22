import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  verifyPassword,
  signToken,
  getTokenCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: member, error } = await supabase
      .from("team_members")
      .select("id, username, password_hash, display_name, role, active")
      .eq("username", username)
      .single();

    if (error || !member) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!member.active) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, member.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signToken({
      sub: member.id,
      username: member.username,
      role: member.role,
    });

    const response = NextResponse.json({
      user: {
        id: member.id,
        username: member.username,
        display_name: member.display_name,
        role: member.role,
      },
    });

    const cookieOptions = getTokenCookieOptions(token);
    response.cookies.set(cookieOptions);

    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
