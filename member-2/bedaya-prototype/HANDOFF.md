# Bedaya: Member 2 Deliverables

Open `index.html` to use the bilingual clickable prototype offline. No installation, server, or internet is needed. Open `journeys.html` for the three user journeys. The original Arabic Bedaya logo is included.

The English Bedaya name sits centred below the Arabic logo at a smaller size, as requested.

## Completed Work

- Owner, partner, and admin interface designs across all 22 features.
- Eight-question onboarding wizard with validation, back navigation, saved answers, partner follow-up, and a review screen.
- Home-business roadmap, document upload/sample replacement, OCR review, signing consent, incubator selection, and bank submission confirmations.
- Assistant sample responses, notifications, appointment booking/cancellation, business-plan download, compliance calendar, illustrative map, funding filters, expert booking, and e-invoicing checklist.
- Partner inbox search, application review, request/approve/reject confirmation; admin tabs and editable sample value; synthetic analytics.
- Arabic/English layouts with a persistent language switch and mobile navigation.
- Shared bilingual copy, screen inventory, QA results, demo video, and documented journeys.

## Figma

[Editable Figma file](https://www.figma.com/design/tQdvrFCJxgSi9H7tsHu1Km)

The file contains 96 screen frames: 29 English owner screens, 29 Arabic owner screens, 8 partner/admin screens, and 30 mobile layouts. The design system contains semantic color/spacing/radius variables, bilingual type styles, and Button, Input, Status, and Card components.

Figma's Starter tool quota blocked a final layout repair after visual QA revealed clipped nested containers. The Figma file is a working design draft, not visually approved. The offline prototype is the reviewed demonstration deliverable. The logo in Figma is currently a text lockup; the supplied raster logo appears in the offline prototype.

`editable-screens/` now contains 132 standalone SVG designs: all 33 screens in Arabic and English, at desktop and mobile widths. These contain editable text, vector controls, and the supplied logo, rather than flattened screenshots. The representative SVG renders are in `qa/vector-*.png`. `manifest.json` maps every export to its screen and language. They can be imported into Figma without using the exhausted connector quota. Cloud import and final cloud verification have not been performed.

To repair the current Figma page with the included native plugin: in Figma desktop, choose Plugins > Development > Import plugin from manifest and select `figma-repair/manifest.json`. Run Bedaya Layout Repair on each page. Inspect the result after running. This plugin is supplied as a recovery aid and has not been executed in the live file.

## Demo Script

1. Open `index.html`; click Login with SANAD.
2. Review the sample identity and tick consent; continue.
3. Choose Home bakery, Irbid, From home, enter the business name, Just me, 2500, No employees yet, and Business account.
4. Review answers and create the roadmap.
5. Prepare documents; use the clear sample document; review extracted fields and confirm.
6. Review the signing list, tick consent, and sign all documents.
7. Select incubators and confirm submission; prepare the bank file and confirm sending.
8. Book a visit; open the Assistant from navigation and ask a question.
9. Switch to Partner using the header menu; review Layla's application and request a document.
10. Switch to Admin, review management tabs, and open Analytics.
11. Switch to Arabic and return to the owner roadmap.

## QA Scope And Open Items

`qa-results.json` and `qa-results.csv` record executed checks. Browser screenshots are in `qa/`. Laptop, Android-width, and iPhone-width checks use Chromium with viewport simulation. No physical Android/iPhone or Safari test was performed. Test the teammates' integrated live app separately when available.

The additional `qa-functional-results.json` and `.csv` record 184 passing checks of complete owner, partner, and admin flows in both languages at all three viewport sizes. These cover validation, consent, upload, OCR edits, cancellation, empty search results, partner decisions, downloading, mobile navigation, and persistence. The previous navigation timeout was caused by the test waiting for the URL before the new screen had rendered; the test now waits for the matching screen heading as well.

`qa-brand-results.json` records the requested logo arrangement passing at 1440, 390, and 320 pixel widths in both languages. All 132 SVG exports were successfully parsed, and representative desktop/mobile exports were rendered and visually inspected.

The prototype uses fictional data, partners, fees, deadlines, zoning results, OCR output, and assistant responses. SANAD and signing are explicitly mocked. Uploaded files remain local to the browser; the prototype stores the file name, not file contents. Financial, regulatory, and process facts require Member 1's verified data before real use.

Open items: repair or import into the cloud Figma file and visual recheck; physical Android/iPhone testing; confirmation of authoritative rules and fees by Member 1. The user confirmed that the team has not built the integrated application yet, so testing that application is deferred until it exists.

## Developer Handoff

`screens.js` contains the screen model and core bilingual copy. `bilingual-strings.json` and `.csv` provide the extracted shared strings. `screen-inventory.csv` maps each screen to the feature numbers. `style.css` and `typography.css` contain responsive dimensions and colors. `app.js` supplies the reversible demo interactions and local persistence.

Use the prototype's design and content when implementing the shared frontend. It deliberately does not connect to a production identity provider, backend, OCR service, bank, or signing service.
