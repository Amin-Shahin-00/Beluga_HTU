// The one place the app gets its SANAD providers from.
// SANAD_MODE=mock (default) → MockSanad. SANAD_MODE=real → the real adapter,
// which will be written after MoDEE approval and implements the same interfaces.

import { MockSanad } from "./mockSanad";
import type { IdentityProvider, PaymentProvider, SignatureProvider } from "../types";

export type SanadMode = "mock" | "real";

export function sanadMode(): SanadMode {
  return process.env.SANAD_MODE === "real" ? "real" : "mock";
}

let mock: MockSanad | null = null;

function provider(): MockSanad {
  if (sanadMode() === "real") {
    throw new Error("Real SANAD adapter not available yet: waiting for MoDEE approval. Set SANAD_MODE=mock.");
  }
  return (mock ??= new MockSanad());
}

export const getIdentityProvider = (): IdentityProvider => provider();
export const getSignatureProvider = (): SignatureProvider => provider();
export const getPaymentProvider = (): PaymentProvider => provider();
/** Mock-only helpers (the mock login page needs authorize()). */
export const getMockSanad = (): MockSanad => provider();

export { MockSanad };
