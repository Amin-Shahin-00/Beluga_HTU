// GET /api/ai/reference → office and document names (Arabic + English) from M1's data, for the website.
import { knowledge } from "@/lib/integrations/knowledge";

export function GET() {
  const offices = Object.fromEntries(
    Object.values(knowledge.offices).map((o) => [o.id, { name: o.name, address: o.address, hours: o.hours, phone: o.phone, website: o.website }]),
  );
  const documents = Object.fromEntries(Object.values(knowledge.documents).map((d) => [d.id, { name: d.name, notes: d.notes, hasExpiry: d.hasExpiry }]));
  return Response.json({ version: knowledge.version, disclaimer: knowledge.disclaimer, offices, documents, sources: knowledge.sources });
}
