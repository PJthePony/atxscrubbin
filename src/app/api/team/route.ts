import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("team_members")
      .select("id, username, display_name, phone, email, google_calendar_id, role, active, created_at, updated_at")
      .order("created_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    if (!body.username || !body.password || !body.display_name) {
      return NextResponse.json(
        { error: "username, password, and display_name are required" },
        { status: 400 }
      );
    }

    const password_hash = await hashPassword(body.password);
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("team_members")
      .insert({
        username: body.username,
        password_hash,
        display_name: body.display_name,
        phone: body.phone || "",
        email: body.email || "",
        role: body.role || "member",
      })
      .select("id, username, display_name, phone, email, role, active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  });
}

export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;
    if (body.active !== undefined) updates.active = body.active;
    if (body.google_calendar_id !== undefined) updates.google_calendar_id = body.google_calendar_id;
    if (body.password) {
      updates.password_hash = await hashPassword(body.password);
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("team_members")
      .update(updates)
      .eq("id", body.id)
      .select("id, username, display_name, phone, email, role, active, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  });
}

export async function DELETE(request: NextRequest) {
  return withAdmin(async (session) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (id === session.sub) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("team_members").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  });
}
