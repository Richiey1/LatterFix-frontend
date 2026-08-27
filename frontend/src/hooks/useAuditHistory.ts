import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchAuditRecords, type AuditFilters, type AuditRecord } from '../services/audit';
import { fetchContractEvents, type SorobanContractEvent } from '../services/transactionHistory';
import { getContractId } from '../services/sorobanTaskContract';

export interface TimelineEntry {
  id: string;
  kind: 'audit' | 'contract-event';
  timestamp: string;
  ledger: number;
  record?: AuditRecord;
  event?: SorobanContractEvent;
}

const AUDIT_PAGE_SIZE = 20;
const CONTRACT_START_LEDGER = 5_000_000;

export function useAuditHistory(filters: AuditFilters & { address?: string | null }) {
  return useInfiniteQuery({
    queryKey: ['audit-history', filters] as const,
    queryFn: async ({ pageParam = 1 }) => {
      const page = pageParam as number;
      const auditPage = await fetchAuditRecords(page, AUDIT_PAGE_SIZE, {
        sourceAccount: filters.address ?? filters.sourceAccount,
        from: filters.from,
        to: filters.to,
        status: filters.status,
        employee: filters.employee,
        asset: filters.asset,
      });

      let contractEvents: SorobanContractEvent[] = [];
      if (page === 1) {
        try {
          const contractId = getContractId();
          if (contractId) {
            const events = await fetchContractEvents(contractId, CONTRACT_START_LEDGER, 20);
            const fromTs = filters.from ? new Date(filters.from).getTime() : undefined;
            const toTs = filters.to ? new Date(filters.to).getTime() : undefined;
            contractEvents = events.filter((e) => {
              const ts = new Date(e.ledgerClosedAt).getTime();
              if (fromTs !== undefined && ts < fromTs) return false;
              if (toTs !== undefined && ts > toTs) return false;
              return true;
            });
          }
        } catch {
          // indexer may be empty — timeline still shows audit records
        }
      }

      const timeline: TimelineEntry[] = [
        ...auditPage.records.map((r) => ({
          id: `audit-${r.id}`,
          kind: 'audit' as const,
          timestamp: r.createdAt,
          ledger: r.ledger,
          record: r,
        })),
        ...contractEvents.map((e) => ({
          id: `evt-${e.id}`,
          kind: 'contract-event' as const,
          timestamp: e.ledgerClosedAt,
          ledger: e.ledger,
          event: e,
        })),
      ];

      return {
        timeline,
        auditPage,
        nextPage: auditPage.page < auditPage.totalPages ? auditPage.page + 1 : undefined,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30_000,
  });
}
