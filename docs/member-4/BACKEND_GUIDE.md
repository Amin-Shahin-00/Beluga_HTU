# Bedaya backend — current milestone

## التشغيل

من PowerShell داخل `C:\Users\alkht\bedaya-backend`:

```powershell
npm.cmd install
npm.cmd run dev
```

افتح http://localhost:3000. صفحة البداية توفر إنشاء حساب وتسجيل الدخول وإضافة مشروع وعرض مشاريع المستخدم.
متغيرات `.env.local` المطلوبة: `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
لا تضع service-role key في التطبيق. لا ترسل محتويات ملفات البيئة في الدردشة.

## إعداد Supabase قبل الحفظ

1. افتح مشروع bedaya في Supabase ثم SQL Editor.
2. شغّل `supabase/migrations/202610090001_business_ownership.sql`.
3. السكربت يحافظ على الصفوف القديمة ويشغّل RLS. الصفوف دون صاحب تبقى مخفية، ولا يُخمن صاحبها.
4. إن ظهر خطأ عن identity في `id`، يتراجع السكربت عن كل التغييرات. تحقق من عمود id قبل إصلاحه؛ لا تحذف البيانات.
5. تأكد أن Email provider وتأكيد البريد مفعّلان. أنشئ حسابًا من التطبيق وأكد البريد ثم سجّل الدخول.
6. اضبط Site URL في Supabase Auth URL Configuration على رابط التطبيق المحلي أثناء التطوير، وعلى رابط النشر عند النشر. تدفق التأكيد الحالي يطلب تسجيل الدخول بكلمة المرور بعد تأكيد البريد؛ لا يعتمد على تحويل رابط البريد إلى جلسة في المتصفح.

المصادقة تستخدم `@supabase/ssr` داخل Route Handlers فقط؛ كل route يتحقق عبر `auth.getUser()` ويكتب cookies عند التجديد. الصفحة لا تقرأ الجلسة في Server Component، لذلك لا تحتاج proxy الآن. إذا أضيفت صفحات server تعتمد على الجلسة، أضف proxy وفق دليل Supabase الرسمي: https://supabase.com/docs/guides/auth/server-side/creating-a-client.

## API للمطور المسؤول عن الواجهة

جميع الاستجابات JSON. الجلسة في cookies من نفس الأصل؛ الطلبات من المتصفح لا تحتاج إدخال token.
لا ترسل user_id أو status في إنشاء الأعمال. Cache-Control للاستجابات الخاصة هو private, no-store.

| Endpoint | الطلب | النتيجة |
| --- | --- | --- |
| POST /api/auth | `{ "action": "signup", "email": "...", "password": "..." }` | 202 ورسالة تأكيد البريد؛ كلمة مرور جديدة 8–128 حرفًا |
| POST /api/auth | `{ "action": "signin", "email": "...", "password": "..." }` | 200 `{ "user": { "id": "...", "email": "..." } }` مع cookies |
| POST /api/auth | `{ "action": "signout" }` | 200 وإنهاء الجلسة المحلية |
| GET /api/auth | لا شيء | user الحالي أو 401 |
| POST /api/business | `{ "name": "Sara Shop", "type": "Small shop", "city": "Amman" }` | 201 `{ "data": { "id": 1, "name": "...", "type": "...", "city": "...", "status": "New", "created_at": "..." } }` |
| GET /api/business | لا شيء | 200 `{ "data": [...] }`، آخر 100 مشروع للمستخدم فقط |
| GET /api/test-db | لا شيء | نفس GET /api/business، يتطلب الدخول |
| GET /api/hello | لا شيء | endpoint الترحيب الأصلي |

POST يتطلب Content-Type: application/json. الحقول name/type/city نصوص غير فارغة بعد إزالة المسافات وبحد أقصى 120 حرفًا. الأخطاء: 400 إدخال غير صحيح، 401 دون مصادقة، 403 أصل مختلف، 415 نوع محتوى غير صحيح، 500 خطأ قاعدة البيانات، 503 تعذر الخدمة. تفاصيل أخطاء Supabase لا تظهر للعميل.

## اختبار العزل بعد تطبيق SQL

أنشئ حسابين تجريبيين مؤكدين في مشروع التطوير. أنشئ محليًا `.env.test` (تجاهله Git عبر `.env*`) يحتوي:

```dotenv
TEST_BASE_URL=http://localhost:3000
TEST_USER_A_EMAIL=<test account A>
TEST_USER_A_PASSWORD=<local password>
TEST_USER_B_EMAIL=<test account B>
TEST_USER_B_PASSWORD=<local password>
```

مع تشغيل التطبيق:

```powershell
node scripts/check-isolation.mjs
```

يتحقق الاختبار من الدخول عبر API، إنشاء مشروع مع المالك الصحيح، رفض user_id من العميل، قراءة المالك، عدم ظهور مشروعه للمستخدم الآخر، ومنع القراءة والتعديل والحذف وانتحال المالك مباشرة عبر Supabase ورفض anonymous access. ينشئ صفًا تجريبيًا ويزيله في النهاية. استخدم حسابات اختبار فقط. لا تطبع بيانات الدخول أو tokens.

## الفحوصات المنفذة والحدود

- نجح build مع TypeScript وESLint.
- نجحت 9 فحوصات HTTP: رفض GET/POST غير المصادق، حماية test-db وauth، JSON غير صالح، Content-Type غير صالح، origin مختلف، cookie مزورة، وصفحة البداية.
- تم تطبيق السياسات على مشروع bedaya الفعلي. تم التحقق أن id من نوع identity وأن user_id موجود؛ الجدول كان فارغًا، ولذلك تم جعل user_id NOT NULL وإضافة FK موثّق إلى auth.users. تم منع anon من الجدول وإضافة سياستي owner_access وowner_guard لكل العمليات.
- نجح اختبار SQL داخل transaction وبصلاحية authenticated: المالك ينشئ ويقرأ، وهوية مستخدم أخرى لا تقرأ ولا تضيف باسم المالك، وanon لا يقرأ ولا يضيف. تم rollback للصف التجريبي. هوية المستخدم الثاني كانت محاكاة claims داخل قاعدة البيانات، وليست تسجيل دخول لحساب ثانٍ فعلي.
- سجّل المستخدم الدخول إلى التطبيق بنفسه. تم حفظ «مشروع تجربة بداية» عبر الصفحة وPOST API، وظهر بعد إعادة تحميل الصفحة. الصف رقم 3 موجود في Supabase ومرتبط بمستخدم auth صحيح.
- لم يُشغّل سكربت حسابي الاختبار الحقيقيين بعد؛ اختبار منع UPDATE/DELETE المباشر لم يُنفذ. السياسات المطبقة FOR ALL تشمل هذه العمليات، لكن ذلك ليس نتيجة اختبار مستقل لهما.
- npm audit أظهر 5 high alerts ضمن سلسلة eslint-config-next → fast-glob → micromatch → braces. أحدث braces في الفحص 3.0.3 وهو متأثر. لا يوجد ترقيع متوافق تم تطبيقه، ولم يتم تشغيل audit fix --force. المرجع: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.
- هذا تدفق تطوير صغير؛ GET محدود بـ100، ولا توجد واجهات تعديل/حذف أو pagination. حدود طلبات المصادقة لدى Supabase تبقى فعالة.
