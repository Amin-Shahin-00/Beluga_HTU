// Breadcrumb + "Back to main page" for the pages outside the main site (staff dashboards, mock SANAD,
// test benches), so none of them is a dead end. /#home opens the signed-in account's own main page.
import "./backbar.css";

export default function BackBar({ ar, en }: { ar: string; en: string }) {
  return (
    <div className="backbar" dir="rtl" lang="ar">
      <nav aria-label="مسار التنقل · Breadcrumb">
        <a href="/#entry">بداية · Bedaya</a>
        <span aria-hidden="true">‹</span>
        <span aria-current="page">
          {ar} · <span lang="en">{en}</span>
        </span>
      </nav>
      <a className="backbar-home" href="/#home">
        → العودة للصفحة الرئيسية · <span lang="en">Back to main page</span>
      </a>
    </div>
  );
}
