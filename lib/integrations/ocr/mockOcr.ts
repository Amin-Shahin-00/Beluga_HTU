// MOCK OCR. Returns dummy OcrResult values (the shared shape in types.ts that
// Ameen's document checker reads) without reading the image, so the demo runs
// offline and never fails on stage. OCR_PROVIDER=mock is the only provider
// today; a Tesseract or cloud provider implements the same OcrProvider later.
//
// Test switches for the document checker, by file name:
//   contains "blurry"   → confidence 0.41, imageQuality 0.32 (blurry: below BLUR_THRESHOLDS)
//   contains "expired"  → expiryDate in the past
//   very small file (<8 KB) → confidence 0.68, imageQuality 0.55 (readable, not blurry)

import { demoUser, LAYLA_ID } from "../demoData";
import { BLUR_THRESHOLDS, type DocType, type OcrFields, type OcrProvider, type OcrResult } from "../types";

export function guessDocType(fileName: string): DocType {
  const n = fileName.toLowerCase();
  if (/(national|id[-_ .]|^id|هوية)/.test(n)) return "national_id";
  if (/(lease|rent|ايجار|إيجار)/.test(n)) return "lease_contract";
  if (/(approval|موافقة)/.test(n)) return "property_owner_approval";
  if (/(home|owner|deed|title|ملكية)/.test(n)) return "property_ownership_document";
  return "unknown";
}

/** True when the checker would call this result blurry (same rule as BLUR_THRESHOLDS). */
export function isBlurry(o: Pick<OcrResult, "confidence" | "imageQuality">) {
  return o.confidence < BLUR_THRESHOLDS.minConfidence || o.imageQuality < BLUR_THRESHOLDS.minImageQuality;
}

/** Label for screens: good / fair / poor. */
export function qualityLabel(o: Pick<OcrResult, "confidence" | "imageQuality">): "good" | "fair" | "poor" {
  if (isBlurry(o)) return "poor";
  return o.imageQuality >= 0.75 ? "good" : "fair";
}

export class MockOcr implements OcrProvider {
  async scan(
    file: { id: string; name: string; mimeType: string; bytes: Uint8Array },
    hint?: DocType,
    context?: { nationalId?: string },
  ): Promise<OcrResult> {
    const docType = hint && hint !== "unknown" ? hint : guessDocType(file.name);
    const name = file.name.toLowerCase();
    const user = demoUser(context?.nationalId ?? LAYLA_ID) ?? demoUser(LAYLA_ID)!;

    let confidence = 0.93;
    let imageQuality = 0.88;
    if (name.includes("blurry")) {
      confidence = 0.41;
      imageQuality = 0.32;
    } else if (file.bytes.length < 8 * 1024) {
      confidence = 0.68;
      imageQuality = 0.55;
    }

    let fields: OcrFields = {};
    switch (docType) {
      case "national_id":
        fields = {
          name: user.fullNameAr.value,
          nameEn: user.fullNameEn.value.toUpperCase(),
          nationalId: user.nationalId,
          birthDate: user.birthDate.value,
          expiryDate: name.includes("expired") ? "2025-08-01" : "2031-03-14",
          documentNumber: "DEMO" + user.nationalId.slice(-5),
        };
        break;
      case "lease_contract":
        fields = {
          name: user.fullNameAr.value,
          issueDate: "2026-09-01",
          expiryDate: name.includes("expired") ? "2025-12-31" : "2027-08-31",
        };
        break;
      case "property_ownership_document":
      case "property_owner_approval":
        fields = { name: user.fullNameAr.value, documentNumber: "DEMO-114" };
        break;
      default:
        confidence = Math.min(confidence, 0.3);
    }

    // Blurry images lose some fields, like real OCR would.
    if (isBlurry({ confidence, imageQuality })) {
      delete fields.birthDate;
      delete fields.nameEn;
    }

    return { fileId: file.id, fileName: file.name, docType, fields, confidence, imageQuality };
  }
}

let ocr: OcrProvider | null = null;
export function getOcrProvider(): OcrProvider {
  const mode = process.env.OCR_PROVIDER ?? "mock";
  if (mode !== "mock") throw new Error(`OCR_PROVIDER=${mode} is not available yet. Use OCR_PROVIDER=mock.`);
  return (ocr ??= new MockOcr());
}
