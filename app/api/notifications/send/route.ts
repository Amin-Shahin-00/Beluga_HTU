// POST /api/notifications/send { event, vars }
// For M4's roadmap and booking code (and the demo) to fire a notification.
// Events: step_changed | document_needed | visit_soon | forms_ready | documents_signed
import { NextRequest, NextResponse } from "next/server";
import { listOutbox, notify } from "../../../../lib/integrations/notify";
import type { NotificationEvent } from "../../../../lib/integrations/store";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS: NotificationEvent[] = [
  "step_changed",
  "document_needed",
  "visit_soon",
  "forms_ready",
  "documents_signed",
  "forms_submitted",
  "form_approved",
  "form_returned",
];

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { event?: NotificationEvent; vars?: Record<string, string | number> };
  if (!body.event || !EVENTS.includes(body.event)) {
    return NextResponse.json({ error: `event must be one of: ${EVENTS.join(", ")}` }, { status: 400 });
  }
  return NextResponse.json(notify(s.id, body.event, body.vars ?? {}), { status: 201 });
}

/** GET → the demo outbox (emails logged, WhatsApp would-send) for this user. */
export async function GET() {
  const s = await requireUser();
  if ("error" in s) return s.error;
  return NextResponse.json({ outbox: listOutbox().slice(0, 50) });
}
