// Fictional hackathon data only. Member 1 must replace and source it before real use.
export const demoRules = {
  version: "demo-v1", disclaimer: "Fictional demo steps, fees and durations; not verified Jordanian requirements.",
  steps: [
    { key: "profile", title_ar: "تأكيد ملف المشروع (تجريبي)", title_en: "Confirm business profile (demo)", office: "Bedaya demo", documents: ["identity", "address"], dependencies: [], fee: 0, days: 1, online: true },
    { key: "registration", title_ar: "التسجيل التجاري (تجريبي)", title_en: "Trade registration (demo)", office: "Demo trade registry", documents: ["identity"], dependencies: ["profile"], fee: 20, days: 2, legalForm: "sole", online: true },
    { key: "registration", title_ar: "تسجيل الشركة (تجريبي)", title_en: "Company registration (demo)", office: "Demo companies authority", documents: ["identity", "partner_details"], dependencies: ["profile"], fee: 50, days: 4, legalForm: "llc", online: true },
    { key: "home_check", title_ar: "فحص مسار العمل المنزلي (تجريبي)", title_en: "Home activity review (demo)", office: "Demo municipality", documents: ["address", "inspection_consent"], dependencies: ["registration"], fee: 5, days: 2, premises: "home" },
    { key: "shop_check", title_ar: "مراجعة موقع المحل (تجريبي)", title_en: "Shop location review (demo)", office: "Demo municipality", documents: ["address"], dependencies: ["registration"], fee: 10, days: 2, premises: "shop" },
    { key: "license", title_ar: "الترخيص المهني (تجريبي)", title_en: "Vocational licensing (demo)", office: "Demo licensing office", documents: ["registration", "address"], dependencies: ["registration"], fee: 25, days: 3 },
    { key: "tax", title_ar: "فتح الملف الضريبي (تجريبي)", title_en: "Tax file setup (demo)", office: "Demo tax authority", documents: ["registration"], dependencies: ["registration"], fee: 0, days: 1, online: true },
    { key: "social", title_ar: "التأمينات والضمان (تجريبي)", title_en: "Social security review (demo)", office: "Demo social security", documents: ["registration"], dependencies: ["registration"], fee: 0, days: 1, online: true },
  ],
};
export const demoPartners = [
  { key: "incubator-food", name_ar: "حاضنة الغذاء التجريبية", name_en: "Demo Food Incubator", kind: "incubator", cities: ["Irbid", "Amman", "إربد", "عمّان"], activities: ["bakery"], stages: ["idea", "new"], requirements: ["business_profile", "business_plan"], fictional: true },
  { key: "incubator-digital", name_ar: "حاضنة التجارة الرقمية التجريبية", name_en: "Demo Digital Incubator", kind: "incubator", cities: [], activities: ["online", "services"], stages: ["idea", "new", "operating"], requirements: ["business_profile"], fictional: true },
  { key: "incubator-general", name_ar: "حاضنة المشاريع الصغيرة التجريبية", name_en: "Demo Small Business Incubator", kind: "incubator", cities: [], activities: ["bakery", "retail", "online", "services"], stages: ["new", "operating"], requirements: ["business_profile", "business_plan"], fictional: true },
  { key: "bank-demo", name_ar: "البنك التجريبي", name_en: "Demo Bank", kind: "bank", cities: [], activities: ["bakery", "retail", "online", "services"], stages: ["new", "operating"], requirements: ["business_profile", "business_plan", "registration", "signed_documents"], fictional: true },
];
export const demoCompliance = [
  { key: "license-renewal", title_ar: "مراجعة تجديد الترخيص (موعد تجريبي)", title_en: "Review license renewal (demo date)", months: 12, office: "Demo municipality" },
  { key: "tax-review", title_ar: "مراجعة الالتزامات الضريبية (موعد تجريبي)", title_en: "Review tax obligations (demo date)", months: 3, office: "Demo tax authority" },
  { key: "social-review", title_ar: "مراجعة الضمان الاجتماعي (موعد تجريبي)", title_en: "Review social security (demo date)", months: 1, office: "Demo social security" },
];
