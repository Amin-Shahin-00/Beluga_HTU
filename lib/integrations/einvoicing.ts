// E-invoicing readiness (feature 21, Screens only).
// Content for M2/M3's setup page. DEMO CONTENT: written as a placeholder for
// M1's research note on JoFotara (Jordan's national e-invoicing system, run by
// the Income and Sales Tax Department). Check every line against that note
// before the pitch. No backend: the page shows these steps and a form.

export interface EinvoicingStep {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  /** Which Bedaya step must be done first, if any. */
  needs?: string;
}

export interface EinvoicingField {
  key: string;
  labelAr: string;
  labelEn: string;
  type: "text" | "select" | "readonly";
  options?: { value: string; ar: string; en: string }[];
  /** Pre-filled from the user's profile when available. */
  prefillFrom?: string;
}

export const EINVOICING_SETUP = {
  demo: true,
  titleAr: "الاستعداد للفوترة الإلكترونية",
  titleEn: "Get ready for e-invoicing",
  introAr: "اربط نشاطك بنظام الفوترة الإلكترونية الوطني (جو فوترة) لإصدار فواتير معتمدة من دائرة ضريبة الدخل والمبيعات.",
  introEn: "Connect your business to Jordan's national e-invoicing system (JoFotara) so your invoices are recognised by the Income and Sales Tax Department.",
  steps: [
    {
      titleAr: "احصل على رقمك الضريبي",
      titleEn: "Get your tax number",
      bodyAr: "يتم ذلك ضمن خطوة التسجيل لدى ضريبة الدخل والمبيعات في خارطة الطريق.",
      bodyEn: "This happens in the Income and Sales Tax registration step of your roadmap.",
      needs: "tax_registration",
    },
    {
      titleAr: "سجّل في نظام الفوترة",
      titleEn: "Register on the e-invoicing system",
      bodyAr: "ادخل إلى بوابة الفوترة الوطنية باستخدام بيانات حسابك الضريبي.",
      bodyEn: "Sign in to the national e-invoicing portal with your tax account details.",
    },
    {
      titleAr: "اختر طريقة إصدار الفواتير",
      titleEn: "Choose how you will invoice",
      bodyAr: "إما إدخال الفواتير يدويًا عبر البوابة، أو ربط برنامج المحاسبة أو نقاط البيع.",
      bodyEn: "Either enter invoices by hand on the portal, or connect your accounting or point-of-sale software.",
    },
    {
      titleAr: "اربط برنامجك (اختياري)",
      titleEn: "Connect your software (optional)",
      bodyAr: "إذا اخترت الربط، احصل على بيانات الربط من البوابة وأعطها لمزوّد برنامجك.",
      bodyEn: "If you chose to connect software, get the connection details from the portal and give them to your software provider.",
    },
    {
      titleAr: "أصدر فاتورة تجريبية",
      titleEn: "Issue a test invoice",
      bodyAr: "تأكد أن الفاتورة تظهر برمز QR وأنها مسجّلة في النظام.",
      bodyEn: "Check the invoice shows a QR code and appears in the system.",
    },
  ] as EinvoicingStep[],
  fields: [
    { key: "taxNumber", labelAr: "الرقم الضريبي", labelEn: "Tax number", type: "readonly", prefillFrom: "tax_registration.taxNumber" },
    { key: "businessNameAr", labelAr: "الاسم التجاري", labelEn: "Business name", type: "readonly", prefillFrom: "profile.businessNameAr" },
    {
      key: "salesTaxRegistered",
      labelAr: "هل أنت مسجّل في ضريبة المبيعات؟",
      labelEn: "Registered for sales tax?",
      type: "select",
      options: [
        { value: "yes", ar: "نعم", en: "Yes" },
        { value: "no", ar: "لا", en: "No" },
        { value: "unsure", ar: "لست متأكدًا", en: "Not sure" },
      ],
    },
    {
      key: "method",
      labelAr: "طريقة إصدار الفواتير",
      labelEn: "Invoicing method",
      type: "select",
      options: [
        { value: "portal", ar: "يدويًا عبر البوابة", en: "By hand on the portal" },
        { value: "software", ar: "ربط برنامج محاسبة / نقاط بيع", en: "Connect accounting / POS software" },
      ],
    },
    { key: "softwareName", labelAr: "اسم البرنامج (إن وجد)", labelEn: "Software name (if any)", type: "text" },
    { key: "contactEmail", labelAr: "بريد التواصل", labelEn: "Contact email", type: "readonly", prefillFrom: "profile.email" },
  ] as EinvoicingField[],
  disclaimerAr: "محتوى تجريبي لأغراض العرض. تحقّق من الخطوات مع دائرة ضريبة الدخل والمبيعات.",
  disclaimerEn: "Demo content for the hackathon. Confirm the steps with the Income and Sales Tax Department.",
};
