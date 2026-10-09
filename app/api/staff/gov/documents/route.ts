// GET /api/staff/gov/documents → forms sent to the signed-in office (gov:<office> role).
import { NextResponse } from "next/server";
import { demoUser } from "../../../../../lib/integrations/demoData";
import { officeDocuments, verifySignature } from "../../../../../lib/integrations/documents";
import { OFFICES, type OfficeKey } from "../../../../../lib/integrations/offices";
import { getProfile } from "../../../../../lib/integrations/profile";
import { requireStaff } from "../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireStaff((r) => r.startsWith("gov:"));
  if ("error" in s) return s.error;
  const office = s.role.slice(4) as OfficeKey;
  const documents = officeDocuments(office).map((d) => {
    const user = demoUser(d.nationalId);
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      submittedAt: d.submittedAt,
      review: d.review,
      missingFields: d.missingFields ?? [],
      fileUrl: `/api/staff/gov/documents/${d.id}/file`,
      applicant: { nationalId: d.nationalId, nameAr: user?.fullNameAr.value ?? "", nameEn: user?.fullNameEn.value ?? "" },
      businessNameAr: getProfile(d.nationalId)?.businessNameAr.value ?? "",
      signature: verifySignature(d.id),
    };
  });
  return NextResponse.json({ office: { key: office, ...OFFICES[office] }, documents });
}
