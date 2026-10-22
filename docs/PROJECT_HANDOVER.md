# یادداشت تحویل پروژه آسوده

آخرین بررسی: 2026-10-22

## ادامهٔ ممیزی و توسعه (2026-10-22)

- پیش از تغییر، شاخه `main`، آخرین commit و working tree بررسی شد. تغییرات session/auth و تست‌های موجود از کار قبلی حفظ شدند؛ فایل staged نبود. فهرست اولیه در `docs/IMPLEMENTATION_STATUS.md` ثبت شده است.
- idle timeout ده‌دقیقه‌ای در backend با `idleExpiresAt` و endpoint محافظت‌شدهٔ `/auth/activity` enforce می‌شود. فقط رویدادهای trusted مرورگرِ قابل مشاهده که monitor ثبت می‌کند، سیگنال فعالیت می‌فرستند؛ خواندن/refresh پس‌زمینه deadline را تمدید نمی‌کند. تست API انقضا، تمدید activity، CSRF و رد نشست پس از انقضا را پوشش می‌دهد. بازبینی مستقل چندتب/ترافیک واقعی production هنوز لازم است.
- خطاهای داخلی backend اکنون پاسخ عمومی فارسی می‌دهند و به‌صورت JSON ساخت‌یافته و بدون متن خطای خام log می‌شوند؛ stack frame فقط در development و بدون خط اول ثبت می‌شود. پاسخ 404 نیز فارسی است.
- `GET /transactions` جست‌وجوی متنی literal در note و نام دستهٔ متعلق به کاربر/سیستم، sort بر اساس تاریخ یا مبلغ و جهت مرتب‌سازی را پشتیبانی می‌کند. ورودی search حداکثر ۱۰۰ نویسه است و قبل از استفاده در regex escape می‌شود. UI این جست‌وجو و مرتب‌سازی را با pagination سروری اعمال می‌کند؛ تست API و Playwright اضافه شده‌اند.
- پوستهٔ برنامه کنترل اختیاری خواندن متن قابل مشاهده با Web Speech API دارد، دکمهٔ توقف و پیام وضعیت screen-reader-friendly ارائه می‌دهد و در نبود voice فارسی پیام روشن نشان می‌دهد. تست‌ها API گفتار را mock می‌کنند؛ وجود voice فارسی، تلفظ، رفتار واقعی دستگاه و محل پردازش صدای سیستم بررسی نشده‌اند. هم‌زمانی با صفحه‌خوان ممکن است باعث دوبارخوانی شود.
- وابستگی‌های backend به Vitest `4.1.12` و Vite `7.3.7` به‌روزرسانی شدند؛ audit کامل backend صفر آسیب‌پذیری گزارش کرد. در frontend، override سازگار PostCSS `8.5.31` آسیب‌پذیری‌های production را رفع کرد و `npm audit --omit=dev` صفر نتیجه داد. audit کامل frontend هنوز ۹ هشدار dev-only (۷ high، ۲ moderate) در زنجیرهٔ Tailwind/Next lint دارد؛ رفع پیشنهادی نیازمند ارتقای عمده است و فعلاً انجام نشده است.
- آخرین اجرای کامل backend: Vitest **۱۱۳ تست موفق** روی MongoDB محلی مجزای `asoudeh_test`؛ backend typecheck، lint و build موفق. frontend typecheck/lint و production build موفق؛ Edge Playwright **۲۸ موفق، ۱ skip**؛ تست تاریخ شمسی **۳ موفق**. build frontend پس از افزودن جست‌وجوی تراکنش و خواندن متن با موفقیت انجام شد.
- SMS واقعی، دسترس‌پذیری WCAG 2.2 AA، screen reader واقعی، zoom ۲۰۰٪، production، آزمون usability و index rollout تأیید نشده‌اند. API key یا اطلاعات قالب SMS.ir لازم است از مالک سامانه و خارج از مخزن دریافت شود.
- تغییرات در commit `f2618c1` با پیام `feat: harden sessions and expand accessibility` ثبت شدند؛ working tree پس از commit پاک بود. Push انجام نشده و فقط با درخواست صریح انجام شود.

## لوگو، معماری مشترک و loading UI (2026-10-22)

- پیش از شروع، Git روی `main` و clean بود و HEAD برابر `120f2a2` قرار داشت؛ دو commit قبلی (`f2618c1` و `120f2a2`) حفظ شدند. این کار commit/push انجام نمی‌دهد و فایل‌های `.env` را باز یا تغییر نمی‌دهد.
- فایل انتخاب‌شده [لوگوی SVG](../frontend/public/icons/logo.svg) است؛ برداری و مناسب اندازه‌های مختلف است. بازبینی فایل، نبود script، embedded image و external href را نشان داد و آزمون Edge بارگذاری موفق آن را در مسیرهای ورود، OTP/ثبت‌نام و پوستهٔ اصلی تأیید کرد. قاب سفید، طرح تک‌رنگ را در تم روشن/تیره خوانا نگه می‌دارد. PNG ارائه‌شده ۲٫۱۶ مگابایت است و برای رابط انتخاب نشد؛ آیکون مربع PWA در manifest دست‌نخورده ماند.
- مؤلفهٔ [BrandLogo](../frontend/components/brand/BrandLogo.tsx) لوگو را در sidebar، ورود، تأیید/ثبت‌نام OTP و landing page یکسان ارائه می‌کند. متن بصری تکراری کنار لوگوی sidebar و عبارت «ورود به آسوده» از عنوان فرم حذف شدند. route فراموشی/بازنشانی رمز در frontend فعلی موجود نیست.
- [PageSkeleton](../frontend/components/ui/PageSkeleton.tsx) با layoutهای متناسب برای داشبورد، تراکنش، دسته، بودجه، گزارش، یادآور، caregiver و تنظیمات افزوده شد. رنگ‌ها از متغیرهای تم می‌آیند؛ shimmer به `prefers-reduced-motion` احترام می‌گذارد و قطعات تزئینی از درخت دسترس‌پذیری پنهان‌اند، درحالی‌که متن وضعیت بارگذاری برای screen reader باقی است.
- ساختار اولیه نشان می‌دهد برخی routeها هنوز بزرگ‌اند (تراکنش حدود ۱۱۳۴ خط، یادآورها ۵۰۸، بودجه ۴۷۷ و تنظیمات ۳۹۰). چون دریافت داده و منطق دامنه با markup در این صفحات ترکیب شده، این مرحله به extraction چند component مشترک واقعی محدود شد؛ بازطراحی همهٔ صفحات یا جابه‌جایی فایل‌ها انجام نشد.
- stack موجود Next `15.5.28`، React `19.3.1` و Tailwind `3.4.19` است؛ `PageSkeleton` با CSS فعلی پیاده‌سازی شد و dependency جدیدی نصب نشد. نتایج typecheck/lint، build و suite مرورگر در این بخش پس از اجرای نهایی تکمیل می‌شود.

## یکپارچه‌سازی رابط کاربری (به‌روزرسانی 2026-10-22)

- مسیرهای احراز‌شده اکنون از پوسته مشترک RTL در `frontend/components/layout/AppShell.tsx` استفاده می‌کنند: ناوبری کناری دسکتاپ، ناوبری تمام‌مسیر در موبایل، عنوان مسیر و کلید پوسته روشن/تیره.
- توکن‌های رنگ، سطح، مرز، focus، سایه، شعاع و حرکت در `frontend/app/globals.css` تعریف شده‌اند. کلاس‌های رایج صفحات با توکن‌ها نگاشت شده‌اند تا تم تاریک و کنتراست بالا بدون تغییر منطق API/مالی اعمال شوند.
- انتخاب پوسته در `localStorage` با کلید `asoudeh.theme` نگهداری می‌شود و در مسیرهای عمومی/احراز‌شده بازیابی می‌شود. تنظیم بزرگ‌نمایی متن و کنتراست ذخیره‌شده در پروفایل حفظ شده است.
- رابط در عرض موبایل ناوبری دو ردیفه و در دسکتاپ نوار کناری دارد؛ focus قابل مشاهده و `prefers-reduced-motion` رعایت می‌شوند. فونت محلی جدید اضافه نشده چون asset و مجوز آن تأیید نشده است.
- آزمون `frontend/tests/app-shell.spec.ts` دسترسی به هر هشت مسیر در موبایل، وضعیت فعال مسیر، دسترسی دسکتاپ و ماندگاری پوسته تیره را بررسی می‌کند. این بررسی جایگزین audit WCAG، screen reader یا ارزیابی با کاربران واقعی نیست.

## بازبینی مسیر OTP (به‌روزرسانی 2026-10-21)

- **علت دقیق نقص ناوبری:** فرم ورود پس از پاسخ موفق API فقط `step='code'` را در state همان صفحه تنظیم می‌کرد؛ صفحهٔ کد URL جداگانه‌ای نداشت، بنابراین مرورگر روی `/login` می‌ماند. آزمون Edge این رفتار را پیش از اصلاح بازتولید کرد.
- فرم ورود اکنون پس از پاسخ موفق `POST /auth/otp/request`، اطلاعات حداقلی درخواست را در session storage همان tab ذخیره و به `/verify-otp` منتقل می‌کند. شماره در URL قرار نمی‌گیرد. نبود state معتبر در بازکردن مستقیم مسیر به `/login` بازمی‌گردد؛ refresh مسیر کد را از state موقت بازیابی می‌کند.
- state مرورگر نشانه احراز هویت نیست. تنها پاسخ موفق `POST /auth/otp/verify` به کاربر موجود اجازه ورود می‌دهد و backend کوکی‌های session را صادر می‌کند. کاربر جدید پس از تأیید OTP به فرم ثبت‌نام می‌رود؛ ثبت‌نام همچنان به کوکی کوتاه‌عمر سرور و CSRF نیاز دارد.
- OTP شش‌رقمی، paste/Enter، خطای شبکه/API، جلوگیری از submit تکراری، شمارش معکوس و ارسال مجدد پوشش دارند. `OTP_RESEND_COOLDOWN_SECONDS` به‌طور پیش‌فرض ۶۰ ثانیه است و backend آن را با محدودیت اتمیک روی challenge اعمال می‌کند.
- برای توسعهٔ محلی، شمارهٔ `09120000000` در فرم ورود از پیش وارد شده است. با فعال‌کردن صریح simulator و `OTP_DEV_QUICK_LOGIN_ENABLED=true`، backend فقط برای این شماره علامت quick-login می‌دهد؛ client کد توسعه را به endpoint عادی verify می‌فرستد و جلسه همچنان فقط پس از اعتبارسنجی server ایجاد می‌شود. حساب جدید یک بار به تکمیل نام نمایشی نیاز دارد.
- adapter سروری SMS.ir به Verify API رسمی (`POST /v1/send/verify`) اضافه شده است؛ key، template ID و نام دقیق پارامتر هنوز از پنل کاربر دریافت/تأیید نشده‌اند و SMS واقعی آزمایش نشده است. حالت `SMSIR_MODE=sandbox` هیچ درخواست شبکه‌ای نمی‌فرستد، چون OpenAPI رسمی در دسترس sandbox را مستند نکرده است. برای راهنما و تست مجاز، `docs/SMSIR_SETUP.md` را ببینید.
- فایل‌های تغییرکرده در این milestone: `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/verify-otp/page.tsx`, `frontend/lib/auth/otpFlow.ts`, `frontend/tests/auth.spec.ts`, `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/models/OtpChallenge.ts`, `backend/src/services/auth.service.ts`, `backend/src/tests/auth.api.test.ts` و مستندات OTP.
- **تأیید مرورگر واقعی:** علاوه بر E2Eهای دارای API mock، یک smoke test در Edge به frontend و backend واقعی متصل شد: OTP request، `/verify-otp`، verify، تکمیل registration، دریافت `/me` با HTTP 200 و بررسی HttpOnly بودن کوکی‌های access/refresh. دیتابیس منحصربه‌فرد محلیِ موقت پس از آزمون حذف شد.
- SMS واقعی در دسترس نیست و ادعای ارسال واقعی نمی‌شود.

## معماری و نقشه ماژول‌ها

- رابط کاربری: Next.js App Router، React، TypeScript و Tailwind در `frontend/`؛ زبان فارسی و RTL.
- API: Express و TypeScript در `backend/`؛ اعتبارسنجی ورودی‌ها با Zod و ذخیره‌سازی با Mongoose/MongoDB.
- جریان مرورگر: صفحات `frontend/app/` از API client مبتنی بر cookie استفاده می‌کنند؛ درخواست‌های تغییردهنده به CSRF token نیاز دارند.
- ماژول‌های API و اتصال‌ها:
  - `auth`: نشست و پروفایل کاربر؛ `User` و `AuthSession`.
  - `categories`: دسته‌های شخصی و سیستمی؛ `Category`.
  - `transactions`: CRUD مالک‌محور، حذف نرم و بازگردانی؛ `Transaction` و `Category`.
  - `dashboard`: جمع‌های ماه شمسی، تراکنش‌های اخیر و یادآورها.
  - `budgets`: بودجه‌های ماهانه و مصرف دسته‌ها؛ `Budget` و `Transaction`.
  - `reminders`: تکرار و تکمیل ماه‌شمسی؛ `Reminder` و `ReminderCompletion`.
  - `reports`: جمع‌ها و مقایسه ماهانه؛ `Transaction` و `Category`.
  - `caregiver`: دعوت و پذیرش صریح، دسترسی فقط‌خواندنی و رویدادهای ممیزی؛ `CaregiverLink` و `AuditLog`.
- قواعد تاریخ شمسی در `frontend/lib/jalaliDate.ts` و ابزارهای backend در `backend/src/utils/` هستند.
- manifest و Service Worker فرانت‌اند فقط صفحه عمومی آفلاین و آیکون را cache می‌کنند؛ داده‌های API/حساب cache نمی‌شوند.
- تست‌ها: Vitest/Supertest در `backend/src/tests/`، آزمون تاریخ شمسی Node در `frontend/tests/jalaliDate.test.mjs` و Playwright در `frontend/tests/`.

## وضعیت تأییدشده

- احراز هویت OTP، cookie/session، CSRF، پروفایل، تراکنش‌ها، دسته‌ها، داشبورد، بودجه‌ها و یادآورها در API و رابط موجودند.
- حذف حساب با OTP تازه، قطع فوری همه نشست‌ها و زمان‌بندی پاک‌سازی داده‌ها پس از ۳۰ روز پیاده‌سازی شده است؛ دسترسی caregiver به حساب در صف حذف نیز مسدود می‌شود.
- گزارش ماه‌شمسی و caregiver با مجوزهای تفکیک‌شده، پذیرش دعوت و لغو دسترسی پیاده‌سازی شده‌اند. آزمون‌های API، مالکیت و شاخص یکتای دعوت caregiver را بررسی کردند.
- قاعده تکمیل مستقل یادآور ماهانه، clamp روز در ماه کوتاه، حفظ تاریخچه، حذف نرم تراکنش و پنجره بازگردانی در کد/آزمون‌ها پوشش دارند.
- فرم تراکنش سه‌مرحله‌ای، مسیر قدیمی `/transactions/new`، manifest، Service Worker و پیش‌نویس opt-in و محدود به حساب در کد حاضرند. آزمون‌های Playwright توسعه و PWA production در آخرین اجرای تحویل موفق بودند.
- صفحه‌بندی تراکنش‌ها هنگام جابه‌جایی صفحه، داده همان صفحه را دوباره از API دریافت می‌کند؛ آزمون E2E رفت‌وبرگشت صفحه‌های ۱ و ۲ را بررسی می‌کند.
- endpoint زنده‌بودن (`/api/v1/health`) از endpoint آمادگی (`/api/v1/health/ready`) جداست؛ readiness در قطع اتصال MongoDB پاسخ 503 می‌دهد و جزئیات اتصال را افشا نمی‌کند.
- برای توسعه محلی بدون SMS، شبیه‌ساز OTP با opt-in صریح از `OTP_DEV_FALLBACK_CODE` (پیش‌فرض `123456`) استفاده می‌کند؛ challenge همچنان hash‌شده، یک‌بارمصرف، محدود به زمان و rate-limit است و در production یا پس از خاموش‌شدن simulator قابل تأیید نیست.
- ارسال واقعی SMS برای OTP یا دعوت caregiver وجود ندارد. شبیه‌ساز OTP فقط با تنظیم صریح در development فعال است؛ در غیر این صورت endpoint با خطای unavailable fail-closed می‌شود.

## ماتریس شکاف‌ها و اولویت بعدی

| اولویت | نیازمندی | وضعیت و محدودیت | گام بعدی / معیار پذیرش |
|---|---|---|---|
| P1 | حذف حساب با OTP و پاک‌سازی پس از مهلت مشخص (قانون کسب‌وکار PDF) | انجام شد: مهلت ۳۰روزه؛ دسترسی و نشست‌ها فوراً لغو و worker پاک‌سازی کامل را اجرا می‌کند. SMS production هنوز unavailable است. API فعلاً مسیر لغو ندارد. | پیش از production، برای شاخص `deletionScheduledAt` rollout امن انجام شود؛ متناسب با سیاست محصول، تصمیم بگیرید آیا قابلیت لغو در مهلت لازم است. |
| P1 | حذف دسته و انتقال تراکنش‌ها به fallback | عمداً غیرفعال است؛ تضمین هم‌زمانی بدون topology تراکنشی ممکن نیست و PDF برای fallback درآمد ابهام دارد. | تصمیم‌گیری درباره fallback درآمد و استفاده از replica set یا workflow معادل؛ آزمون هم‌زمانی و عدم از دست‌رفتن داده پیش از فعال‌سازی. |
| P1 برای بهره‌برداری | تحویل OTP از SMS.ir | adapter پیاده‌سازی و mock-tested است؛ key، template ID و نام متغیر حساب هنوز فراهم نیست؛ SMS زنده تأیید نشده. | واردکردن تنظیمات در `backend/.env`، تأیید دسترسی/اعتبار/الگو و مجوز صریح یک تست به شمارهٔ خود؛ simulator فقط برای development. |
| P2 | WCAG 2.2 AA، کنتراست، لمس و کاربردپذیری | پوسته واکنش‌گرا، تم روشن/تیره، focus، reduced motion و تنظیمات اندازه متن/کنتراست موجودند؛ ارزیابی Lighthouse/assistive technology و آزمون واقعی کاربران انجام نشده. | اجرای ارزیابی دستی و خودکار، ثبت نتیجه و رفع موارد بحرانی؛ ادعای AA فقط پس از بررسی کامل. |
| P2 | تأیید browser و PWA/E2E | با Edge و ۲ worker: ۲۸ آزمون موفق و یک آزمون PWA production-only در اجرای development عمداً skip شد؛ جست‌وجو/مرتب‌سازی تراکنش و کنترل گفتار نیز تست شدند. | اجرای ماتریس مرورگرهای پشتیبانی‌شده و بررسی نصب PWA/تجربه کاربری روی دستگاه واقعی. |
| P2 | راه‌اندازی production و شاخص‌ها | هیچ deployment یا شاخصی در production اجرا/بررسی نشده است. شاخص‌های یکتای reminder completion و caregiver باید پیش از ترافیک واقعی ایمن rollout شوند. | بررسی داده‌های موجود و اجرای rollout شاخص‌ها توسط اپراتور روی replica set مناسب؛ سپس health check و smoke test. |
| P3 / خارج از MVP | OCR، chatbot و اعلان‌های SMS/email/push | پیاده‌سازی نشده‌اند. خواندن اختیاری متن صفحه با Web Speech API افزوده شده، اما voice واقعی فارسی و همزیستی با screen reader ارزیابی نشده‌اند. | فقط در صورت تصمیم محصول برای فاز بعدی؛ قابلیت گفتار نیازمند آزمون واقعی مرورگر/سیستم است. |

## چک‌لیست تکمیل گردش کار

| مرحله | وضعیت | شواهد / کار باقیمانده |
|---|---|---|
| بررسی مخزن و worktree | PASS | شاخه `main`، تغییرات قبلی حفظ شد؛ envهای محلی ignore هستند. |
| تطبیق specification و checkpoint | PASS | مستندات و PDF با پیاده‌سازی و تصمیم‌های ثبت‌شده تطبیق داده شدند. |
| حذف حساب و مهلت ۳۰روزه | PASS | OTP یک‌بارمصرف، قطع نشست و دسترسی فوری، worker و آزمون API. |
| backend tests/typecheck/lint/build | PASS | همه بررسی‌های backend موفق؛ ۱۱۳ تست API/unit در دیتابیس ایزوله. |
| frontend tests/build | PASS | typecheck/lint/build موفق؛ در آخرین اجرای Edge با ۲ worker، ۲۸ E2E موفق و یک آزمون PWA production-only عمداً skip شد. |
| محدودیت‌ها و آمادگی production | PARTIAL | SMS واقعی، لغو حذف، استقرار ایندکس‌ها، WCAG و deployment هنوز تأیید نشده‌اند. |
| بازبینی قبلی و commit/push | PASS | commit `b67d78c` شامل simulator توسعه، readiness، صفحه‌بندی و مستندات قبلی به `origin/main` push شد. |
| بازبینی فعلی OTP و ادامهٔ توسعه | PASS | اصلاح OTP و تغییرات نشست/قابلیت‌ها در `f2618c1` commit شدند؛ push انجام نشده است. |
| اجرای محلی frontend/backend | PASS | هر دو روی URLهای محلی با پایگاه تازه اجرا و health-checked شدند؛ بنا به درخواست کاربر اکنون متوقف‌اند. `AUTH_HASH_SECRET` در env محلی موجود نیست و OTP fail-closed می‌ماند. |
| health check و URLها | PASS | پاسخ frontend `/login` با HTTP 200 و backend `/api/v1/health` با HTTP 200 تأیید شد. |

## تصمیم‌ها و محدودیت‌های مهم

- مالکیت داده از هویت server-side گرفته می‌شود؛ caregiver فقط با لینک پذیرفته‌شده و permission فعال به داده دسترسی دارد و endpoint نوشتن ندارد.
- جمع‌های مالی به صورت عدد صحیح/رشته عددی دقیق محاسبه می‌شوند؛ بازه‌های ماه از تقویم جلالی و timezone تهران استفاده می‌کنند.
- تراکنش و یادآور حذف فیزیکی نمی‌شوند؛ archive/soft-delete تاریخچه را حفظ می‌کند.
- دعوت caregiver از طریق SMS ارسال نمی‌شود؛ دعوت‌کننده باید از کانال دیگری اطلاع دهد.
- شاخص‌های مدل صرفاً تعریف کد نیستند؛ ایجاد یا rollout آن‌ها روی production در این بررسی انجام نشده است.
- فایل‌های محلی `backend/.env` و `frontend/.env.local` باز یا چاپ نشدند. نام متغیرهای template شامل `NODE_ENV`، `PORT`، `MONGODB_URI`، `JWT_SECRET`، `AUTH_HASH_SECRET`، `OTP_DEV_SIMULATOR_ENABLED`، `OTP_DEV_QUICK_LOGIN_ENABLED`، `OTP_DEV_QUICK_LOGIN_PHONE`، `OTP_RESEND_COOLDOWN_SECONDS`، `SMSIR_API_KEY`، `SMSIR_TEMPLATE_ID`، `SMSIR_BASE_URL`، `SMSIR_MODE`، `SMSIR_OTP_PARAMETER_NAME`، `CLIENT_URL`، `TEST_MONGODB_URI` و `NEXT_PUBLIC_API_URL` است. مقدار واقعی در این سند ثبت نمی‌شود.

## اعتبارسنجی انجام‌شده

در این نشست:

- `npm run typecheck` — موفق (backend و frontend؛ پس از اصلاح صفحه‌بندی).
- `npm run lint` — موفق (backend و frontend؛ پس از اصلاح صفحه‌بندی).
- `npm run build:backend` — موفق در همین نوبت بازبینی.
- `npm run test:backend` — ۱۱۳ تست از ۱۵ فایل موفق؛ URIهای تست فقط به MongoDB محلی ایزولهٔ `asoudeh_test` اشاره داشتند.
- `npm --prefix backend run typecheck`, `npm --prefix backend run lint` و `npm --prefix backend run build` — پس از افزودن readiness endpoint موفق.
- `npm --prefix frontend run test:jalali` — ۳ موفق، صفر ناموفق. Node برای type stripping هشدار آزمایشی داد.
- `npm run build:frontend` — build production موفق؛ Next.js بارگذاری `.env.local` را گزارش کرد، اما محتوای آن باز یا چاپ نشد.
- Playwright با Microsoft Edge — مجموعه توسعه: ۲۸ موفق و یک skip؛ آزمون‌های OTP و تراکنش شامل درخواست/ناوبری، direct route، refresh، API/network error، جست‌وجو/مرتب‌سازی و کنترل گفتار هستند. آزمون PWA production-only در اجرای development عمداً skip شد.
- بازتولید پیش از اصلاح — آزمون browser شکست را با URL واقعی `/login` به‌جای `/verify-otp` نشان داد؛ پس از اصلاح آزمون کامل browser موفق شد.
- Production deployment، اتصال SMS واقعی، WCAG/Lighthouse و usability study — اجرا/تأیید نشده‌اند.

دستورهای معمولی:

```powershell
npm run typecheck
npm run lint
npm run build:backend
npm run test:backend
npm --prefix frontend run test:jalali
npm --prefix frontend run test:e2e
npm run build:frontend
```

برای تست‌های backend، هر دو URI پایگاه `MONGODB_URI` و `TEST_MONGODB_URI` باید صریحاً به `127.0.0.1` و دیتابیس `asoudeh_test` اشاره کنند؛ برای جلوگیری از بارگذاری env محلی، `DOTENV_CONFIG_PATH` را به فایل خالی موقت تنظیم کنید. هیچ‌گاه تست را به دیتابیس production یا دیتابیس توسعه متصل نکنید.

## Git و فایل‌های محافظت‌شده

- شاخه `main` و `origin/main` در شروع milestone OTP روی `b67d78c` (`feat: complete local development and project docs`) همگام بودند.
- پیاده‌سازی جامع قبلی در `490d80e` ثبت شده و مستندات وضعیت محلی در `a82fe18` و `58eb74a` قرار دارند.
- تغییرات OTP و ادامهٔ توسعه در `f2618c1` با پیام `feat: harden sessions and expand accessibility` ثبت شده‌اند؛ push نشده‌اند. تغییرات pagination، readiness و simulator قبلی در `b67d78c` ثبت شده‌اند. فایل‌های env واقعی در این کار باز یا تغییر داده نشده‌اند.
- پایدارشدن `loadData` برای جلوگیری از اجرای مجدد ناخواستهٔ بازیابی draft قبلاً اعمال شده بود؛ اصلاح جاری تضمین می‌کند دکمه‌های صفحه‌بندی علاوه بر تغییر state، داده صفحهٔ درخواستی را نیز بارگذاری کنند.

## وضعیت راه‌اندازی محلی

- MongoDB محلی روی `127.0.0.1:27017` با فرایند `mongod` فعال است.
- Frontend در `http://localhost:3000` و backend در `http://localhost:5000` اجرا و تأیید شدند. `GET /login` و `GET /api/v1/health` هر دو HTTP 200 داده‌اند؛ لاگ‌ها خطای startup نشان ندادند. هر دو فرایند بنا به درخواست کاربر متوقف و پورت‌های 3000/5000 آزاد شدند.
- Backend با override موقت فرایند به پایگاه تازه و خالی `asoudeh_manual_20261021` وصل شد؛ فایل `.env` تغییر نکرده است. MongoDB محلی برای استفادهٔ بعدی روشن ماند.
- `AUTH_HASH_SECRET` در `backend/.env` وجود ندارد. احراز هویت/OTP به علت fail-closed بودن HMAC تا تنظیم secret توسط مالک محیط قابل تست نیست؛ secret ساخته یا در فایل نوشته نشده است.
- یک شروع اولیه backend پیش از بررسی امن نام پایگاه موجود در `.env` انجام شد. طبقه‌بندی فقط نشان داد URI به host محلی می‌رسد اما نام پایگاه در فهرست مجاز توسعه/تست نبود؛ backend فوراً متوقف و با پایگاه تازه جایگزین شد. Worker حذف حساب در startup اجرا می‌شود، بنابراین نمی‌توان تأیید کرد آیا آن اجرای کوتاه رکورد سررسیدشده‌ای را پاک کرده است یا خیر. فقط health endpoint درخواست شد؛ پیش از استفاده مجدد از آن پایگاه، مالک محیط باید وضعیت/backup محلی را بررسی کند. داده آن پایگاه خوانده یا چاپ نشد.

## اقدام بعدی

برای تست محلی backend، مالک محیط باید `AUTH_HASH_SECRET` را با مقدار random و مستقل حداقل ۳۲ بایتی پیکربندی و backend را restart کند؛ مقدار آن را در chat/commit ننویسد. برای آزمون از پایگاه محلی ایزوله استفاده کنید و هرگز URI ناشناختهٔ `.env` را برای تست به‌کار نبرید. پیش از production، SMS واقعی، rollout ایندکس‌ها، استقرار امن شاخص‌ها، ارزیابی دسترس‌پذیری و آزمون عملیاتی لازم‌اند. مشخصات بررسی‌شده لغو حذف حساب را الزام نکرده‌اند؛ حذف دسته نیز تا تعیین fallback درآمد و topology تراکنشی غیرفعال بماند.

## ممیزی کامل و اصلاحات نهایی (2026-10-22)

- شاخه `main` و upstream هر دو روی `120f2a2` بودند. تغییرات محلی برند/skeleton از مرحلهٔ قبلی حفظ شدند؛ این ممیزی هیچ commit یا push انجام نداد.
- سه نقص تأییدشده اصلاح شد: وضعیت بودجه از مبلغ دقیق محاسبه می‌شود (نه درصد گرد‌شده)، درخواست بودجه پس از refresh نشست retry می‌شود، و دکمهٔ خواندن متن در موبایل آیکون قابل مشاهده دارد. برای هر مورد تست رگرسیون اضافه شد.
- نتایج نهایی: backend **۱۱۳ تست/۱۶ فایل موفق** روی پایگاه مجزای `asoudeh_test`؛ Jalali **۳ موفق**؛ Edge E2E توسعه **۳۱ موفق، ۱ skip مخصوص production**؛ PWA در production **۱ موفق، ۱ skip مخصوص development**؛ typecheck، lint و buildهای backend/frontend موفق.
- audit وابستگی‌های production در backend و frontend صفر گزارش داد؛ audit کامل frontend همچنان **۹ advisory در وابستگی‌های dev (۷ high، ۲ moderate)** دارد. رفع خودکار فقط با ارتقای breaking به Tailwind 4 پیشنهاد شد؛ بدون برنامهٔ مهاجرت اعمال نشد.
- smoke مرورگر production روی login لوگوی محلی را با نسبت تصویر درست نمایش داد و صفر خطای console/page/request ثبت شد. SVG افقی UI از آیکون مربعی PWA جدا نگه داشته شد.
- ممیزی امنیتی مستقل read-only هیچ آسیب‌پذیری مشخصی در کد بازبینی‌شده گزارش نکرد؛ این یک penetration test یا گواهی رسمی نیست.
- SMS زنده، production deployment/index rollout، WCAG 2.2 AA، آزمون screen reader/usability و رفتار عملی چندتب همچنان تأییدنشده‌اند. حذف دسته عمداً تا تضمین reassignment هم‌زمانی غیرفعال می‌ماند.
- هیچ فایل `.env` به‌صورت دستی باز/چاپ یا ویرایش نشد؛ Next به‌طور خودکار بارگذاری `.env.local` را اعلام کرد و backend از dotenv استفاده می‌کند. URI و secretهای تست در process به مقادیر موقت و پایگاه loopback مجزای `asoudeh_test` override شدند؛ هیچ secretای چاپ نشد و fixtureها مصنوعی بودند.
- ماتریس نیازمندی‌ها و نتایج کامل در [REQUIREMENTS_TRACEABILITY.md](./REQUIREMENTS_TRACEABILITY.md) و [QUALITY_AUDIT_REPORT.md](./QUALITY_AUDIT_REPORT.md) است. یادداشت قبلی همین سند دربارهٔ اجرای کوتاه تاریخی worker حذف حساب روی URI نامعلوم همچنان حل‌نشده است؛ مالک محیط باید پیش از استفادهٔ دوباره از آن پایگاه، backup/وضعیت آن را جداگانه بررسی کند. این ممیزی فقط پایگاه تست مجزای خود را استفاده کرد.
