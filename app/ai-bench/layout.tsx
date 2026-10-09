// Ameen's M5 AI test bench (developer tool). The site itself is at /.
import "./bench.css";
import BackBar from "../components/BackBar";

export default function BenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackBar ar="منصة اختبار الذكاء الاصطناعي" en="AI test bench" />
      {children}
    </>
  );
}