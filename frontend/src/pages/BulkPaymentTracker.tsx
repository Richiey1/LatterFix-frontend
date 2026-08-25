import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';
import { PayrollScheduleCard } from '../components/PayrollScheduleCard';

// Payroll runs are scoped server-side by the signed-in employer JWT (see
// bulkPaymentStatus.ts), so this id is a placeholder until org-scoped auth exists.
const ORGANIZATION_ID = 1;

export default function BulkPaymentTracker() {
  return (
    <div className="space-y-8 page-fade">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Bulk Payment & Payroll Scheduling
        </h1>
        <p className="text-xs text-muted">
          Configure multi-currency recurring payroll schedules, track bulk payment runs against the
          backend audit log, and monitor on-chain transaction confirmation states.
        </p>
      </div>

      {/* Payroll Scheduling Configuration & Countdown Card */}
      <PayrollScheduleCard />

      {/* On-chain Bulk Payment Status Tracker */}
      <BulkPaymentStatusTracker organizationId={ORGANIZATION_ID} />
    </div>
  );
}
