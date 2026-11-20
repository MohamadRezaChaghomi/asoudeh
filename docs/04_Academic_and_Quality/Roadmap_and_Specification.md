# Roadmap and Product Specification

> **Status snapshot:** the roadmap below was recorded on 2026-11-02. It is planning context, not a live release dashboard. Check the source, [README.md](../../README.md), and [Testing_and_Performance.md](./Testing_and_Performance.md) before treating an item as current.

## Product specification summary

This section summarizes the Persian project specification in [`SPECIFICATION.pdf`](../SPECIFICATION.pdf). The source PDF and accompanying DOCX are retained as academic source documents; this summary is not a replacement for either file.

### Purpose, users, and principles

Asoudeh is a personal-finance application intended to make routine income and expense tracking simpler for older adults and people less comfortable with complex software. A user may grant a trusted caregiver limited, accepted, read-only, revocable access. The project emphasizes readable text and controls, short task flows, understandable errors, prevention of unintended actions, and user confirmation for financial actions.

Personas and usability goals in the original specification are proposals, not evidence from a completed user study. The source proposes interviewing and testing with a small number of older or less-experienced users and a caregiver, with informed consent, anonymity, and the right to stop.

### Original success criteria and evidence boundary

| Dimension | Original target or criterion | Evidence status |
|---|---|---|
| Technical operation | Frontend, backend, and MongoDB run together without critical demo failures. | Local builds and tests exist; production deployment is not certified. |
| API behavior | All automated tests for the principal API flows pass. | Current backend API suites were incomplete because the local test-database guard rejected the configured URIs. |
| Data protection | Tests show no unauthorized data access. | Owner isolation and caregiver checks have local code/test evidence; this is not a penetration test. |
| Usability | Record an expense in about 30 seconds or less; target roughly 90% or higher task success and SUS 70 or higher if evaluated. | No representative-user study or measured SUS/task-success result is recorded. |
| Accessibility | The source names a Lighthouse Accessibility score around 95 or higher where possible and cites WCAG 2.2 AA as the baseline. | No WCAG conformance certification is claimed; see the verification limits in the testing guide. |
| Performance | Main pages should load in under three seconds on a typical connection. | Local, dated measurements exist; a representative network/device benchmark is not established. |

All numerical items above are targets unless a dated measured result is explicitly stated. Do not present an unmeasured target as a result.

### MVP scope and deferred scope

The original MVP includes:

- Mobile-number OTP login/registration, profile, and accessibility settings.
- Income/expense entry, categories, transaction listing/editing, dashboard, monthly budgets, reminders, and simple reports.
- Accepted, permission-limited, read-only caregiver access and revocation.
- Error handling and automated tests.

The original specification defers bank connectivity, real money transfers, professional financial/tax/legal/medical advice, and a professional accounting or investment system. It lists a guide assistant, voice input, receipt OCR, savings goals, PWA/offline work, richer caregiver features, and expanded analytics as possible later scope. Current code does not implement all originally proposed behavior; consult the [API contract](../02_API_and_Development/API_Documentation.md) and [system architecture](../01_Architecture_and_Design/System_Architecture.md). In particular, category deletion remains intentionally disabled and no external reminder or invitation delivery is available.

### Functional and quality requirements

The original functional catalog uses FR-01 through FR-19 for OTP/session, profile, income/expense, filtering, categories, budgets, reminders, dashboard, reports, accessibility preferences, and caregiver behavior. Project traceability adds cross-cutting FR-20 onward for ownership, errors, account deletion, optional assistant, browser speech, limited PWA/drafts, health checks, and public content. The detailed implementation evidence and statuses are in [Testing_and_Performance.md](./Testing_and_Performance.md) and [Project_Report.md](./Project_Report.md).

The source quality requirements include WCAG 2.2 AA as a target baseline, readable/mobile layouts, support for current Chrome/Safari/Firefox/Edge across device sizes, modular TypeScript, automated tests for important paths, and no unauthorized access to financial data. Their completion must be evaluated using actual evidence; a UI preference or automated test alone does not prove conformance.

### Original architecture and UX constraints

The specification proposes a Next.js/React/TypeScript/Tailwind browser UI, a Node.js/Express/TypeScript REST API, and MongoDB through Mongoose. It calls for modular boundaries, code-first design tokens, and early wireframes for key flows. Money is entered in toman; display should use grouped Persian numerals and a clear currency label. Jalali dates are used in the Persian interface, with server-side time normalization.

Interaction principles are one primary task per step, simple language, prevention and recovery for errors, clear feedback, user control, and confirmation for sensitive operations. The source proposes large readable text and touch targets, visible focus, contrast that meets AA, and not relying on color alone. These are design requirements, not proof of accessibility conformance.

## Roadmap snapshot

### Implemented foundation (snapshot from 2026-11-02)

| Phase | Scope | Status recorded in the source snapshot |
|---|---|---|
| 0 | Repository, environment, GitHub, MongoDB, and application bootstrap | Bootstrap present. |
| 1 | Express, Mongoose, configuration, errors, validation, and feature APIs | Core backend paths implemented; production operations remain. |
| 2 | OTP authentication and profile | OTP/session flow, account deletion scheduling, simulator, and SMS.ir adapter implemented; live credentials/delivery unverified. |
| 3 | Categories, transaction core, dashboard | Core flows implemented; category physical deletion intentionally disabled. |
| 4 | Budgets and reminders | Monthly budgets and in-app reminders implemented; external delivery absent. |
| 5 | Reports and caregiver read-only access | Core read-only flows implemented; invitation delivery out of band; production indexes not verified. |
| 6 | Accessibility, PWA, and offline draft | Limited preferences, generic offline shell, and opt-in session draft implemented; conformance and broad usability unverified. |
| 7 | Unit/API/E2E tests and usability testing | Automated test coverage exists; broader coverage and real-user study remain. |
| 8 | Deployment, seed data, docs, and demo | Seed/documentation scaffolding exists; deployment and demo work are not production proof. |

### Release-risk priorities

1. **Dependency and release stabilization:** maintain clean production dependency audits; verify clean-install lint, typecheck, tests, and builds; keep standard tests free of real SMS requests.
2. **Staging operational safety:** configure same-site HTTPS, secure cookies, secrets, indexes, backups/restore, health/readiness, deletion-worker monitoring, and demonstrated rollback.
3. **OTP delivery readiness:** obtain approved SMS.ir credentials/template, keep the simulator off in production, and separately verify provider acceptance and handset delivery.
4. **Data integrity and feature gaps:** decide whether safe category deletion is required; define a type-correct fallback and concurrency-safe workflow; retain the disabled behavior until it is safe.
5. **Accessibility and product validation:** run keyboard, assistive-technology, zoom, contrast, touch-target, real-device, and representative-user evaluation. Enable the guide assistant only after provider privacy review.

Offline transaction synchronization, notifications, OCR, voice input, exports, and multi-account behavior are deferred. Define user value, privacy, safety, and acceptance criteria before implementation.

## Original 14-week academic schedule (historical)

The source specification proposes a 14-week plan: finalize requirements/wireframes; bootstrap frontend/backend/database; implement auth; build transaction/category APIs; deliver transaction flows; add dashboard; budgets; reminders and early feedback; reports; caregiver access; responsive/accessibility review; E2E/security testing; final usability/deployment/documentation; then demo and handoff. This is an original planning artifact, not a claim that the project followed that schedule or that those exit criteria have all passed.

## Academic source

- [Specification PDF](../SPECIFICATION.pdf) — original Persian specification; retained unchanged.
- [Specification DOCX](../SPECIFICATION.docx) — companion source document; retained unchanged.
- [Project_Report.md](./Project_Report.md) — academic analysis and detailed requirements evidence.
