import { checkDocuments } from "@/lib/integrations/document-checker";
import type { OcrResult } from "@/lib/integrations/types";
import { badRequest, isProfile, readJson } from "../../_shared";

const isOcr = (x: unknown): x is OcrResult => {
  const o = x as OcrResult;
  return Boolean(o?.fileId && o.docType && o.fields && typeof o.confidence === "number" && typeof o.imageQuality === "number");
};

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!isProfile(body?.profile)) return badRequest("profile (UserProfile) is required");
  if (!Array.isArray(body?.files) || !body.files.every(isOcr)) return badRequest("files must be an array of OcrResult");
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : undefined;

  return Response.json(await checkDocuments({ profile: body.profile, files: body.files, today }));
}
