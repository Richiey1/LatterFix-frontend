# Bulk Payment Status Tracker (#37)

## Summary

The tracker component described in #37 — batch table, per-recipient
expansion, Stellar Explorer links, and real-time confirmation counts
via `SocketProvider` — already existed in the codebase
(`BulkPaymentStatusTracker.tsx` + `bulkPaymentStatus.ts`), but nothing
mounted it anywhere, and the app didn't actually build on `main`. This
PR wires the tracker up and fixes what stood in the way.

- Fixes a build-breaking bug found along the way: `App.tsx` referenced
  `CustomReportBuilder` without importing it, and imported
  `AdminPanel`/`Debugger` without ever routing to them, despite
  `AppNav` already linking to `/admin` and `/debug`.
- Adds a `BulkPaymentTracker` page and wires it to a new
  `/bulk-payments` route with a matching nav link.
- Removes a retry code path that called `retry_failed_batch` on the
  `bulk_payment` Soroban contract — that method doesn't exist on the
  deployed contract, and the backend doesn't invoke this contract for
  payroll at all (it submits classic Stellar multi-op payments
  directly), so the call could never have succeeded.
- Disables the "Retry Failed" button (with an explanatory tooltip)
  instead of wiring it to the existing `execute` endpoint, because
  that endpoint reprocesses every item in a run with no status filter
  — retrying a partially-failed batch would re-pay recipients whose
  payments already succeeded.

## Acceptance criteria status

| Criterion | Status |
|---|---|
| Table lists each batch run with employee count and total amount | ✅ |
| Per-row expansion shows per-recipient status (pending/confirmed/failed) | ✅ |
| Transaction hash links to Stellar Explorer | ✅ |
| Real-time confirmation count updates via SocketProvider | ✅ |
| Failed rows trigger a retry option that re-invokes the contract | ⚠️ Intentionally disabled — see below |

## Why retry is disabled, not implemented

Re-invoking a per-recipient retry correctly needs a backend change
that doesn't exist yet:

- The contract's only failure-recovery entrypoint is
  `refund_failed_payment(batch_id: u64, payment_index: u32)`, which
  refunds held funds back to the sender — it does not resend to the
  recipient, and there's no on-chain resend primitive at all.
- Neither `payroll_runs` nor `payroll_items` stores the numeric
  on-chain `batch_id`/`payment_index` needed to call it; `batch_id` in
  the DB is an app-generated string with no link to the contract's
  array index.
- The backend doesn't call the Soroban contract for payroll in the
  first place — payments go out as classic Stellar multi-op
  transactions from `payrollWorker.ts`.
- The only existing "run this batch" endpoint
  (`POST /runs/:id/execute`) has no item-level filtering, so calling
  it on a partially-failed run would resubmit payment to already-`completed`
  recipients.

Shipping a "working" retry button on top of any of these would either
throw on every click or silently double-pay real payroll. Landing the
tracker now with retry visibly disabled (tooltip explains why) seemed
safer than blocking the whole feature on a backend redesign, or
shipping something that moves money incorrectly.

**Follow-up needed:** a backend endpoint that retries only
`failed`/`pending` items for a run, and either a schema change to
track on-chain `batch_id`/`payment_index` or a decision to keep retry
entirely off-chain (resubmit via the same classic-payment path the
worker already uses, just scoped to failed items).

## Testing

- `tsc -b --noEmit` — clean (previously failed on `main`, see fix
  commit).
- `eslint` — no errors/warnings on touched files.
- Drove the app in headless Chrome against the dev server: `/bulk-payments`
  renders the heading and tracker card without errors; the "Bulk
  Payments" nav link navigates correctly from another page. No backend
  was running, so the only console noise was expected
  `ERR_CONNECTION_REFUSED` from the audit-log fetch and WebSocket
  connection — no React crashes.
