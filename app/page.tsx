// The Bedaya website: Member 2's design, driven by real APIs (M4 backend, M5 identity/documents and AI).
// The interface is a small client-side app in public/bedaya/js (hash routes like #roadmap), so this page
// only provides the containers and loads it.
import Script from "next/script";
import "./site.css";

export default function Home() {
  return (
    <>
      <div id="app" aria-live="polite">
        <p className="boot">Bedaya · بداية</p>
      </div>
      <div id="toast" role="status" />
      <dialog id="modal" />
      <Script src="/bedaya/lucide.min.js" strategy="afterInteractive" />
      <Script src="/bedaya/js/main.js" type="module" strategy="afterInteractive" />
    </>
  );
}
