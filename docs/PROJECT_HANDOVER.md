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
- ارسال واقعی SMS برای OTP یا دعوت caregiver وجود ندارد. شبیه‌ساز OTP فقط با تنظیم صریح در development فعال است؛ در غیر این صورت endpoint با خطای unavailable fail-closed می‌شود.

## ماتریس شکاف‌ها و اولویت بعدی

| اولویت | نیازمندی | وضعیت و محدودیت | گام بعدی / معیار پذیرش |
|---|---|---|---|
| P1 | حذف حساب با OTP و پاک‌سازی پس از مهلت مشخص (قانون کسب‌وکار PDF) | انجام شد: مهلت ۳۰روزه؛ دسترسی و نشست‌ها فوراً لغو و worker پاک‌سازی کامل را اجرا می‌کند. SMS production هنوز unavailable است. API فعلاً مسیر لغو ندارد. | پیش از production، برای شاخص `deletionScheduledAt` rollout امن انجام شود؛ متناسب با سیاست محصول، تصمیم بگیرید آیا قابلیت لغو در مهلت لازم است. |
| P1 | حذف دسته و انتقال تراکنش‌ها به fallback | عمداً غیرفعال است؛ تضمین هم‌زمانی بدون topology تراکنشی ممکن نیست و PDF برای fallback درآمد ابهام دارد. | تصمیم‌گیری درباره fallback درآمد و استفاده از replica set یا workflow معادل؛ آزمون هم‌زمانی و عدم از دست‌رفتن داده پیش از فعال‌سازی. |
| P1 برای بهره‌برداری | تحویل OTP از SMS provider | provider و اعتبارنامه در دسترس نیست؛ ورود production عمداً سرویس‌دهی نمی‌کند. | انتخاب/پیکربندی provider و آزمون محدودیت نرخ، عدم افشای OTP و شکست تحویل؛ simulator فقط برای development. |
| P2 | WCAG 2.2 AA، کنتراست، لمس و کاربردپذیری | تنظیمات اندازه متن/کنتراست موجود است؛ ارزیابی Lighthouse/assistive technology و آزمون واقعی کاربران انجام نشده. | اجرای ارزیابی دستی و خودکار، ثبت نتیجه و رفع موارد بحرانی؛ ادعای AA فقط پس از بررسی کامل. |
| P2 | تأیید browser و PWA/E2E | با Edge: ۱۴ آزمون Playwright توسعه و آزمون PWA production موفق؛ هر اجرا یک آزمون مربوط به حالت دیگر را عمداً skip کرد. Chromium خود Playwright در این محیط در دسترس نیست. | اجرای ماتریس مرورگرهای پشتیبانی‌شده و بررسی نصب PWA/تجربه کاربری روی دستگاه واقعی. |
| P2 | راه‌اندازی production و شاخص‌ها | هیچ deployment یا شاخصی در production اجرا/بررسی نشده است. شاخص‌های یکتای reminder completion و caregiver باید پیش از ترافیک واقعی ایمن rollout شوند. | بررسی داده‌های موجود و اجرای rollout شاخص‌ها توسط اپراتور روی replica set مناسب؛ سپس health check و smoke test. |
| P3 / خارج از MVP | OCR، Voice، Chatbot و اعلان‌های SMS/email/push | در scope نسخه فعلی پیاده‌سازی نشده‌اند. | فقط در صورت تصمیم محصول برای فاز بعدی. |

## چک‌لیست تکمیل گردش کار

| مرحله | وضعیت | شواهد / کار باقیمانده |
|---|---|---|
| بررسی مخزن و worktree | PASS | شاخه `main`، تغییرات قبلی حفظ شد؛ envهای محلی ignore هستند. |
| تطبیق specification و checkpoint | PASS | مستندات و PDF با پیاده‌سازی و تصمیم‌های ثبت‌شده تطبیق داده شدند. |
| حذف حساب و مهلت ۳۰روزه | PASS | OTP یک‌بارمصرف، قطع نشست و دسترسی فوری، worker و آزمون API. |
| backend tests/typecheck/lint/build | PASS | همه بررسی‌های backend موفق؛ ۹۲ تست API/unit. |
| frontend tests/build | PASS | typecheck/lint/build موفق؛ ۱۴ E2E و آزمون PWA production موفق. |
| محدودیت‌ها و آمادگی production | PARTIAL | SMS واقعی، لغو حذف، استقرار ایندکس‌ها، WCAG و deployment هنوز تأیید نشده‌اند. |
| stage و بازبینی patch | PASS | فقط ۵۳ فایل مرتبط stage؛ diff و اسکن فایل‌های محرمانه بازبینی شدند. |
| commit | PASS | `490d80e` با trailer هم‌نویس ساخته شد؛ به‌روزرسانی نهایی این handover جداگانه ثبت می‌شود. |
| push | PASS | commit `490d80e` روی `origin/main` تأیید شد؛ به‌روزرسانی نهایی handover هنوز push می‌شود. |
| اجرای محلی frontend/backend | PARTIAL | frontend روی `http://localhost:3000` و backend روی `http://localhost:5000` با پایگاه تازه و محلی اجرا هستند؛ `AUTH_HASH_SECRET` در env محلی موجود نیست و OTP fail-closed می‌ماند. |
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

- `npm run typecheck` — موفق (backend و frontend).
- `npm run lint` — موفق (backend و frontend).
- `npm run build:backend` — موفق.
- `npm run test:backend` — ۱۵ فایل موفق؛ ۹۲ تست موفق، صفر ناموفق، صفر skip. اجرا با `MONGODB_URI` و `TEST_MONGODB_URI` محدود به MongoDB loopback و دیتابیس اختصاصی `asoudeh_test`، env موقت بدون بارگذاری فایل محلی، و کلیدهای صرفاً آزمایشی انجام شد.
- `npm --prefix frontend run test:jalali` — ۳ موفق، صفر ناموفق. Node برای type stripping هشدار آزمایشی داد.
- `npm run build:frontend` — build production موفق؛ Next.js بارگذاری `.env.local` را گزارش کرد، اما محتوای آن باز یا چاپ نشد.
- Playwright با Microsoft Edge — مجموعه توسعه: ۱۴ موفق، صفر ناموفق، یک skip (آزمون PWA production به‌علت حالت dev). آزمون PWA در حالت production جداگانه: یک موفق، یک skip (آزمون dev). یک آزمون draft پس از اضافه‌کردن انتظار صریح برای UI آماده‌شده پایدار شد.
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

- شاخه `main` هنگام آغاز برابر `e26b01d` بود و پس از fetch بدون واگرایی ماند.
- commit پیاده‌سازی `490d80e` با پیام `feat: complete caregiver reports PWA and account deletion` روی `origin/main` push و تأیید شد. فایل‌های env و خروجی Playwright commit نشده‌اند.
- به‌روزرسانی نهایی handover پس از تأیید راه‌اندازی محلی، در انتظار commit و push مستندات است.
- تغییرات تحویل قبلی و جاری در commit ۵۳ فایل مرتبط حفظ شدند. فهرست زیر وضعیت تغییرها هنگام شروع این اجرا را نشان می‌دهد:

تغییرکرده:

`README.md`, `backend/src/app.ts`, `backend/src/controllers/caregiver.controller.ts`, `backend/src/controllers/reports.controller.ts`, `backend/src/models/CaregiverLink.ts`, `backend/src/services/caregiver.service.ts`, `backend/src/services/reports.service.ts`, `backend/src/services/transactions.service.ts`, `backend/src/tests/transactions.api.test.ts`, `backend/src/validators/budget.validator.ts`, `docs/API.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `frontend/app/(dashboard)/caregiver/page.tsx`, `frontend/app/(dashboard)/reports/page.tsx`, `frontend/app/(dashboard)/transactions/new/page.tsx`, `frontend/app/(dashboard)/transactions/page.tsx`, `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/lib/api/client.ts`, `frontend/playwright.config.ts`, `frontend/tests/auth.spec.ts`, `frontend/tests/budgets.spec.ts`, `frontend/tests/reminders.spec.ts`, `frontend/tests/transactions.spec.ts`.

جدید و ثبت‌نشده هنگام شروع:

`backend/src/models/AuditLog.ts`, `backend/src/routes/caregiver.routes.ts`, `backend/src/routes/reports.routes.ts`, `backend/src/tests/accountDeletion.api.test.ts`, `backend/src/tests/caregiver.api.test.ts`, `backend/src/tests/reports.api.test.ts`, `backend/src/validators/caregiver.validator.ts`, `backend/src/validators/report.validator.ts`, `backend/src/services/accountDeletion.service.ts`, `frontend/app/(dashboard)/caregiver/[seniorId]/page.tsx`, `frontend/app/(dashboard)/layout.tsx`, `frontend/app/manifest.ts`, `frontend/components/ServiceWorkerRegistration.tsx`, `frontend/public/icons/asoudeh.svg`, `frontend/public/offline.html`, `frontend/public/sw.js`, `frontend/tests/pwa.spec.ts`, `frontend/tests/reports-caregiver.spec.ts`.

این سند نیز به‌عنوان فایل تحویل جدید اضافه شده است. علاوه بر تغییرات تحویل قبلی، موارد زیر برای حذف حساب و مستندات آن تغییر یافتند:

`README.md`, `backend/src/controllers/auth.controller.ts`, `backend/src/middleware/auth.ts`, `backend/src/models/User.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/server.ts`, `backend/src/services/accountDeletion.service.ts`, `backend/src/services/auth.service.ts`, `backend/src/services/caregiver.service.ts`, `backend/src/tests/accountDeletion.api.test.ts`, `backend/src/validators/auth.validator.ts`, `docs/API.md`, `docs/DECISIONS.md`, `docs/PROJECT_HANDOVER.md`, `docs/ROADMAP.md`, `frontend/app/(dashboard)/settings/page.tsx`, `frontend/tests/auth.spec.ts`.

تست E2E حذف حساب به سطح فایل منتقل شد. `loadData` در صفحه تراکنش از callback وابسته به شماره صفحه به تابع پایدار با صفحهٔ پیش‌فرض ۱ تبدیل شد تا تغییر صفحه موجب اجرای مجدد و ناخواستهٔ فرایند بازیابی draft نشود. تست draft اکنون پس از reload برای آماده‌شدن رابط انتظار می‌کشد؛ رفتار پاک‌سازی پیش‌نویس نامعتبر و جداسازی حساب‌ها بررسی شد.

## وضعیت راه‌اندازی محلی

- MongoDB محلی روی `127.0.0.1:27017` با فرایند `mongod` فعال است.
- Frontend در `http://localhost:3000` و backend در `http://localhost:5000` پاسخ می‌دهند. `GET /login` و `GET /api/v1/health` هر دو HTTP 200 داده‌اند؛ لاگ‌ها خطای startup نشان ندادند.
- Backend فعلی با override موقت فرایند به پایگاه تازه و خالی `asoudeh_manual_20261021` وصل است؛ فایل `.env` تغییر نکرده است.
- `AUTH_HASH_SECRET` در `backend/.env` وجود ندارد. احراز هویت/OTP به علت fail-closed بودن HMAC تا تنظیم secret توسط مالک محیط قابل تست نیست؛ secret ساخته یا در فایل نوشته نشده است.
- یک شروع اولیه backend پیش از بررسی امن نام پایگاه موجود در `.env` انجام شد. طبقه‌بندی فقط نشان داد URI به host محلی می‌رسد اما نام پایگاه در فهرست مجاز توسعه/تست نبود؛ backend فوراً متوقف و با پایگاه تازه جایگزین شد. Worker حذف حساب در startup اجرا می‌شود، بنابراین نمی‌توان تأیید کرد آیا آن اجرای کوتاه رکورد سررسیدشده‌ای را پاک کرده است یا خیر. فقط health endpoint درخواست شد؛ پیش از استفاده مجدد از آن پایگاه، مالک محیط باید وضعیت/backup محلی را بررسی کند. داده آن پایگاه خوانده یا چاپ نشد.

## اقدام بعدی

برای تست ورود و حذف حساب، مالک محیط باید `AUTH_HASH_SECRET` را با مقدار random و مستقل حداقل ۳۲ بایتی در محیط محلی پیکربندی و backend را restart کند؛ مقدار آن را در chat/commit ننویسد. از پایگاه تازهٔ محلی استفاده کنید، نه URI فعلی `.env`. پیش از production، SMS واقعی، تصمیم درباره لغو حذف، rollout ایندکس‌ها، استقرار امن شاخص‌ها، ارزیابی دسترس‌پذیری و آزمون عملیاتی لازم‌اند. حذف دسته همچنان تا تعیین fallback درآمد و topology تراکنشی غیرفعال بماند.
