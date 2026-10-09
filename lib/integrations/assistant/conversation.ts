/** Small, transparent dialogue helpers for data mode; not a language model.
 * These prompts add no legal requirements, fee amounts, or funding decisions.
 */
import type { Lang } from '../types';
import type { EngineAnswer } from './engine';

type Turn = {role: 'user' | 'assistant'; content: string};
const bilingual = (lang: Lang, en: string, ar: string) => lang === 'ar' ? ar : en;
const activityPattern = /bakery|baker|cake|coffee|cafe|café|shop|clothing|retail|food|restaurant|design|software|online store|مخبز|حلويات|كيك|قهوة|مقهى|متجر|ملابس|مطعم|تصميم|برمجة/i;
const legalQuestion = /document|paper|licen[cs]|permit|regist|fee|cost|how much|how long|tax|where|allowed|can i|وثائق|وثايق|رخص|ترخيص|تسجيل|رسوم|تكلف|كم|ضريبة|وين|مسموح/i;

export function conversationAnswer(message: string, history: Turn[], lang: Lang): EngineAnswer | null {
 const text = message.trim();
 const lastAssistant = [...history].reverse().find(turn => turn.role === 'assistant')?.content ?? '';
 const previousUsers = history.filter(turn => turn.role === 'user').map(turn => turn.content).join(' ');
 const make = (en: string, ar: string): EngineAnswer => ({kind:'answer', text:bilingual(lang,en,ar), officeIds:[], sourceIds:[], matchedId:'conversation:clarify'});
 if (/^(thanks|thank you|thank u|شكرا|شكراً|يسلمو)[.!\s]*$/i.test(text)) {
  return make('You’re welcome! Would you like to discuss the next step, documents, or costs?', 'العفو! هل تريد الحديث عن الخطوة التالية أم الوثائق أم التكاليف؟');
 }
 // Keep currency as provided. Do not convert it or infer eligibility/affordability.
 const amount = text.match(/(?:\$\s*\d+(?:\.\d+)?|[\d٠-٩]+(?:\.[\d٠-٩]+)?\s*(?:dollars?|usd|jod|jd|dinars?|دولار|دينار))/i);
 if (amount && /\bi (?:only )?have\b|budget|capital|money|معي|عندي|ميزاني|راس مال|رأس مال/i.test(text) && !/licen[cs]|regist|fee|رسوم|رخص|تسجيل/i.test(text)) {
  return make(`You mentioned ${amount[0]}. Is that your total starting budget, or the amount you can spend now? What business do you want to start? I can help organize the next questions, but I can’t promise that this amount covers setup costs.`, `ذكرت ${amount[0]}. هل هذه ميزانيتك الكاملة للبدء أم المبلغ المتاح الآن؟ ما المشروع الذي تريد تأسيسه؟ يمكنني مساعدتك في تنظيم الأسئلة التالية، لكن لا أستطيع ضمان أن المبلغ يغطي تكاليف التأسيس.`);
 }
 if (/^(yes|yeah|yep|نعم|اه|آه|ايوه|أيوه)[.!\s]*$/i.test(text)) {
  if (/total starting budget|ميزانيتك الكاملة/.test(lastAssistant)) return make('Thanks. What business are you considering, and would you operate from home or a separate location?', 'شكراً. ما المشروع الذي تفكر فيه، وهل ستعمل من المنزل أم من موقع منفصل؟');
  return make('What would you like to go through next: your business idea, documents, or costs?', 'ما الذي تريد مناقشته الآن: فكرة مشروعك أم الوثائق أم التكاليف؟');
 }
 if (/^(and\s+)?(how much( is it| does it cost)?|what (is|are) the cost[s]?|كم( التكلفة| تكلف| الرسوم)?|قديش( التكلفة| بكلف)?)[?؟!.\s]*$/i.test(text)) {
  if (activityPattern.test(previousUsers) || /JOD|دينار/.test(lastAssistant)) return make('Which cost do you mean: business registration, activity-specific approval, or the location’s licence? The previous answer may mention several separate fees; tell me the step so I can focus on it.', 'أي تكلفة تقصد: تسجيل المشروع أم الموافقة الخاصة بالنشاط أم رخصة الموقع؟ قد يذكر الرد السابق عدة رسوم منفصلة؛ حدد الخطوة لأركز عليها.');
  return make('Which business or registration step are you asking about? Costs depend on the activity and the step, so I need that detail first.', 'عن أي مشروع أو خطوة تسجيل تسأل؟ تختلف التكاليف حسب النشاط والخطوة، لذلك أحتاج هذا التفصيل أولاً.');
 }
 const greeting = /^(hi|hello|hey|مرحبا|مرحباً|اهلا|أهلا|السلام عليكم)\b/i.test(text) || /^(مرحبا|مرحباً|اهلا|أهلا|السلام عليكم)/.test(text);
 const generalStart = /help me (?:with|start)|start (?:a|my) business|where (?:do|should) i start|how (?:do|can) i start|ساعدني|بدي ابدا|بدي أبدأ|ابدأ مشروع|أبدأ مشروع/.test(text.toLowerCase());
 if ((greeting || generalStart) && !activityPattern.test(text) && !legalQuestion.test(text)) {
  return make('Hi! I can help you explore starting a business in Jordan. What would you like to sell or offer, and will you work from home, online, or a separate location?', 'أهلاً! يمكنني مساعدتك في استكشاف بدء مشروع في الأردن. ماذا تريد أن تبيع أو تقدم، وهل ستعمل من المنزل أم عبر الإنترنت أم من موقع منفصل؟');
 }
 if (/^(where (?:do|should) i start|how (?:do|can) i start)[?!.\s]*$/i.test(text)) {
  return make('Let’s start with your idea. What product or service will you offer, and in which city? Then we can discuss the relevant registration questions.', 'لنبدأ بفكرتك. ما المنتج أو الخدمة التي ستقدمها، وفي أي مدينة؟ بعدها يمكننا مناقشة أسئلة التسجيل المناسبة.');
 }
 if (activityPattern.test(text) && !legalQuestion.test(text) && !/home|house|physical|online|منزل|بيت|محل|اونلاين|أونلاين/.test(text.toLowerCase()) && text.split(/\s+/).length < 20) {
  return make('Got it. Will you run that business from home, online, or in a separate shop? Which city? Those details help me choose the relevant information.', 'فهمت. هل ستعمل من المنزل أم عبر الإنترنت أم في محل منفصل؟ وفي أي مدينة؟ تساعدني هذه التفاصيل في اختيار المعلومات المناسبة.');
 }
 if (/^(how are you|كيفك|كيف حالك)[?؟!.\s]*$/i.test(text)) return make('I’m here to help with your business idea. What are you planning to start?', 'أنا هنا لمساعدتك بفكرة مشروعك. ما المشروع الذي تخطط لبدئه؟');
 return null;
}
