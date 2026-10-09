/* Local, fictional demo state only. No network requests or real authentication. */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const memory = {};
function read(key, fallback) { try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return memory[key] ?? fallback; } }
function save(key, value) { memory[key] = value; try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser storage is unavailable; this page still works.'); } }
function toast(message) { const box = $('#toast'); box.textContent = message; box.style.display = 'block'; clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => box.style.display = 'none', 3500); }
let language = read('language', 'en');
function setLanguage() { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; $$('[data-en]').forEach(el => { if (el.tagName === 'H1') el.innerHTML = el.dataset[language]; else el.textContent = el.dataset[language]; }); $('#language').textContent = language === 'ar' ? 'English' : 'العربية'; }
$('#language').addEventListener('click', () => { language = language === 'en' ? 'ar' : 'en'; save('language', language); setLanguage(); }); setLanguage();
const business = read('business', null);
if ($('#questionnaire')) {
 let step = 0; const form = $('#questionnaire');
 if (business) Object.entries(business).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value; });
 function showStep() { $$('[data-step]').forEach((el, i) => el.hidden = i !== step); $('#back').hidden = step === 0; $('#next').textContent = step === 2 ? 'See sample roadmap →' : 'Next →'; $('#step-label').textContent = `Step ${step + 1} of 3`; $('#form-progress').value = step + 1; }
 form.noValidate = true;
 form.addEventListener('submit', event => { event.preventDefault(); const fields = [...form.querySelector(`[data-step="${step}"]`).querySelectorAll('input, select, textarea')]; for (const field of fields) { if (field.name === 'idea') field.value = field.value.trim(); if (!field.reportValidity()) return; } if (step < 2) { step++; showStep(); form.querySelector(`[data-step="${step}"] select, [data-step="${step}"] input`).focus(); } else { save('business', Object.fromEntries(new FormData(form))); location.assign('/dashboard'); } });
 $('#back').addEventListener('click', () => { step--; showStep(); });
}
if ($('#business-name') && business) { $('#business-name').textContent = business.idea; $('#business-detail').textContent = `${business.type} · ${business.city} · ${business.model} · ${Number(business.budget).toLocaleString()} JOD sample budget`; }
if ($('#roadmap-progress')) {
 let checked = read('roadmap', []);
 function update() { const boxes = $$('.roadmap-check'); boxes.forEach(box => { box.checked = checked.includes(Number(box.dataset.index)); box.closest('.card').classList.toggle('completed', box.checked); box.closest('.card').querySelector('.status').textContent = box.checked ? 'Demo task complete' : 'To explore'; }); $('#roadmap-progress').value = checked.length; $('#progress-label').textContent = `${checked.length} of 5 complete`; const next = boxes.find(box => !box.checked); $('#next-action').textContent = next ? next.closest('.card').querySelector('label').textContent : 'Sample checklist complete'; }
 $$('.roadmap-check').forEach(box => box.addEventListener('change', () => { checked = $$('.roadmap-check').filter(box => box.checked).map(box => Number(box.dataset.index)); save('roadmap', checked); update(); })); update();
 $('#reset-demo').addEventListener('click', () => { checked = []; save('roadmap', []); save('funding', []); update(); toast('Local demo checklist progress reset.'); });
}
if ($('#document-file')) {
 let previewUrl = null;
 function clearFile() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; $('#file-preview').replaceChildren(); $('#clear-file').hidden = true; }
 $('#document-file').addEventListener('change', event => { clearFile(); const file = event.target.files[0]; if (!file) { $('#file-feedback').textContent = 'No file selected.'; return; } const valid = /\.(pdf|jpe?g|png)$/i.test(file.name) && ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type); if (!valid || file.size > 5 * 1024 * 1024 || file.size === 0) { $('#file-feedback').textContent = 'Choose a non-empty PDF, JPG, or PNG smaller than 5 MB.'; event.target.value = ''; return; } $('#file-feedback').textContent = `${file.name} · Selected locally, not uploaded or verified.`; $('#clear-file').hidden = false; if (file.type.startsWith('image/')) { previewUrl = URL.createObjectURL(file); const img = document.createElement('img'); img.src = previewUrl; img.alt = 'Local sample image preview'; $('#file-preview').append(img); } else { $('#file-preview').textContent = 'PDF selected. Content preview and analysis are not connected.'; } });
 $('#clear-file').addEventListener('click', () => { clearFile(); $('#document-file').value = ''; $('#file-feedback').textContent = 'Selection removed. No file was uploaded.'; });
 window.addEventListener('pagehide', clearFile);
}
if ($('#chat-form')) {
 const history = [];
 let busy = false;
 function bubble(text, kind) {
  const el = document.createElement('div'); el.className = `bubble ${kind}`;
  el.textContent = text; $('#messages').append(el);
  $('#messages').scrollTop = $('#messages').scrollHeight; return el;
 }
 function setBusy(value) {
  busy = value; $('#send').disabled = value; $('#chat-clear').disabled = value;
  $$('[data-question]').forEach(button => button.disabled = value);
  $('#chat-form').setAttribute('aria-busy', String(value));
 }
 function addLink(container, title, url) {
  if (typeof title !== 'string' || typeof url !== 'string') return;
  try {
   const parsed = new URL(url);
   if (!['https:', 'http:'].includes(parsed.protocol)) return;
   const link = document.createElement('a'); link.href = parsed.href;
   link.textContent = title; link.target = '_blank'; link.rel = 'noopener noreferrer';
   container.append(link);
  } catch { /* Ignore malformed external links. */ }
 }
 function renderAnswer(result, loading) {
  const labels = {mock: 'Team data answer · no live AI', llm: 'Live AI answer',
   cache: 'Saved model answer', fallback: 'Data fallback · live AI unavailable'};
  loading.textContent = result.answer;
  loading.dir = result.lang === 'ar' ? 'rtl' : 'ltr';
  const label = document.createElement('small'); label.className = 'answer-source';
  label.textContent = labels[result.source] || 'Team service answer'; loading.append(label);
  const links = document.createElement('div'); links.className = 'answer-links';
  if (Array.isArray(result.sources)) result.sources.forEach(source => {
   if (source && typeof source === 'object') addLink(links, source.title, source.url);
  });
  if (Array.isArray(result.offices)) result.offices.forEach(office => {
   if (office && typeof office === 'object') addLink(links, office.name, office.website);
  });
  if (links.childNodes.length) loading.append(links);
  if (typeof result.disclaimer === 'string') $('#chat-disclaimer').textContent = result.disclaimer;
 }
 $('#chat-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const input = $('#chat-input'); const message = input.value.trim();
  if (!message) { input.setCustomValidity('Please enter a question.'); input.reportValidity(); return; }
  if (message.length > 1000) return;
  bubble(message, 'user'); input.value = ''; setBusy(true);
  const loading = bubble('Waiting for Member 5’s service…', 'bot');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 18000);
  try {
   const response = await fetch('/api/chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message, history: history.slice(-10)}), signal: controller.signal
   });
   const result = await response.json();
   if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'The chatbot service is unavailable.');
   if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('The service returned no answer.');
   renderAnswer(result, loading);
   history.push({role: 'user', content: message}, {role: 'assistant', content: result.answer});
   if (history.length > 10) history.splice(0, history.length - 10);
  } catch (error) {
   loading.classList.add('chat-failure');
   loading.textContent = error.name === 'AbortError' ? 'The service took too long. Please try again.' : `No answer received: ${error.message}`;
   const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'language'; retry.textContent = 'Use this question again';
   retry.addEventListener('click', () => { input.value = message; input.setCustomValidity(''); input.focus(); }); loading.append(retry);
  } finally {
   clearTimeout(timer); setBusy(false); input.focus(); $('#messages').scrollTop = $('#messages').scrollHeight;
  }
 });
 $('#chat-input').addEventListener('input', event => event.target.setCustomValidity(''));
 $$('[data-question]').forEach(button => button.addEventListener('click', () => {
  if (busy) return; $('#chat-input').value = button.dataset.question;
  $('#chat-input').setCustomValidity(''); $('#chat-form').requestSubmit();
 }));
 $('#chat-clear').addEventListener('click', () => {
  history.length = 0; $('#messages').replaceChildren();
  bubble('Conversation cleared. Ask about starting a business in Jordan.', 'bot');
  $('#chat-disclaimer').textContent = 'No government endorsement. Confirm current requirements with the relevant authority.';
 });
}
if ($('#search-support')) {
 function filter() { const query = $('#search-support').value.toLowerCase().trim(); let visible = 0; $$('.support-card').forEach(card => { card.hidden = !(card.textContent.toLowerCase().includes(query) && (!$('#filter-city').value || card.dataset.city === $('#filter-city').value) && (!$('#filter-type').value || card.dataset.type === $('#filter-type').value)); if (!card.hidden) visible++; }); $('#support-empty').hidden = visible > 0; }
 ['#search-support', '#filter-city', '#filter-type'].forEach(id => $(id).addEventListener('input', filter));
 let shortlist = read('shortlist', []);
 function renderShortlist() { $$('.support-save').forEach(button => { const selected = shortlist.includes(button.dataset.name); button.textContent = selected ? 'Shortlisted ✓ · Remove' : 'Shortlist example +'; button.setAttribute('aria-pressed', selected); }); }
 $$('.support-save').forEach(button => button.addEventListener('click', () => { const name = button.dataset.name; shortlist = shortlist.includes(name) ? shortlist.filter(item => item !== name) : [...shortlist, name]; save('shortlist', shortlist); renderShortlist(); toast('Demo shortlist updated in this tab.'); })); renderShortlist();
}
if ($('#funding-name')) {
 if (business) { $('#funding-name').textContent = business.idea; $('#funding-details').textContent = `${business.type} · ${business.city} · ${Number(business.budget).toLocaleString()} JOD sample budget`; }
 let checked = read('funding', []); $$('.funding-check').forEach(box => box.checked = checked.includes(Number(box.dataset.index)));
 function updateFunding() { checked = $$('.funding-check').filter(box => box.checked).map(box => Number(box.dataset.index)); save('funding', checked); $('#funding-progress').textContent = `${checked.length} of 4 preparation items complete`; }
 $$('.funding-check').forEach(box => box.addEventListener('change', updateFunding)); updateFunding();
 $('#preview-funding').addEventListener('click', () => { $('#funding-preview').hidden = !$('#funding-preview').hidden; $('#preview-funding').textContent = $('#funding-preview').hidden ? 'Preview sample application →' : 'Close preview'; });
}
