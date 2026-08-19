import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';

// Payroll runs are scoped server-side by the signed-in employer JWT (see
// bulkPaymentStatus.ts), so this id is a placeholder until org-scoped auth exists.
const ORGANIZATION_ID = 1;

export default function BulkPaymentTracker() {
  return (
    <div className="space-y-8 page-fade">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight">Bulk Payment Tracker</h1>
        <p className="text-xs text-muted">
          Track bulk payroll runs against the backend audit log and on-chain confirmation state
          from the bulk_payment contract.
        </p>
      </div>

      <BulkPaymentStatusTracker organizationId={ORGANIZATION_ID} />
    </div>
  );
}
