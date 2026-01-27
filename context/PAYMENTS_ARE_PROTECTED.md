# PAYMENTS ARE PROTECTED — STRIPE SAFETY RULES

## Purpose

This document exists to **protect all payment-critical logic** while development is happening in parallel.

Stripe payments, payouts, refunds, and booking payment state are **foundational infrastructure**.  
They must not be modified, inferred, refactored, or “cleaned up” accidentally — especially by AI tools.

If a change risks affecting how money moves, **stop and ask first**.

---

## ABSOLUTE RULE

> **Do not read, modify, or reference payment-related files unless explicitly instructed to do so.**

This rule applies to:
- Humans
- AI tools (including Cursor)
- Refactors
- “Small” changes
- “Just checking something”

If a task requires touching payments, it must be explicitly approved.

---

## PAYMENT-CRITICAL SURFACES (DO NOT TOUCH)

### Backend
- Stripe client setup
- Stripe Connect logic
- PaymentIntent / Charge creation
- Transfers and payouts
- Refund logic
- Webhook handlers
- Idempotency / retry logic
- Environment variables related to Stripe

### Database
- Payment tables or fields
- Reservation payment status
- Foreign keys linking reservations to Stripe objects
- Any schema that affects charging or payouts

### Frontend
- Checkout flow
- Payment submission
- Payment confirmation
- Receipt generation
- Payment status rendering

---

## SAFE AREAS FOR DEVELOPMENT

The following areas are generally safe to work on **without touching payments**:

- Explore / discovery UI
- Venue profile pages (non-financial)
- Seat / table inventory UI
- Filters, search, sorting
- Deals, badges, and promotions (UI only)
- Directions / external links
- Onboarding screens
- Copy, empty states, styling
- Non-payment dashboard UI shells

If UI needs to reference payment data, use **mocked or placeholder fields only**  
(e.g. `paymentStatus`, `amountPaid`, `receiptUrl`) and do not infer logic.

---

## STRIPE IS A BLACK BOX

Stripe should be treated as an **external service with stable interfaces**.

UI and product logic should:
- Call payment endpoints
- React to returned states
- Never embed Stripe logic directly

This allows Stripe to evolve independently and safely.

---

## BRANCHING & MERGE SAFETY

- All payment work lives in a dedicated branch until complete.
- Non-payment work must happen in separate branches.
- `main` must always be in a releasable state.
- Small, frequent merges are preferred.
- Conflicts touching payment logic must be resolved intentionally — never guessed.

---

## IF YOU ARE UNSURE

If you are not 100% certain that a change is safe:

1. STOP
2. Ask for clarification
3. Do not proceed until confirmed

**It is always better to ask than to accidentally break payments.**

---

## GUIDING PRINCIPLE

> **Payments must remain boring, predictable, and correct.**

Speed, polish, or convenience must never compromise payment safety.

---

## REQUIRED FOR AI TOOLS (INCLUDING CURSOR)

When working on non-payment features, AI tools must:
- Avoid opening payment-critical files
- Avoid inferring payment behavior
- Avoid refactoring shared logic that could affect payments
- Ask before touching anything related to Stripe

Failure to follow these rules risks real financial impact.

---

## Last Updated

This document is intentionally strict.  
It exists to prevent costly mistakes and protect users, venues, and the business.
