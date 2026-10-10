import "server-only";
// Bedaya Copilot: an AI that studies the owner's business and prepares the work (a business brief, a
// launch plan, the paperwork). The human approves every piece before it counts (human in the loop).
// The AI only writes drafts from the context below; approvals are saved as versions by the owner.
import { createClient } from "@/lib/supabase/server";
import { summarize, type Task } from "@/lib/platform/team";
import { clientContext, describeClient, type ClientContext } from "@/lib/integrations/assistant/chatbot";
import { knowledge, office } from "@/lib/integrations/knowledge";
import { generate, parseJson, type LlmSource } from "@/lib/integrations/llm";
import { pick } from "@/lib/integrations/text";
import type { Lang, UserProfile } from "@/lib/integrations/types";

type Bi = { en: string; ar: string };
const L = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

// Offices whose forms Bedaya fills and the owner signs with SANAD inside Bedaya.
const E_SIGN_OFFICES = new Set(["MIT", "CCD", "GAM", "ISTD", "JFDA"]);

export interface PlanStep {
  key: string;
  order: number;
  title: string;
  office: { name: string; address: string; hours: string; phone: string; website: string };
  how: "esign" | "in_person" | "shop";
  sign: string;
  papers: string[];
  fee: string;
  time: string;
  tip: string;
  status: string;
}
export interface DocSpec {
  id: string;
  title: Bi;
  why: Bi;
  forStep: string | null;
}
export interface CopilotContext {
  lang: Lang;
  businessId: number;
  client: ClientContext;
  profile: UserProfile;
  steps: PlanStep[];
  writeDocs: DocSpec[];
  provide: { name: string; inVault: boolean }[];
}

/** Everything the copilot knows about the signed-in owner's business, read on the server. */
export async function copilotContext(lang: Lang): Promise<CopilotContext | null> {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data: biz } = await db.from("businesses").select("id").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!biz) return null;
  const [{ data: prof }, { data: tasks }, { data: vault }, client] = await Promise.all([
    db.from("bedaya_profiles").select("answers, submitted_at").eq("business_id", biz.id).maybeSingle(),
    db.from("bedaya_tasks").select("*").eq("business_id", biz.id).eq("user_id", auth.user.id),
    db.from("bedaya_documents").select("kind, filename, status").eq("business_id", biz.id).eq("user_id", auth.user.id),
    clientContext(lang),
  ]);
  if (!prof?.submitted_at || !client) return null;
  const profile = { ...(prof.answers as UserProfile), userId: auth.user.id };
  const sorted = ((tasks ?? []) as Task[]).sort((a, b) => Number(a.details.order) - Number(b.details.order));
  const status = summarize(sorted);
  const steps: PlanStep[] = sorted.map((t, i) => {
    const d = t.details as { fee?: { note?: Bi }; days?: { note?: Bi }; notes?: Bi };
    const o = office(t.office);
    const how: PlanStep["how"] = E_SIGN_OFFICES.has(t.office) ? "esign" : t.office === "SEAL" ? "shop" : "in_person";
    const officeName = o ? pick(o.name, lang) : t.office;
    return {
      key: t.step_key,
      order: i + 1,
      title: lang === "ar" ? t.title_ar : t.title_en,
      office: { name: officeName, address: o ? pick(o.address, lang) : "", hours: o?.hours ? pick(o.hours, lang) : "", phone: o?.phone ?? "", website: o?.website ?? "" },
      how,
      sign:
        how === "esign"
          ? L(lang, `Bedaya fills the form; you review it, sign with SANAD inside Bedaya, and it is sent to ${officeName}.`, `تملأ بداية النموذج؛ تراجعه وتوقعه عبر سند داخل بداية ويُرسل إلى ${officeName}.`)
          : how === "shop"
            ? L(lang, "No form to sign: order the business stamp at any seal shop.", "لا يوجد نموذج للتوقيع: اطلب ختم المنشأة من أي محل أختام.")
            : L(lang, `Sign the forms in person at ${officeName}; bring the original papers.`, `وقّع النماذج حضورياً لدى ${officeName}؛ أحضر الأوراق الأصلية.`),
      papers: (t.documents ?? []).map((id) => (knowledge.documents[id] ? pick(knowledge.documents[id].name, lang) : id)),
      fee: d.fee?.note ? pick(d.fee.note, lang) : "",
      time: d.days?.note ? pick(d.days.note, lang) : "",
      tip: d.notes ? pick(d.notes, lang) : "",
      status: t.status === "done" ? "done" : status.nextAction?.step_key === t.step_key ? "next" : "pending",
    };
  });
  const keys = new Set(steps.map((s) => s.key));
  const b = profile.business;
  const writeDocs: DocSpec[] = [
    { id: "activity_description", title: { en: "Business activity description", ar: "وصف نشاط المشروع" }, why: { en: "Needed on the commercial registry and licence forms.", ar: "مطلوب في نماذج السجل التجاري والرخصة." }, forStep: "register_sole_proprietorship" },
    ...(keys.has("reserve_trade_name") ? [{ id: "trade_name_options", title: { en: "Trade name options", ar: "خيارات الاسم التجاري" }, why: { en: "Three ready names in case your first choice is taken.", ar: "ثلاثة أسماء جاهزة إذا كان خيارك الأول محجوزاً." }, forStep: "reserve_trade_name" }] : []),
    ...(b.homeBased ? [{ id: "owner_consent_letter", title: { en: "Property owner approval letter", ar: "كتاب موافقة مالك العقار" }, why: { en: "The home-business licence needs the owner's written approval.", ar: "تحتاج رخصة المشروع المنزلي موافقة خطية من مالك العقار." }, forStep: "home_business_license" }] : []),
    ...(b.homeBased ? [{ id: "home_commitments", title: { en: "Home-business commitments summary", ar: "ملخص التزامات المشروع المنزلي" }, why: { en: "What you promise in the municipality's declaration and pledge.", ar: "ما تتعهد به في إقرار وتعهد البلدية." }, forStep: "home_business_license" }] : []),
    ...(b.sector === "food" ? [{ id: "jfda_product_sheet", title: { en: "Product and label sheet for JFDA", ar: "بيان المنتجات والملصق للغذاء والدواء" }, why: { en: "JFDA approves each product type and its label.", ar: "تعتمد مؤسسة الغذاء والدواء كل نوع منتج وملصقه." }, forStep: "jfda_home_food_license" }] : []),
    ...(client.matches.length ? [{ id: "funding_letter", title: { en: `Application letter to ${client.matches[0].name}`, ar: `رسالة تقديم إلى ${client.matches[0].name}` }, why: { en: "Your best funding match; a strong letter improves your chances.", ar: "أفضل برنامج تمويل يناسبك؛ رسالة قوية تزيد فرصك." }, forStep: null }] : []),
  ];
  const vaultKinds = new Set((vault ?? []).filter((v) => v.status === "ready").map((v) => v.kind as string));
  const KIND_OF: Record<string, string> = { national_id: "identity", rent_contract: "address", title_deed: "address", property_title_deed: "address" };
  const covered = /approval form|موافقة/i;
  const provide = [...new Set(sorted.filter((t) => t.status !== "done").flatMap((t) => t.documents ?? []))]
    .map((id) => ({ id, name: knowledge.documents[id] ? pick(knowledge.documents[id].name, lang) : id }))
    .filter((p) => !(b.homeBased && covered.test(p.name)))
    .map((p) => ({ name: p.name, inVault: Boolean(KIND_OF[p.id] && vaultKinds.has(KIND_OF[p.id])) }));
  return { lang, businessId: biz.id, client, profile, steps, writeDocs, provide };
}

function grounding(c: CopilotContext) {
  const p = c.profile;
  return `${describeClient(c.client, c.lang)}
Owner: ${p.personal.fullNameEn} / ${p.personal.fullNameAr}, ${p.personal.city}, phone ${p.personal.phone}.
Business description: ${p.business.description}. Customers: ${p.business.targetCustomers}. Stage: ${p.business.stage}. Wants a trade name: ${p.business.wantsTradeName ? "yes" : "no"}. Funding needed: ${p.business.fundingNeededJod} JOD.
Plan steps:
${c.steps.map((s) => `${s.order}. ${s.title} — ${s.office.name}; ${s.how === "esign" ? "e-sign in Bedaya" : s.how === "shop" ? "seal shop" : "in person"}; fee: ${s.fee || "none published"}; time: ${s.time || "?"}; papers: ${s.papers.join(", ") || "none"}`).join("\n")}`;
}

const RULES = (lang: Lang) => `Write in ${lang === "ar" ? "clear Modern Standard Arabic" : "clear, plain English"}. Use ONLY the facts given. Never invent fees, laws, names or numbers. Use the names, business, city and numbers given in the FACTS as they are; only when something is truly missing from the FACTS, write a placeholder in square brackets like [property address]. Use **bold** for headings and "- " for lists. No HTML.`;

async function write(task: string, system: string, user: string, fallback: string, maxTokens = 600) {
  const r = await generate({ task, system, messages: [{ role: "user", content: user }], fallback: () => fallback, maxTokens });
  return { draft: r.text.trim(), source: r.source as LlmSource };
}

// ---------------------------------------------------------------- 1. business brief
function briefFallback(c: CopilotContext) {
  const { lang, profile: p, client } = c;
  const total = client.progress ? `${client.progress.feeMin}–${client.progress.feeMax} ${L(lang, "JOD", "دينار")}` : "";
  const esign = c.steps.filter((s) => s.how === "esign").length;
  return L(
    lang,
    `**Your business**\n${client.business?.name}: ${p.business.description}. Customers: ${p.business.targetCustomers}.\n\n**Legal path**\nA ${p.business.legalForm.replace(/_/g, " ")}${p.business.homeBased ? " run from home, using the home-based licence track" : ""} in ${p.personal.city}.\n\n**What you need to open**\n${c.steps.map((s) => `- ${s.title} (${s.office.name})`).join("\n")}\n\n**Cost and time**\n- Official fees: about ${total}\n- ${c.steps.length} steps; ${esign} can be signed with SANAD inside Bedaya\n\n**Watch out for**\n${c.steps.filter((s) => s.tip).slice(0, 3).map((s) => `- ${s.tip}`).join("\n")}`,
    `**مشروعك**\n${client.business?.name}: ${p.business.descriptionAr || p.business.description}. العملاء: ${p.business.targetCustomersAr || p.business.targetCustomers}.\n\n**المسار القانوني**\n${p.business.legalForm === "sole_proprietorship" ? "مؤسسة فردية" : p.business.legalForm}${p.business.homeBased ? " تعمل من المنزل ضمن مسار الرخصة المنزلية" : ""} في ${p.personal.city}.\n\n**ما تحتاجه للافتتاح**\n${c.steps.map((s) => `- ${s.title} (${s.office.name})`).join("\n")}\n\n**الكلفة والمدة**\n- الرسوم الرسمية: حوالي ${total}\n- ${c.steps.length} خطوات؛ يمكن توقيع ${esign} منها عبر سند داخل بداية\n\n**انتبه إلى**\n${c.steps.filter((s) => s.tip).slice(0, 3).map((s) => `- ${s.tip}`).join("\n")}`,
  );
}
export async function writeBrief(c: CopilotContext, instruction?: string, current?: string) {
  const fallback = briefFallback(c);
  const system = `You are Saad, Bedaya's AI copilot and business-registration advisor in Jordan. Write a one-page brief that shows the owner you understand their business, with these sections: Your business; Legal path (and why it suits them); What you need to open; Cost and time; Watch out for (2–3 risks specific to them). About 150 words. ${RULES(c.lang)}\n\nFACTS:\n${grounding(c)}`;
  const user = instruction && current ? `Here is the current brief:\n${current}\n\nRevise it as the owner asks: ${instruction}` : "Write the business brief.";
  return write("copilot", system, user, instruction && current ? current : fallback, 450);
}

// ---------------------------------------------------------------- 2. launch plan + recommendations
function recommendationsFallback(c: CopilotContext): Bi[] {
  const p = c.profile.business;
  const out: Bi[] = [];
  if (c.steps.some((s) => s.key === "reserve_trade_name")) out.push({ en: "Register the trade name first, so your brand is protected before you print anything.", ar: "سجّل الاسم التجاري أولاً لحماية علامتك قبل طباعة أي شيء." });
  if (p.homeBased) out.push({ en: "Keep the work area within 15% of your home (max 25 m²) and inside closed rooms, so the municipality approves the home licence.", ar: "اجعل مساحة العمل ضمن 15% من المنزل (25 م² كحد أقصى) وداخل الغرف المغلقة لتوافق البلدية على الرخصة المنزلية." });
  if (c.client.matches[0]) out.push({ en: `Apply to ${c.client.matches[0].name}${c.client.matches[0].funding ? ` (${c.client.matches[0].funding})` : ""} once you are registered.`, ar: `قدّم إلى ${c.client.matches[0].name}${c.client.matches[0].funding ? ` (${c.client.matches[0].funding})` : ""} بعد التسجيل.` });
  out.push({ en: "Do the steps that need your signature with SANAD in Bedaya in one sitting to save visits.", ar: "وقّع الخطوات التي تتطلب توقيعك عبر سند في بداية دفعة واحدة لتوفير الزيارات." });
  out.push({ en: "Register yourself with Social Security as soon as the trader registration is done; it is mandatory for a working owner.", ar: "سجّل نفسك في الضمان الاجتماعي فور التسجيل كتاجر؛ هذا إلزامي للمالك العامل." });
  return out;
}
export async function writePlan(c: CopilotContext) {
  const fallback = recommendationsFallback(c);
  const system = `You are Saad, Bedaya's AI copilot. From the FACTS, give the owner 4 to 5 short, specific recommendations for doing their registration well: the best order, what to sign where, what suits their kind of business, and funding. Reply with JSON only: {"recommendations":["…", "…"]}. Each item one sentence. ${RULES(c.lang)}\n\nFACTS:\n${grounding(c)}`;
  const r = await generate({ task: "copilot", system, messages: [{ role: "user", content: "Give the recommendations as JSON." }], fallback: () => JSON.stringify({ recommendations: fallback.map((x) => (c.lang === "ar" ? x.ar : x.en)) }), maxTokens: 450 });
  const recs = parseJson<{ recommendations?: unknown[] }>(r.text)?.recommendations;
  const ok = Array.isArray(recs) && recs.filter((x) => typeof x === "string" && x.trim()).length >= 2;
  return {
    steps: c.steps,
    recommendations: ok ? (recs as string[]).filter((x) => typeof x === "string").slice(0, 6).map((x) => x.slice(0, 300)) : fallback.map((x) => (c.lang === "ar" ? x.ar : x.en)),
    source: (ok ? r.source : "mock") as LlmSource,
  };
}

// ---------------------------------------------------------------- 3. documents the AI writes
function docFallback(c: CopilotContext, id: string): string {
  const { lang, profile: p, client } = c;
  const biz = client.business?.name || p.business.nameEn;
  const today = new Date().toISOString().slice(0, 10);
  switch (id) {
    case "activity_description":
      return L(lang, `**Activity description**\n${biz} produces and sells ${p.business.description.toLowerCase().replace(/\.$/, "")}, ${p.business.homeBased ? "working from the owner's home" : "from its premises"} in ${p.personal.city}. Sales are to ${p.business.targetCustomers.toLowerCase().replace(/\.$/, "")}.\n\n**Main activities**\n- Production of ${p.business.sector === "food" ? "home-made food products" : "products/services"} by hand\n- Sale by pre-order and delivery to customers`, `**وصف النشاط**\n${biz}: ${p.business.descriptionAr || p.business.description}، ${p.business.homeBased ? "يعمل من منزل المالك" : "من مقر المشروع"} في ${p.personal.city}. البيع إلى ${p.business.targetCustomersAr || p.business.targetCustomers}.\n\n**الأنشطة الرئيسية**\n- ${p.business.sector === "food" ? "إنتاج منتجات غذائية منزلية يدوياً" : "تقديم المنتجات/الخدمات"}\n- البيع بالطلب المسبق والتوصيل للعملاء`);
    case "trade_name_options":
      return L(lang, `**Trade name options for the registry**\n1. ${p.business.nameEn} / ${p.business.nameAr} (your first choice)\n2. [Alternative name 1]\n3. [Alternative name 2]\n\nAsk the Commercial Registry to search the name first (10 JOD) if you're unsure it's free.`, `**خيارات الاسم التجاري للسجل**\n1. ${p.business.nameAr} / ${p.business.nameEn} (خيارك الأول)\n2. [اسم بديل 1]\n3. [اسم بديل 2]\n\nاطلب من السجل التجاري التحري عن الاسم أولاً (10 دنانير) إذا لم تكن متأكداً من توفره.`);
    case "owner_consent_letter":
      return L(lang, `**Property owner approval**\nDate: ${today}\n\nI, [owner's full name], national ID [owner's national ID], owner of the property at ${p.personal.city}, [full address], agree that ${p.personal.fullNameEn}, national ID [tenant's national ID], may run the home-based business "${biz}" in part of this property, within the limits of the home-business regulations.\n\nOwner's signature: ____________\nPhone: [owner's phone]`, `**موافقة مالك العقار**\nالتاريخ: ${today}\n\nأنا [اسم المالك الكامل]، الرقم الوطني [الرقم الوطني للمالك]، مالك العقار الكائن في ${p.personal.city}، [العنوان الكامل]، أوافق على أن يمارس ${p.personal.fullNameAr}، الرقم الوطني [الرقم الوطني للمستأجر]، المشروع المنزلي "${biz}" في جزء من هذا العقار ضمن حدود أنظمة المشاريع المنزلية.\n\nتوقيع المالك: ____________\nالهاتف: [هاتف المالك]`);
    case "home_commitments":
      return L(lang, `**What you commit to in the home-business pledge**\n- Use no more than 15% of the home, up to 25 m², inside closed rooms\n- No structural changes to the home\n- At most one employee working with you at home\n- Only a small sign (15 × 5 cm) on your door\n- Allow municipality inspections`, `**ما تتعهد به في تعهد المشروع المنزلي**\n- عدم استخدام أكثر من 15% من المنزل وبحد أقصى 25 م² داخل غرف مغلقة\n- عدم إجراء أي تعديلات إنشائية\n- موظف واحد كحد أقصى يعمل معك في المنزل\n- لافتة صغيرة فقط (15 × 5 سم) على الباب\n- السماح بتفتيش البلدية`);
    case "jfda_product_sheet":
      return L(lang, `**Products for JFDA approval**\n| Product | Main ingredients | Shelf life | Storage |\n- [Product 1] — [ingredients] — [days] — [how to store]\n- [Product 2] — [ingredients] — [days] — [how to store]\n\n**Label must show**\n- Product name, ingredients, net weight\n- Production and expiry dates\n- ${biz}, ${p.personal.city}, licence number`, `**المنتجات لاعتماد الغذاء والدواء**\n- [المنتج 1] — [المكونات] — [مدة الصلاحية] — [طريقة الحفظ]\n- [المنتج 2] — [المكونات] — [مدة الصلاحية] — [طريقة الحفظ]\n\n**يجب أن يظهر على الملصق**\n- اسم المنتج والمكونات والوزن الصافي\n- تاريخ الإنتاج والانتهاء\n- ${biz}، ${p.personal.city}، رقم الرخصة`);
    case "funding_letter":
      return L(lang, `Dear ${client.matches[0]?.name} team,\n\nI am ${p.personal.fullNameEn}, founder of ${biz} in ${p.personal.city}. ${p.business.description}. We serve ${p.business.targetCustomers.toLowerCase()}.\n\nI am applying for support of ${p.business.fundingNeededJod} JOD to grow production and reach more customers. My business is being registered through Bedaya with a full plan and documents.\n\nThank you for your consideration.\n${p.personal.fullNameEn} · ${p.personal.phone}`, `السادة فريق ${client.matches[0]?.name} المحترمين،\n\nأنا ${p.personal.fullNameAr}، مؤسسة ${biz} في ${p.personal.city}. ${p.business.descriptionAr || p.business.description}.\n\nأتقدم بطلب دعم بقيمة ${p.business.fundingNeededJod} دينار لتوسيع الإنتاج والوصول إلى عملاء أكثر. يجري تسجيل مشروعي عبر بداية مع خطة ومستندات كاملة.\n\nشاكرة حسن تعاونكم.\n${p.personal.fullNameAr} · ${p.personal.phone}`);
  }
  return "";
}
const DOC_BRIEF: Record<string, string> = {
  activity_description: "An official-style description of the business activity for the commercial registry and licence forms: one paragraph plus a short list of main activities. Formal, factual, 80–120 words.",
  trade_name_options: "Three trade-name options for registration (the owner's chosen name first, then two alternatives in the same spirit, each Arabic + English with a one-line meaning), and a note that the registry can search the name for 10 JOD.",
  owner_consent_letter: "A short formal letter in which the property owner approves running this home-based business in the property. Use placeholders for the owner's name, national ID and the full address. End with signature and phone lines.",
  home_commitments: "A checklist of what the owner commits to in the municipality's home-business declaration and pledge, from the facts (area limit, no structural changes, staff limit, small sign, inspections).",
  jfda_product_sheet: "A product sheet for JFDA approval: a list of the business's likely products with placeholders for ingredients, shelf life and storage, and what the label must show.",
  funding_letter: "A one-page application letter to the best-matching funding programme, explaining the business, the customers, the amount needed and how it will be used. Warm, confident, 150 words.",
};
export async function writeDoc(c: CopilotContext, id: string, instruction?: string, current?: string) {
  const spec = c.writeDocs.find((d) => d.id === id);
  if (!spec) return null;
  const fallback = docFallback(c, id);
  const system = `You are Saad, Bedaya's AI copilot, preparing paperwork for a business registration in Jordan. Write: ${DOC_BRIEF[id]} ${RULES(c.lang)}\n\nFACTS:\n${grounding(c)}`;
  const user = instruction && current ? `Here is the current draft:\n${current}\n\nRevise it as the owner asks: ${instruction}` : `Write the "${pick(spec.title, c.lang)}".`;
  return write("copilot", system, user, instruction && current ? current : fallback, 650);
}
