import type { UserProfile } from "@/lib/integrations/types";

export const badRequest = (message: string) => Response.json({ error: message }, { status: 400 });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isProfile(x: unknown): x is UserProfile {
  const p = x as UserProfile;
  return Boolean(p?.userId && p.personal?.fullNameEn && p.business?.legalForm && p.business?.sector);
}
