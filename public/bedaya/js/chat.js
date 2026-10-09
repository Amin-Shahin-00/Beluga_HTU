// Bedaya's chatbot window: used full-size on the Assistant page and as a floating panel on every page.
// Answers stream from /api/ai/chat/stream. Everything the model writes is escaped first; only **bold**,
// "- " lists and [[page]] links to known Bedaya pages are turned into markup.
import { $, esc, go, lang, read, save, session, t, toast, tx } from "./core.js";

const PAGES = {
  roadmap: ["Your roadmap", "مسار مشروعك"], plan: ["Business plan", "خطة العمل"], location: ["Location check", "فحص الموقع"], compliance: ["Compliance", "الالتزامات"],
  documents: ["Documents", "المستندات"], signing: ["Sign forms", "توقيع النماذج"], incubators: ["Incubators", "الحاضنات"], funding: ["Funding", "التمويل"],
  bank: ["Bank file", "الملف البنكي"], experts: ["Book an expert", "حجز خبير"], appointments: ["Appointments", "المواعيد"], studio: ["Launch Studio", "استوديو الإطلاق"],
  "studio-site": ["Website builder", "منشئ الموقع"], services: ["Business tools", "أدوات الأعمال"], "services-hr": ["HR & payroll", "الموارد البشرية"], invoicing: ["E-invoicing", "الفوترة الإلكترونية"],
};
const MAX_TURNS = 16;
const history = () => read("chat", []);
const remember = (turns) => save("chat", turns.slice(-MAX_TURNS));

/** Safe formatting for model text: escape, then bold, lists, and [[page]] buttons. */
function format(raw) {
  const pages = [];
  let text = esc(raw).replace(/\[\[([a-z-]+)\]\]/g, (_, id) => {
    if (PAGES[id] && !pages.includes(id)) pages.push(id);
    return "";
  });
  text = text.replace(/\*\*([^*\n]{1,200})\*\*/g, "<strong>$1</strong>");
  const out = [];
  let list = null;
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (item) {
      list ??= [];
      list.push(`<li>${item[1]}</li>`);
      continue;
    }
    if (list) (out.push(`<ul>${list.join("")}</ul>`), (list = null));
    if (line.trim()) out.push(`<p>${line}</p>`);
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return { html: out.join(""), pages };
}

function engineLabel(engine) {
  if (!engine) return "";
  if (engine.provider === "ollama") return engine.ready ? t(`AI: ${engine.model} · open-source, runs on this computer`, `ذكاء اصطناعي: ${engine.model} · مفتوح المصدر ويعمل على هذا الجهاز`) : t("AI model is starting… answers from Bedaya's data meanwhile", "النموذج قيد التشغيل… الإجابات من بيانات بداية مؤقتاً");
  if (engine.provider === "anthropic") return t(`AI: ${engine.model}`, `ذكاء اصطناعي: ${engine.model}`);
  return t("Offline answers from Bedaya's verified data", "إجابات دون اتصال من بيانات بداية الموثقة");
}

/**
 * Mounts a chat into `root`. Options: { compact } for the floating panel.
 * Returns { focus } so the caller can focus the input.
 */
export function mountChat(root, { compact = false } = {}) {
  root.innerHTML = `<div class="chatbot ${compact ? "compact" : ""}">
      <div class="chat-head"><span class="chat-avatar" aria-hidden="true">ب</span><div><strong>${t("Bedaya Assistant", "مساعد بداية")}</strong><small id="chat-engine" class="muted"></small></div>
        <button type="button" class="chat-icon" id="chat-reset" title="${t("New conversation", "محادثة جديدة")}" aria-label="${t("New conversation", "محادثة جديدة")}"><i data-lucide="rotate-ccw"></i></button></div>
      <div class="chat-log" id="chat-log" aria-live="polite"></div>
      <div class="chips chat-suggest" id="chat-suggest"></div>
      <form class="chat-input" id="chat-form" novalidate>
        <textarea id="chat-q" rows="1" maxlength="1000" dir="auto" placeholder="${t("Ask about fees, papers, your next step…", "اسأل عن الرسوم أو الأوراق أو خطوتك التالية…")}" aria-label="${t("Your question", "سؤالك")}"></textarea>
        <button class="primary" id="chat-send" aria-label="${t("Send", "إرسال")}"><i data-lucide="send"></i></button>
      </form>
      <p class="chat-note">${t("AI can make mistakes. Fees and steps come from official Jordanian sources; confirm with the office before paying.", "قد يخطئ الذكاء الاصطناعي. الرسوم والخطوات من مصادر أردنية رسمية؛ تأكد من الجهة قبل الدفع.")}</p>
    </div>`;
  const log = $("#chat-log", root);
  const input = $("#chat-q", root);
  const sendBtn = $("#chat-send", root);
  let controller = null;

  function bubble(role, content = "") {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.dir = "auto";
    if (role === "user") el.textContent = content;
    else render(el, content);
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function render(el, content, meta) {
    const { html, pages } = format(content);
    const links = [...new Set([...(pages || []), ...((meta && meta.links) || [])])].filter((p) => PAGES[p]).slice(0, 3);
    el.innerHTML = `<div class="msg-body">${html || '<span class="typing"><i></i><i></i><i></i></span>'}</div>${
      links.length ? `<div class="msg-actions">${links.map((p) => `<button type="button" data-page="${p}">${esc(tx(PAGES[p]))} ${t("→", "←")}</button>`).join("")}</div>` : ""
    }${meta && (meta.sources?.length || meta.offices?.length) ? `<details class="msg-sources"><summary>${t("Sources", "المصادر")}</summary>${[...(meta.sources || []), ...(meta.offices || []).map((o) => ({ title: o.name, url: o.website }))].map((s) => (/^https?:\/\//.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : "")).join("")}</details>` : ""}${
      meta?.source === "fallback" ? `<small class="msg-meta">${t("Answered from Bedaya's data (AI model unavailable)", "إجابة من بيانات بداية (النموذج غير متاح)")}</small>` : ""
    }`;
    el.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => go(b.dataset.page)));
  }

  async function ask(question) {
    question = question.trim();
    if (!question || controller) return;
    $("#chat-suggest", root).hidden = true;
    const turns = history();
    bubble("user", question);
    input.value = "";
    input.style.height = "";
    const el = bubble("assistant", "");
    controller = new AbortController();
    sendBtn.innerHTML = '<i data-lucide="square"></i>';
    sendBtn.setAttribute("aria-label", t("Stop", "إيقاف"));
    window.lucide?.createIcons({ attrs: { width: 18, height: 18 } });
    let text = "";
    let meta = null;
    try {
      const res = await fetch("/api/ai/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, history: turns.slice(-8), lang }), signal: controller.signal });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t("The assistant is unavailable.", "المساعد غير متاح."));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.t) {
            text += msg.t;
            render(el, text);
            log.scrollTop = log.scrollHeight;
          }
          if (msg.done) meta = msg;
        }
      }
      render(el, text, meta);
      remember([...turns, { role: "user", content: question }, { role: "assistant", content: text }]);
    } catch (e) {
      if (e.name === "AbortError") {
        render(el, text || t("Stopped.", "تم الإيقاف."));
        if (text) remember([...turns, { role: "user", content: question }, { role: "assistant", content: text }]);
      } else {
        el.classList.add("failure");
        el.innerHTML = `<div class="msg-body"><p>${esc(e.message || t("Something went wrong.", "حدث خطأ ما."))}</p></div><div class="msg-actions"><button type="button">${t("Try again", "حاول مرة أخرى")}</button></div>`;
        el.querySelector("button").onclick = () => (el.remove(), log.lastElementChild?.remove(), ask(question));
      }
    } finally {
      controller = null;
      sendBtn.innerHTML = '<i data-lucide="send"></i>';
      sendBtn.setAttribute("aria-label", t("Send", "إرسال"));
      window.lucide?.createIcons({ attrs: { width: 18, height: 18 } });
      log.scrollTop = log.scrollHeight;
    }
  }

  async function start() {
    log.innerHTML = "";
    const turns = history();
    const w = await fetch(`/api/ai/chat/welcome?lang=${lang}`).then((r) => r.json()).catch(() => null);
    $("#chat-engine", root).textContent = engineLabel(w?.engine);
    bubble("assistant", w?.greeting || t("Hi! Ask me anything about starting your business in Jordan.", "أهلاً! اسألني أي شيء عن بدء مشروعك في الأردن."));
    for (const turn of turns) turn.role === "user" ? bubble("user", turn.content) : bubble("assistant", turn.content);
    const box = $("#chat-suggest", root);
    box.hidden = turns.length > 0;
    box.innerHTML = (w?.suggestions || []).map((s) => `<button type="button">${esc(s)}</button>`).join("");
    box.querySelectorAll("button").forEach((b) => (b.onclick = () => ask(b.textContent)));
  }

  $("#chat-form", root).onsubmit = (e) => {
    e.preventDefault();
    if (controller) return controller.abort();
    ask(input.value);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!controller) ask(input.value);
    }
  };
  input.oninput = () => {
    input.style.height = "";
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
  };
  $("#chat-reset", root).onclick = () => {
    if (controller) controller.abort();
    remember([]);
    start();
    toast(t("New conversation started.", "بدأت محادثة جديدة."));
  };
  start();
  window.lucide?.createIcons({ attrs: { width: 18, height: 18 } });
  return { focus: () => input.focus() };
}

/**
 * The floating "Ask Bedaya" button and panel, on every page except the Assistant page and staff accounts.
 * The panel survives page changes (the conversation stays open) and is rebuilt when the person changes.
 */
export function floatingChat(route) {
  const who = `${session.account?.id ?? "guest"}:${lang}`;
  let fab = document.getElementById("chat-fab");
  let panel = document.getElementById("chat-panel");
  if (panel && panel.dataset.who !== who) {
    fab.remove();
    panel.remove();
    fab = panel = null;
  }
  const hide = route === "assistant" || ["bank", "incubator", "expert", "admin"].includes(session.role);
  if (fab) {
    fab.hidden = hide;
    if (hide) ((panel.hidden = true), fab.classList.remove("open"));
    return;
  }
  if (hide) return;
  fab = document.createElement("button");
  fab.id = "chat-fab";
  fab.className = "chat-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", t("Ask Bedaya Assistant", "اسأل مساعد بداية"));
  fab.innerHTML = `<i data-lucide="message-circle"></i><span>${t("Ask Bedaya", "اسأل بداية")}</span>`;
  panel = document.createElement("div");
  panel.id = "chat-panel";
  panel.className = "chat-panel";
  panel.dataset.who = who;
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", t("Bedaya Assistant", "مساعد بداية"));
  document.body.append(fab, panel);
  let chat = null;
  fab.onclick = () => {
    panel.hidden = !panel.hidden;
    fab.classList.toggle("open", !panel.hidden);
    if (panel.hidden) return;
    if (!chat) {
      chat = mountChat(panel, { compact: true });
      const close = document.createElement("button");
      close.type = "button";
      close.className = "chat-icon chat-close";
      close.setAttribute("aria-label", t("Close", "إغلاق"));
      close.innerHTML = '<i data-lucide="x"></i>';
      close.onclick = () => fab.click();
      panel.querySelector(".chat-head").append(close);
      window.lucide?.createIcons({ attrs: { width: 18, height: 18 } });
    }
    chat.focus();
  };
  window.lucide?.createIcons({ attrs: { width: 18, height: 18 } });
}