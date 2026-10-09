// Smart notifications (feature 11, Prototype level).
// In-app: a row in `notifications` (M3's bell reads it).
// Email: written to `outbox` as "logged". Nothing is actually sent in the demo.
// WhatsApp: written to `outbox` as "would_send". Never sent.

import { demoUser } from "./demoData";
import { getProfile } from "./profile";
import { insert, list, newId, now, update, type NotificationEvent, type NotificationRow } from "./store";

type Vars = Record<string, string | number>;

const TEMPLATES: Record<NotificationEvent, { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; link?: string }> = {
  step_changed: {
    titleAr: "تم تحديث خطوة",
    titleEn: "A step was updated",
    bodyAr: "أصبحت خطوة \"{stepAr}\" بحالة: {statusAr}.",
    bodyEn: "\"{stepEn}\" is now: {statusEn}.",
    link: "/roadmap",
  },
  document_needed: {
    titleAr: "مطلوب مستند",
    titleEn: "A document is needed",
    bodyAr: "يرجى رفع {docAr} لإكمال خطوة \"{stepAr}\".",
    bodyEn: "Please upload your {docEn} to finish \"{stepEn}\".",
    link: "/documents",
  },
  visit_soon: {
    titleAr: "موعد زيارة قريب",
    titleEn: "Visit coming up",
    bodyAr: "لديك موعد في {placeAr} بتاريخ {date} الساعة {time}.",
    bodyEn: "You have a visit at {placeEn} on {date} at {time}.",
    link: "/appointments",
  },
  forms_ready: {
    titleAr: "نماذجك جاهزة",
    titleEn: "Your forms are ready",
    bodyAr: "تم تعبئة {count} نماذج تلقائيًا. راجعها ثم وقّعها كلها مرة واحدة.",
    bodyEn: "{count} forms were filled in for you. Review them, then sign them all at once.",
    link: "/documents",
  },
  documents_signed: {
    titleAr: "تم توقيع المستندات",
    titleEn: "Documents signed",
    bodyAr: "تم توقيع {count} مستندات عبر سند (تجريبي).",
    bodyEn: "{count} documents were signed via SANAD (mock).",
    link: "/documents",
  },
  forms_submitted: {
    titleAr: "تم إرسال النماذج",
    titleEn: "Forms submitted",
    bodyAr: "تم إرسال {count} نماذج موقّعة إلى الجهات الحكومية المختصة. سنخبرك عند الرد.",
    bodyEn: "{count} signed forms were sent to the government offices. We'll tell you when they reply.",
    link: "/documents",
  },
  form_approved: {
    titleAr: "تمت الموافقة على نموذج",
    titleEn: "Form approved",
    bodyAr: "وافقت {officeAr} على \"{formAr}\".",
    bodyEn: "{officeEn} approved \"{formEn}\".",
    link: "/documents",
  },
  form_returned: {
    titleAr: "نموذج يحتاج تعديلًا",
    titleEn: "Form returned for changes",
    bodyAr: "أعادت {officeAr} \"{formAr}\": {note}",
    bodyEn: "{officeEn} returned \"{formEn}\": {note}",
    link: "/documents",
  },
};

function fill(text: string, vars: Vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export interface NotifyResult {
  notification: NotificationRow;
  emailLogged: boolean;
  whatsappLogged: boolean;
}

export function notify(nationalId: string, event: NotificationEvent, vars: Vars = {}): NotifyResult {
  const t = TEMPLATES[event];
  const row: NotificationRow = {
    id: newId(),
    nationalId,
    event,
    titleAr: fill(t.titleAr, vars),
    titleEn: fill(t.titleEn, vars),
    bodyAr: fill(t.bodyAr, vars),
    bodyEn: fill(t.bodyEn, vars),
    link: t.link,
    read: false,
    createdAt: now(),
  };
  insert("notifications", row);

  const user = demoUser(nationalId);
  const email = user?.email?.value ?? getProfile(nationalId)?.email.value;
  const phone = user?.phone?.value ?? getProfile(nationalId)?.phone.value;

  if (email) {
    insert("outbox", {
      id: newId(),
      channel: "email",
      to: email,
      subject: `Bedaya: ${row.titleEn} | ${row.titleAr}`,
      body: `${row.bodyAr}\n\n${row.bodyEn}`,
      status: "logged",
      createdAt: now(),
    });
  }
  if (phone) {
    insert("outbox", {
      id: newId(),
      channel: "whatsapp",
      to: phone,
      body: `${row.titleAr}: ${row.bodyAr}`,
      status: "would_send",
      createdAt: now(),
    });
  }
  return { notification: row, emailLogged: !!email, whatsappLogged: !!phone };
}

export function listNotifications(nationalId: string) {
  return list("notifications", (n) => n.nationalId === nationalId).reverse();
}

export function unreadCount(nationalId: string) {
  return list("notifications", (n) => n.nationalId === nationalId && !n.read).length;
}

/** Mark one notification read, or all of them when id is omitted. */
export function markRead(nationalId: string, id?: string) {
  return update("notifications", (n) => n.nationalId === nationalId && (!id || n.id === id), { read: true });
}

export function listOutbox(to?: string) {
  return list("outbox", (o) => !to || o.to === to).reverse();
}
