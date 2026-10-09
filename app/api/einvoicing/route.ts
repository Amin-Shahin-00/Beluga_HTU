// GET /api/einvoicing → content for the e-invoicing setup page (feature 21).
import { NextResponse } from "next/server";
import { EINVOICING_SETUP } from "../../../lib/integrations/einvoicing";

export function GET() {
  return NextResponse.json(EINVOICING_SETUP);
}
