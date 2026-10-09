// The published-site template (D3), shared by the public page (/s/<slug>) and the builder's live
// preview (/site-preview). React escapes every text value; the logo is re-sanitised; images are data URLs.
import type { Site } from "@/lib/studio/site";
import { sanitizeSvg } from "@/lib/studio/svg";
import ContactForm from "./ContactForm";
import "./public-site.css";

// Brand fonts are self-hosted (public/vendor/fonts); the browser downloads only the two this site uses.
const FONT_CSS = "/vendor/fonts/fonts.css";

export default function SiteView({ site, slug, lang, preview = false }: { site: Site; slug: string; lang: "ar" | "en"; preview?: boolean }) {
  const t = (v: { en: string; ar: string }) => (lang === "ar" ? v.ar || v.en : v.en || v.ar);
  const logo = site.theme.logo ? sanitizeSvg(site.theme.logo) : null;
  const wa = site.contact.whatsapp ? `https://wa.me/${site.contact.whatsapp}` : null;
  const style = {
    "--p": site.theme.primary,
    "--a": site.theme.accent,
    "--d": site.theme.dark,
    "--l": site.theme.light,
    "--font": `'${lang === "ar" ? site.theme.fontArabic : site.theme.fontLatin}', '${site.theme.fontArabic}', system-ui, sans-serif`,
  } as React.CSSProperties;
  const s = site.sections;
  const products = site.products.filter((p) => p.name.en || p.name.ar);
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return (
    <div className="ps" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} style={style}>
      <link rel="stylesheet" href={FONT_CSS} precedence="default" />
      <header className="ps-head">
        <a href="#top" className="ps-brand">
          {logo && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`} alt="" width={44} height={44} />}
          <strong>{t(site.name)}</strong>
        </a>
        <nav>
          {s.about && <a href="#about">{L("About", "من نحن")}</a>}
          {s.products && products.length > 0 && <a href="#products">{site.kind === "store" ? L("Shop", "المتجر") : L("Services", "الخدمات")}</a>}
          {s.contact && <a href="#contact">{L("Contact", "تواصل")}</a>}
          {!preview && <a className="ps-lang" href={`?lang=${lang === "ar" ? "en" : "ar"}`}>{lang === "ar" ? "English" : "العربية"}</a>}
        </nav>
      </header>

      <section className="ps-hero" id="top">
        <h1>{t(site.hero.title)}</h1>
        {t(site.hero.subtitle) && <p>{t(site.hero.subtitle)}</p>}
        {wa ? (
          <a className="ps-btn" href={wa} target="_blank" rel="noopener noreferrer">{t(site.hero.cta)}</a>
        ) : (
          s.contact && <a className="ps-btn" href="#contact">{t(site.hero.cta)}</a>
        )}
      </section>

      {s.about && (
        <section className="ps-sec" id="about">
          <h2>{t(site.about.title)}</h2>
          <p className="ps-body">{t(site.about.body)}</p>
        </section>
      )}

      {s.products && products.length > 0 && (
        <section className="ps-sec" id="products">
          <h2>{site.kind === "store" ? L("Shop", "المتجر") : L("What we offer", "ما نقدمه")}</h2>
          <div className="ps-grid">
            {products.map((p, i) => (
              <article key={i} className="ps-card">
                <h3>{t(p.name)}</h3>
                {t(p.description) && <p>{t(p.description)}</p>}
                <div className="ps-row">
                  {p.price !== null && <span className="ps-price">{p.price} {L("JOD", "دينار")}</span>}
                  {wa && site.kind === "store" && (
                    <a className="ps-small" href={`${wa}?text=${encodeURIComponent(`${L("I'd like to order", "أرغب بطلب")}: ${t(p.name)}`)}`} target="_blank" rel="noopener noreferrer">
                      {L("Order", "اطلب")}
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {s.gallery && site.gallery.length > 0 && (
        <section className="ps-sec">
          <h2>{L("Gallery", "معرض الصور")}</h2>
          <div className="ps-gallery">
            {site.gallery.map((g, i) => (
              <figure key={i}>
                {g.image ? <img src={g.image} alt={t(g.caption)} /> : <div className="ps-tile" aria-hidden="true" data-i={i % 3} />}
                {t(g.caption) && <figcaption>{t(g.caption)}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {s.map && site.map && (
        <section className="ps-sec">
          <h2>{L("Find us", "موقعنا")}</h2>
          <iframe
            className="ps-map"
            title={L("Map", "الخريطة")}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${site.map.lng - 0.006}%2C${site.map.lat - 0.004}%2C${site.map.lng + 0.006}%2C${site.map.lat + 0.004}&layer=mapnik&marker=${site.map.lat}%2C${site.map.lng}`}
          />
          <p className="ps-muted">
            {t(site.contact.address)} ·{" "}
            <a href={`https://www.openstreetmap.org/?mlat=${site.map.lat}&mlon=${site.map.lng}#map=17/${site.map.lat}/${site.map.lng}`} target="_blank" rel="noopener noreferrer">
              {L("Open the map", "افتح الخريطة")}
            </a>
          </p>
        </section>
      )}

      {s.contact && (
        <section className="ps-sec" id="contact">
          <h2>{L("Contact us", "تواصل معنا")}</h2>
          <div className="ps-contact">
            <ul>
              {site.contact.phone && (
                <li>
                  {L("Phone", "الهاتف")}: <a href={`tel:${site.contact.phone.replace(/[^\d+]/g, "")}`} dir="ltr">{site.contact.phone}</a>
                </li>
              )}
              {site.contact.email && (
                <li>
                  {L("Email", "البريد")}: <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
                </li>
              )}
              {t(site.contact.address) && <li>{L("Address", "العنوان")}: {t(site.contact.address)}</li>}
              {t(site.contact.hours) && <li>{L("Hours", "ساعات العمل")}: {t(site.contact.hours)}</li>}
            </ul>
            <ContactForm slug={slug} lang={lang} preview={preview} />
          </div>
        </section>
      )}

      <footer className="ps-foot">
        © {new Date().getFullYear()} {t(site.name)} · {L("Made with Bedaya", "صُنع مع بداية")}
      </footer>
      {wa && (
        <a className="ps-wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.1.1.7-.2 1.4z" />
          </svg>
        </a>
      )}
    </div>
  );
}
