# راهنمای توسعه آسوده

## محیط فنی
- نسخه Node.js: `22.14.0` یا جدیدتر؛ نسخه پایه در `.nvmrc` ثبت شده است.
- فرانت‌اند: Next.js و TypeScript با تنظیم strict.
- بک‌اند: Node.js، Express و TypeScript با خروجی ESM در `backend/dist`.
- ESLint 9 در هر دو پروژه با flat config و بدون پرسش تعاملی اجرا می‌شود.

## دستورهای توسعه
- نصب تمیز وابستگی‌ها: `npm run install:all`
- اجرای backend در حالت توسعه: `npm run dev:backend`
- اجرای frontend در حالت توسعه: `npm run dev:frontend`
- بررسی نوع‌یابی: `npm run typecheck`
- بررسی lint: `npm run lint`
- تست‌های backend: `npm run test:backend`
- تست‌های رابط کاربری: `npm --prefix frontend run test:e2e` (پس از نصب مرورگر Playwright)
- تست تاریخ شمسی: `npm --prefix frontend run test:jalali`
- ساخت backend: `npm run build:backend`
- ساخت frontend: `npm run build:frontend`
- تست اتصال MongoDB فقط با URI پایگاه داده محلی و مستقل `asoudeh_test`: دستورهای `docs/ENVIRONMENT.md`

## ترتیب توسعه
1. راه‌اندازی محیط و Git
2. Backend foundation
3. Authentication
4. Frontend shell
5. Transactions
6. Categories
7. Budgets
8. Reminders
9. Reports
10. Caregiver
11. Accessibility/PWA
12. Tests
13. Deployment

## قانون مهم
تا زمانی که جریان اصلی ثبت هزینه/درآمد پایدار نشده، سراغ OCR، Voice و Chatbot نرو.

## Definition of Done
- Backend endpoint دارد.
- Validation دارد.
- Authorization/ownership بررسی شده.
- Frontend به API متصل است.
- Loading/Empty/Error state دارد.
- تست مسیر اصلی نوشته شده.
- روی موبایل بررسی شده.
- commit شده است.

تست health endpoint و قرارداد خطا در `backend/src/tests/health.test.ts` قرار دارد. تست‌های API به `TEST_MONGODB_URI` محلی و ایزوله `asoudeh_test` نیاز دارند؛ پیش از اجرای آن‌ها [راهنمای محیط و دیتابیس تست](./ENVIRONMENT.md) را بخوانید. تست اتصال MongoDB فقط ping انجام می‌دهد. تست SMS.ir معمولی mock است؛ تست Sandbox تنها با opt-in صریح درخواست شبکه‌ای می‌فرستد.

برای اجرای مرورگر با Microsoft Edge و اجرای PWA در production، از PowerShell در ریشهٔ مخزن استفاده کنید:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PWA_TEST = 'true'
Set-Location frontend
npx playwright test --workers=4
Set-Location ..
Remove-Item Env:PLAYWRIGHT_CHANNEL
Remove-Item Env:PWA_TEST
```

آمار آخرین ممیزی و پوشش‌های موجود در [راهنمای تست](./TESTING.md) ثبت می‌شوند؛ اجرای تست مرورگر به سرور Next.js و مرورگر نصب‌شده نیاز دارد.
