// MOCK SANAD. Implements the three SANAD-ready interfaces with dummy data.
// Nothing here talks to the real SANAD; every screen it drives says "MOCK".

import { createHash, randomBytes } from "crypto";
import { hasConsent, logAccess, recordConsent } from "../consent";
import { MOCK_SANAD_PASSWORDS, demoUser } from "../demoData";
import { stampSignature } from "../pdf/sign";
import { find, insert, newId, now, update } from "../store";
import type {
  DocumentToSign,
  IdentityProvider,
  Payment,
  PaymentProvider,
  SanadScope,
  SanadUser,
  SignatureProvider,
  SignedDocument,
} from "../types";

const CODE_TTL_MS = 5 * 60 * 1000;

export class MockSanad implements IdentityProvider, SignatureProvider, PaymentProvider {
  readonly name = "mock_sanad" as const;

  // ------------------------------------------------------------ identity

  getLoginUrl(returnUrl: string, scopes: SanadScope[]) {
    const q = new URLSearchParams({ return: returnUrl, scopes: scopes.join(",") });
    return `/mock-sanad/login?${q}`;
  }

  /**
   * Called by the mock SANAD login page after the user picks a demo identity
   * and approves the consent screen. Real SANAD does this step on its side.
   */
  /** Mock credential check (the real SANAD checks its own credentials). Returns the person's name for the consent screen. */
  verify(nationalId: string, password: string): { nameAr: string; nameEn: string } {
    const user = demoUser(nationalId);
    if (!user || MOCK_SANAD_PASSWORDS[nationalId] !== password) throw new Error("National ID or SANAD password is incorrect");
    return { nameAr: user.fullNameAr.value, nameEn: user.fullNameEn.value };
  }

  authorize(nationalId: string, scopes: SanadScope[], password: string): string {
    this.verify(nationalId, password);
    recordConsent(nationalId, scopes, "sanad_login");
    const code = randomBytes(16).toString("hex");
    insert("mock_sanad_codes", {
      code,
      nationalId,
      scopes,
      expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      used: false,
    });
    return code;
  }

  async exchangeCode(code: string): Promise<SanadUser> {
    const row = find("mock_sanad_codes", (r) => r.code === code);
    if (!row) throw new Error("Invalid SANAD code");
    if (row.used) throw new Error("SANAD code already used");
    if (new Date(row.expiresAt).getTime() < Date.now()) throw new Error("SANAD code expired");
    update("mock_sanad_codes", (r) => r.code === code, { used: true });

    const scopes = row.scopes as SanadScope[];
    if (!hasConsent(row.nationalId, scopes)) throw new Error("No consent for requested data");
    const user = demoUser(row.nationalId)!;
    logAccess(row.nationalId, scopes, "sanad_login");

    // Return only what the user consented to.
    const out: SanadUser = {
      nationalId: user.nationalId,
      fullNameAr: user.fullNameAr,
      fullNameEn: user.fullNameEn,
      birthDate: user.birthDate,
      gender: user.gender,
    };
    if (scopes.includes("contact")) Object.assign(out, { phone: user.phone, email: user.email });
    if (scopes.includes("address")) Object.assign(out, { city: user.city, address: user.address });
    return out;
  }

  // ------------------------------------------------------------ signing

  async signDocuments(nationalId: string, docs: DocumentToSign[]): Promise<SignedDocument[]> {
    const user = demoUser(nationalId);
    if (!user) throw new Error("Unknown signer");
    logAccess(nationalId, ["identity"], "e_signature");

    const signedAt = now();
    const sessionRef = "MOCK-SIG-" + randomBytes(4).toString("hex").toUpperCase();
    const out: SignedDocument[] = [];
    for (const [i, doc] of docs.entries()) {
      const signatureRef = `${sessionRef}-${i + 1}`;
      const signedPdf = await stampSignature(doc.pdf, {
        nameAr: user.fullNameAr.value,
        nameEn: user.fullNameEn.value,
        nationalId,
        signedAt,
        signatureRef,
        originalHash: sha256(doc.pdf),
      });
      out.push({ documentId: doc.documentId, signedPdf, hash: sha256(signedPdf), signedAt, signatureRef });
    }
    return out;
  }

  // ------------------------------------------------------------ payments
  // Not in the M5 demo path yet; ready for paying government fees later.

  async createPayment(nationalId: string, amountJod: number, description: string): Promise<Payment> {
    const p: Payment = {
      paymentId: "MOCK-PAY-" + newId().slice(0, 8).toUpperCase(),
      nationalId,
      amountJod,
      description,
      status: "paid",
      createdAt: now(),
    };
    insert("payments", p);
    return p;
  }

  async getPayment(paymentId: string) {
    return find("payments", (p) => p.paymentId === paymentId) ?? null;
  }
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
