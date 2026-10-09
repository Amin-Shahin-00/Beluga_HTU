// M5 screens are Arabic-first (right to left) inside the shared English layout.
// The .m5 wrapper scopes M5's styles (app/m5.css) to these pages only.
import "../m5.css";
import BackBar from "../components/BackBar";

export default function M5Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m5" dir="rtl" lang="ar">
      <BackBar ar="سند التجريبي" en="Mock SANAD" />
      {children}
    </div>
  );
}