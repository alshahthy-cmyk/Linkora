# نشر خادم الإشارة الخاص بـ Linkora

## التوصية المختصرة

للتجربة الأولى، ابدأ بخدمة **Koyeb** أو **Railway** لأنها تسمح بالنشر من GitHub وتمنحك عنوان HTTPS عام دون إدارة خادم أو شهادة TLS. بعد إثبات الاتصال بين هاتفين، استخدم خطة مدفوعة صغيرة أو خدمة ثابتة عند الحاجة إلى اتصال مستمر؛ فالخطة المجانية والرصيد المجاني مناسبين للاختبار، لا لضمان توافر منتج للمستخدمين. يدعم Koyeb تطبيقات Express المنشورة من Git ويدعم WebSocket، بينما تمنح Railway حاليًا خطة مجانية برصيد استخدام شهري قدره دولار واحد وخادمًا واحدًا حتى 0.5GB من الذاكرة. [1] [2] [3]

> يجب أن يستخدم تطبيق Android عنوانًا يبدأ بـ `wss://` عند الاتصال عبر الإنترنت. لا تضع `ws://` أو `localhost` في نسخة APK؛ فبعض المنصات تعيد توجيه HTTP إلى TLS، ما يجعل مصافحة WebSocket غير الآمنة تفشل. [1]

## مقارنة سريعة

| المنصة | مناسبة لـ | ما يقدمه المسار المجاني | ملاحظة مهمة |
| --- | --- | --- | --- |
| **Koyeb** | تجربة أولى باستخدام GitHub وExpress | البدء مجاني، مع دعم WebSocket موثق وخدمة عامة تنصت على `PORT`. [2] [3] | راجع حد الموارد والتوفر في لوحة الحساب قبل مشاركة APK مع مستخدمين. |
| **Railway** | أسرع تجربة سحابية مع إعدادات قليلة | حاليًا: رصيد مجاني شهري قدره $1، مثيل واحد، وحتى 1 vCPU و0.5GB لكل خدمة. [4] | استهلاك المعالجة والذاكرة محسوب بالثانية؛ راقب الرصيد. |
| **Render** | خيار بديل موثق جيدًا لـ Express + `ws` | يدعم WebSocket الوارد في Web Services. [1] | قد تنقطع الاتصالات عند النشر أو استبدال المثيل؛ يجب وجود إعادة اتصال في العميل. [1] |

## المسار العملي: النشر على Koyeb

ابدأ بدمج طلب السحب [#1](https://github.com/alshahthy-cmyk/Linkora/pull/1)، أو اختر فرع `manus/phase-1-build-wss` في لوحة Koyeb. هذا ضروري لأن ذلك الفرع أضاف `EXPO_PUBLIC_SIGNAL_URL` وفحص الاتصال ودليل APK.

من لوحة Koyeb، اختر **Create Web Service** ثم **GitHub**، وبعدها اختر مستودع `alshahthy-cmyk/Linkora` والفرع الذي يحتوي على التغييرات. بما أن Linkora مساحة عمل pnpm، لا تجعل مجلد الجذر `artifacts/api-server`؛ اجعله جذر المستودع حتى تتوفر حزم مساحة العمل الداخلية أثناء التثبيت.

استخدم الإعدادات التالية عند إنشاء الخدمة:

| الحقل | القيمة |
| --- | --- |
| نوع الخدمة | Web Service |
| الفرع | `main` بعد الدمج، أو `manus/phase-1-build-wss` للاختبار |
| أمر البناء | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build` |
| أمر التشغيل | `pnpm --filter @workspace/api-server run start` |
| منفذ التطبيق | متغير المنصة `PORT`؛ لا تثبّت منفذًا يدويًا |
| فحص الصحة | `/api/healthz` |
| مثيلات الخدمة | مثيل واحد في النسخة التجريبية |

لا يحتاج الخادم إلى مفتاح سري للمرحلة الحالية. اترك متغيرات البيئة فارغة ما لم تضف لاحقًا مصادقة أو قاعدة بيانات. يجب أن تستمع الخدمة إلى `process.env.PORT`، وهو نمط توصي به وثائق Koyeb لتطبيقات Express المنشورة على الخدمة. [2]

بعد نجاح النشر، ستمنحك المنصة عنوانًا مشابهًا لـ `https://linkora-signal-<name>.koyeb.app`. استخدم عنوان WebSocket المطابق، مع المسار الثابت:

```
wss://linkora-signal-<name>.koyeb.app/api/signal
```

## بديل Railway

أنشئ مشروعًا جديدًا، واختر **Deploy from GitHub Repo**، ثم حدّد نفس المستودع والفرع. اضبط **Root Directory** على جذر المستودع، وضع أمر البناء والتشغيل نفسيهما المذكورين أعلاه. بعد النشر، أضف نطاقًا عامًا من إعدادات الخدمة. حوّل عنوان HTTPS المعروض إلى WSS كما يلي:

```
https://linkora-signal.up.railway.app
wss://linkora-signal.up.railway.app/api/signal
```

إن كانت فترة الاختبار قصيرة، راقب صفحة استخدام Railway؛ الخطط المجانية تعتمد على الرصيد الشهري المتاح وقد تتوقف الخدمة عند نفاده. [4]

## ربط الخادم ببناء Android

بعد الحصول على عنوان WSS حقيقي، عرّف المتغير في Expo/EAS. هذا المتغير **عام عمدًا** ويُضمّن في ملف APK، لذلك لا تضع فيه كلمة مرور أو رمز وصول:

```bash
cd artifacts/mobile

eas env:create \
  --name EXPO_PUBLIC_SIGNAL_URL \
  --value wss://linkora-signal-<name>.koyeb.app/api/signal \
  --environment preview \
  --visibility plaintext

eas build --platform android --profile preview
```

لإصدار الإنتاج، أنشئ القيمة نفسها ضمن بيئة `production` ثم استخدم `--profile production`. تطبيق Linkora المحدث يرفض عنوانًا غير آمن خارج وضع التطوير ويعرض رسالة إعداد قابلة للفهم بدلاً من محاولة الاتصال بـ `localhost`.

## التحقق قبل بناء APK

نفّذ أولًا فحص الصحة. ثم استخدم فحص الإشارة المضاف إلى الفرع؛ يسجل عميلين مؤقتين ويرسل رسالة بينهما. نجاح الخطوتين يعني أن HTTPS ومسار WSS متاحان للخادم.

```bash
curl --fail https://linkora-signal-<name>.koyeb.app/api/healthz

SIGNAL_URL=wss://linkora-signal-<name>.koyeb.app/api/signal \
  pnpm --filter @workspace/api-server run smoke:signal
```

بعد بناء APK، ثبّته على هاتفين، وأنشئ معرفين مختلفين، ثم اختبر التسجيل، الرسائل، وفصل الاتصال وإعادته. خوادم WebSocket يمكن أن تغلق اتصالاتها عند إعادة النشر أو أعمال المنصة، لذلك حافظ على منطق إعادة الاتصال الحالي واختبره بدل افتراض أن الجلسة دائمة. [1]

## حدود هذا النشر

سيشغّل ذلك **خادم الإشارة والمراسلة الفورية** فقط. لا يجعل شاشة المكالمات WebRTC مكتملة، ولا يضيف طابورًا للرسائل غير المتصلة أو مصادقة للمستخدمين. قبل مشاركة التطبيق على نطاق واسع، أضف مصادقة، حدود حجم/معدل، وضربات قلب على الخادم؛ ذلك يقلل أثر انتحال الهوية والاتصالات المتروكة.

## المراجع

[1]: https://render.com/docs/websocket "Render — WebSockets"

[2]: https://www.koyeb.com/docs/deploy/express "Koyeb — Deploy an Express App"

[3]: https://www.koyeb.com/tutorials/using-websockets-with-socketio-and-nodejs-on-koyeb "Koyeb — Using WebSockets with Node.js"

[4]: https://railway.com/pricing "Railway Pricing"
