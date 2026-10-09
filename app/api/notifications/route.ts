// GET  /api/notifications → { notifications, unread }   (M3's bell)
// POST /api/notifications { id? } → mark one (or all) as read
import { NextRequest, NextResponse } from "next/server";
import { listNotifications, markRead, unreadCount } from "../../../lib/integrations/notify";
import { requireUser } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  return NextResponse.json({ notifications: listNotifications(s.id), unread: unreadCount(s.id) });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  markRead(s.id, body.id);
  return NextResponse.json({ unread: unreadCount(s.id) });
}
