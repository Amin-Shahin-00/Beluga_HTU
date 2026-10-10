// Entry to the four party dashboards. Each party controls a different part of
// the journey; this page says who controls what.

const PARTIES = [
  {
    href: "/dashboard/client",
    accent: "#1a7f4d",
    whoAr: "صاحب المشروع",
    whoEn: "Business owner (e.g. Layla)",
    titleAr: "لوحة صاحب المشروع",
    titleEn: "Client dashboard",
    controls: [
      ["يسجل الدخول عبر سند ويوافق على مشاركة بياناته", "Logs in with SANAD and approves sharing data"],
      ["يرفع المستندات ويكتب أو يصحح معلومات المشروع", "Uploads documents, writes or fixes business info"],
      ["يوقّع كل النماذج ويرسلها للجهات الحكومية", "Signs all forms and sends them to government"],
      ["يتابع الحالة ويرى من اطّلع على بياناته", "Tracks status and sees who viewed their data"],
    ],
  },
  {
    href: "/dashboard/government",
    accent: "#2159b3",
    whoAr: "موظف جهة حكومية",
    whoEn: "Government office staff",
    titleAr: "لوحة الجهة الحكومية",
    titleEn: "Government office dashboard",
    controls: [
      ["يرى فقط النماذج المرسلة إلى جهته", "Sees only the forms sent to their office"],
      ["يتحقق من التوقيع وأن المستند لم يُعدَّل", "Checks the signature and that nothing changed"],
      ["يوافق أو يعيد النموذج مع ملاحظة", "Approves, or returns the form with a note"],
    ],
  },
  {
    href: "/dashboard/sanad",
    accent: "#8a5a00",
    whoAr: "وزارة الاقتصاد الرقمي والريادة",
    whoEn: "SANAD team at MoDEE",
    titleAr: "لوحة سند",
    titleEn: "SANAD (MoDEE) dashboard",
    controls: [
      ["يملك صفحة الدخول والتوقيع الإلكتروني", "Owns the login page and e-signature"],
      ["يسجّل كل موافقة وكل طلب دخول", "Records every consent and login request"],
      ["يقرر أي منصة شريكة يُسمح لها باستخدام سند", "Decides which partner platforms may use SANAD"],
    ],
  },
  {
    href: "/dashboard/admin",
    accent: "#6b7280",
    whoAr: "فريق بداية",
    whoEn: "Bedaya team",
    titleAr: "لوحة إدارة بداية",
    titleEn: "Bedaya admin dashboard",
    controls: [
      ["يتابع تقدّم كل متقدم والمشاكل", "Follows each applicant's progress and problems"],
      ["يرى سجل الرسائل (بريد / واتساب)", "Sees the message log (email / WhatsApp)"],
      ["لا يفتح ملفات المتقدمين الشخصية", "Does not open applicants' personal files"],
    ],
  },
];

export default function DashboardHub() {
  return (
    <>
      
      <div className="wrap wide">
        <div className="card">
          <h1>بداية · من يتحكم بماذا؟</h1>
          <div className="en">Bedaya: who controls what. One dashboard per party.</div>
        </div>
        <div className="grid">
          {PARTIES.map((p) => (
            <a key={p.href} href={p.href} className="card party" style={{ "--accent": p.accent } as React.CSSProperties}>
              <div className="who">
                {p.whoAr} · <span className="en" style={{ color: "inherit" }}>{p.whoEn}</span>
              </div>
              <h2 style={{ margin: 0 }}>{p.titleAr}</h2>
              <div className="en">{p.titleEn}</div>
              <ul>
                {p.controls.map(([ar, en]) => (
                  <li key={en}>
                    {ar}
                    <div className="en">{en}</div>
                  </li>
                ))}
              </ul>
            </a>
          ))}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h2>كيف يتنقل الطلب بين الأطراف</h2>
          <div className="en" style={{ marginBottom: 8 }}>How a case moves between the parties</div>
          <ol className="steps">
            <li>1 · سند: الدخول والموافقة<div className="en">SANAD: login + consent</div></li>
            <li>2 · العميل: المستندات والمعلومات<div className="en">Client: documents + info</div></li>
            <li>3 · بداية: تعبئة النماذج<div className="en">Bedaya: auto-fill forms</div></li>
            <li>4 · سند: التوقيع<div className="en">SANAD: signature</div></li>
            <li>5 · الجهة الحكومية: موافقة أو إعادة<div className="en">Office: approve or return</div></li>
          </ol>
          <p className="muted" style={{ marginTop: 10 }}>
            <a href="/m5-demo">وحدة اختبار M5 · M5 test console</a>
          </p>
        </div>
      </div>
    </>
  );
}
