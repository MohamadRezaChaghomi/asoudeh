# Roadmap

## Phase 0
Repository, environment, GitHub, MongoDB, frontend/backend bootstrap. **Status:** bootstrap is present.

## Phase 1
Express + Mongoose + configuration + error handling + validation. **Status:** core configuration, health endpoint, error handling, auth/profile, category, and transaction validation/routes are present; other domain features remain unfinished.

## Phase 2
Authentication and user profile. **Status:** OTP-based registration/login flow, cookie sessions, refresh/logout, and profile editing are implemented in the current code. OTP delivery uses a development-only simulator; no real SMS provider is connected, so production OTP delivery is unavailable.

## Phase 3
Category management, transaction core, and dashboard. **Status:** authenticated personal category listing, creation, editing, and activation controls are implemented; the development-only system-category seed is idempotent and limited to the local `asoudeh_dev` database. The category DELETE API explicitly returns `409 CATEGORY_DELETION_UNAVAILABLE` without changing data. Enabling reassignment requires transaction-capable MongoDB (or an equivalent safe schema/workflow) and a confirmed type-correct income fallback. The authenticated transaction API and Persian/RTL page support ownership-checked listing, creation, editing, soft deletion, 20-item pagination, server-enforced ten-second undo, a three-step form, and Jalali date selection. The authenticated dashboard shows current Solar Hijri month totals, the specified remaining calculation, five recent transactions, and stored reminders due within seven days. Reminder management remains unfinished.

## Phase 4
Budget and reminder. **Status:** monthly personal expense budgets are implemented with authenticated CRUD, Solar Hijri month selection, unique user/category/month assignments, exact spending totals, 80%/100% status thresholds, and a Persian/RTL page. Reminder management is implemented with authenticated CRUD/archive and idempotent month-scoped completion history, Jalali monthly recurrence, short-month clamping, dashboard integration, and a Persian/RTL management page. No external notification delivery is implemented.

## Phase 5
Reports and caregiver read-only. **Status:** not implemented; pages and backend modules remain placeholders, and routes are not registered.

## Phase 6
Accessibility, PWA and offline draft. **Status:** profile-level font-size and high-contrast settings exist; PWA and offline-draft work remain unfinished.

## Phase 7
Unit/API/E2E tests and usability testing. **Status:** API tests cover authentication, categories, transactions, pagination, undo, seed idempotency, dashboard calculations, monthly budgets, and reminder lifecycle; Jalali conversion/recurrence unit tests and authentication, transaction, budget, and reminder UI tests exist. Broader feature coverage and usability testing remain unfinished.

## Phase 8
Deployment, seed data, documentation and demo. **Status:** a guarded local development system-category seed command is available; deployment and demo work remain unfinished.
