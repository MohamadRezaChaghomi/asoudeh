# یادداشت تحویل پروژه آسوده

آخرین بررسی: 2026-10-21

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
| P1 برای بهره‌برداری | تحویل OTP از SMS provider | provider و اعتبارنامه در دسترس نیست؛ ورود production عمداً سرویس‌دهی نمی‌کند. | انتخاب/پیکربندی provider و آزمون محدودیت نرخ، عدم افشای OTP و شکست تحویل؛ simulator فقط برای development. |
| P2 | WCAG 2.2 AA، کنتراست، لمس و کاربردپذیری | تنظیمات اندازه متن/کنتراست موجود است؛ ارزیابی Lighthouse/assistive technology و آزمون واقعی کاربران انجام نشده. | اجرای ارزیابی دستی و خودکار، ثبت نتیجه و رفع موارد بحرانی؛ ادعای AA فقط پس از بررسی کامل. |
| P2 | تأیید browser و PWA/E2E | با Edge: ۱۵ آزمون Playwright توسعه و آزمون PWA production موفق؛ هر اجرا یک آزمون مربوط به حالت دیگر را عمداً skip کرد. Chromium خود Playwright در این محیط در دسترس نیست. | اجرای ماتریس مرورگرهای پشتیبانی‌شده و بررسی نصب PWA/تجربه کاربری روی دستگاه واقعی. |
| P2 | راه‌اندازی production و شاخص‌ها | هیچ deployment یا شاخصی در production اجرا/بررسی نشده است. شاخص‌های یکتای reminder completion و caregiver باید پیش از ترافیک واقعی ایمن rollout شوند. | بررسی داده‌های موجود و اجرای rollout شاخص‌ها توسط اپراتور روی replica set مناسب؛ سپس health check و smoke test. |
| P3 / خارج از MVP | OCR، Voice، Chatbot و اعلان‌های SMS/email/push | در scope نسخه فعلی پیاده‌سازی نشده‌اند. | فقط در صورت تصمیم محصول برای فاز بعدی. |

## چک‌لیست تکمیل گردش کار

| مرحله | وضعیت | شواهد / کار باقیمانده |
|---|---|---|
| بررسی مخزن و worktree | PASS | شاخه `main`، تغییرات قبلی حفظ شد؛ envهای محلی ignore هستند. |
| تطبیق specification و checkpoint | PASS | مستندات و PDF با پیاده‌سازی و تصمیم‌های ثبت‌شده تطبیق داده شدند. |
| حذف حساب و مهلت ۳۰روزه | PASS | OTP یک‌بارمصرف، قطع نشست و دسترسی فوری، worker و آزمون API. |
| backend tests/typecheck/lint/build | PASS | همه بررسی‌های backend موفق؛ اکنون ۹۴ تست API/unit. |
| frontend tests/build | PASS | typecheck/lint/build موفق؛ ۱۵ E2E و آزمون PWA production موفق. |
| محدودیت‌ها و آمادگی production | PARTIAL | SMS واقعی، لغو حذف، استقرار ایندکس‌ها، WCAG و deployment هنوز تأیید نشده‌اند. |
| بازبینی تغییر جاری | PASS | اصلاح صفحه‌بندی و آزمون E2E آن بازبینی و مستند handover به‌روز شد؛ هیچ فایلی stage نشده است. |
| commit و push تغییر جاری | انجام نشده | تغییرات این بازبینی عمداً commit یا push نشده‌اند. |
| اجرای محلی frontend/backend | PASS | هر دو روی URLهای محلی با پایگاه تازه اجرا و health-checked شدند؛ بنا به درخواست کاربر اکنون متوقف‌اند. `AUTH_HASH_SECRET` در env محلی موجود نیست و OTP fail-closed می‌ماند. |
| health check و URLها | PASS | پاسخ frontend `/login` با HTTP 200 و backend `/api/v1/health` با HTTP 200 تأیید شد. |

## تصمیم‌ها و محدودیت‌های مهم

- مالکیت داده از هویت server-side گرفته می‌شود؛ caregiver فقط با لینک پذیرفته‌شده و permission فعال به داده دسترسی دارد و endpoint نوشتن ندارد.
- جمع‌های مالی به صورت عدد صحیح/رشته عددی دقیق محاسبه می‌شوند؛ بازه‌های ماه از تقویم جلالی و timezone تهران استفاده می‌کنند.
- تراکنش و یادآور حذف فیزیکی نمی‌شوند؛ archive/soft-delete تاریخچه را حفظ می‌کند.
- دعوت caregiver از طریق SMS ارسال نمی‌شود؛ دعوت‌کننده باید از کانال دیگری اطلاع دهد.
- شاخص‌های مدل صرفاً تعریف کد نیستند؛ ایجاد یا rollout آن‌ها روی production در این بررسی انجام نشده است.
- فایل‌های محلی `backend/.env` و `frontend/.env.local` باز یا چاپ نشدند. نام متغیرهای template شامل `NODE_ENV`، `PORT`، `MONGODB_URI`، `JWT_SECRET`، `AUTH_HASH_SECRET`، `OTP_DEV_SIMULATOR_ENABLED`، `CLIENT_URL`، `TEST_MONGODB_URI` و `NEXT_PUBLIC_API_URL` است. مقدار واقعی در این سند ثبت نمی‌شود.

## اعتبارسنجی انجام‌شده

در این نشست:

- `npm run typecheck` — موفق (backend و frontend؛ پس از اصلاح صفحه‌بندی).
- `npm run lint` — موفق (backend و frontend؛ پس از اصلاح صفحه‌بندی).
- `npm run build:backend` — موفق در همین نوبت بازبینی.
- `npm run test:backend` — روی دیتابیس ایزوله `asoudeh_test`: ۹۴ تست موفق، صفر ناموفق و صفر skip؛ آزمون‌های OTP، حذف حساب و health/readiness هم پوشش داده شدند.
- `npm --prefix backend run typecheck`, `npm --prefix backend run lint` و `npm --prefix backend run build` — پس از افزودن readiness endpoint موفق.
- `npm --prefix frontend run test:jalali` — ۳ موفق، صفر ناموفق. Node برای type stripping هشدار آزمایشی داد.
- `npm run build:frontend` — build production موفق؛ Next.js بارگذاری `.env.local` را گزارش کرد، اما محتوای آن باز یا چاپ نشد.
- Playwright با Microsoft Edge — مجموعه توسعه: ۱۵ موفق، صفر ناموفق، یک skip (آزمون PWA production به‌علت حالت dev). آزمون PWA در حالت production جداگانه: یک موفق، یک skip (آزمون dev). آزمون جدید صفحه‌بندی، درخواست‌های صفحه‌های ۱، ۲ و بازگشت به ۱ را تأیید می‌کند.
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

- شاخه `main` روی `58eb74a` (`docs: record requested local server shutdown`) است و هنگام بررسی با `origin/main` همگام بود.
- پیاده‌سازی جامع قبلی در `490d80e` ثبت شده و مستندات وضعیت محلی در `a82fe18` و `58eb74a` قرار دارند.
- تغییرات این بازبینی در [صفحه تراکنش‌ها](../frontend/app/%28dashboard%29/transactions/page.tsx)، [آزمون‌های تراکنش](../frontend/tests/transactions.spec.ts)، OTP توسعه، endpoint آمادگی backend و مستندات مرتبط هنوز commit یا push نشده‌اند. فایل‌های env واقعی و خروجی تست نیز بخشی از تغییر جاری نیستند.
- پایدارشدن `loadData` برای جلوگیری از اجرای مجدد ناخواستهٔ بازیابی draft قبلاً اعمال شده بود؛ اصلاح جاری تضمین می‌کند دکمه‌های صفحه‌بندی علاوه بر تغییر state، داده صفحهٔ درخواستی را نیز بارگذاری کنند.

## وضعیت راه‌اندازی محلی

- MongoDB محلی روی `127.0.0.1:27017` با فرایند `mongod` فعال است.
- Frontend در `http://localhost:3000` و backend در `http://localhost:5000` اجرا و تأیید شدند. `GET /login` و `GET /api/v1/health` هر دو HTTP 200 داده‌اند؛ لاگ‌ها خطای startup نشان ندادند. هر دو فرایند بنا به درخواست کاربر متوقف و پورت‌های 3000/5000 آزاد شدند.
- Backend با override موقت فرایند به پایگاه تازه و خالی `asoudeh_manual_20261021` وصل شد؛ فایل `.env` تغییر نکرده است. MongoDB محلی برای استفادهٔ بعدی روشن ماند.
- `AUTH_HASH_SECRET` در `backend/.env` وجود ندارد. احراز هویت/OTP به علت fail-closed بودن HMAC تا تنظیم secret توسط مالک محیط قابل تست نیست؛ secret ساخته یا در فایل نوشته نشده است.
- یک شروع اولیه backend پیش از بررسی امن نام پایگاه موجود در `.env` انجام شد. طبقه‌بندی فقط نشان داد URI به host محلی می‌رسد اما نام پایگاه در فهرست مجاز توسعه/تست نبود؛ backend فوراً متوقف و با پایگاه تازه جایگزین شد. Worker حذف حساب در startup اجرا می‌شود، بنابراین نمی‌توان تأیید کرد آیا آن اجرای کوتاه رکورد سررسیدشده‌ای را پاک کرده است یا خیر. فقط health endpoint درخواست شد؛ پیش از استفاده مجدد از آن پایگاه، مالک محیط باید وضعیت/backup محلی را بررسی کند. داده آن پایگاه خوانده یا چاپ نشد.

## اقدام بعدی

برای تست ورود و حذف حساب، مالک محیط باید `AUTH_HASH_SECRET` را با مقدار random و مستقل حداقل ۳۲ بایتی در محیط محلی پیکربندی و backend را restart کند؛ مقدار آن را در chat/commit ننویسد. از پایگاه تازهٔ محلی استفاده کنید، نه URI فعلی `.env`. پیش از production، SMS واقعی، تصمیم درباره لغو حذف، rollout ایندکس‌ها، استقرار امن شاخص‌ها، ارزیابی دسترس‌پذیری و آزمون عملیاتی لازم‌اند. حذف دسته همچنان تا تعیین fallback درآمد و topology تراکنشی غیرفعال بماند.
