import { useState, useMemo, useEffect } from 'react';
import { Button, Card, Icon } from '@stellar/design-system';
import { useNotification } from '../hooks/useNotification';

// Define all possible columns for the report
type ReportColumn = {
  id: string;
  label: string;
};

const ALL_COLUMNS: ReportColumn[] = [
  { id: 'worker_id', label: 'Worker ID' },
  { id: 'amount', label: 'Amount' },
  { id: 'asset', label: 'Asset' },
  { id: 'setup_date', label: 'Stream Setup Date' },
  { id: 'payout_date', label: 'Expected Payout Date' },
  { id: 'status', label: 'Status' },
];

// Preview data state (fetched from backend)
type PreviewRow = Record<string, any>;

const CustomReportBuilder = () => {
  const { notifyError, notifySuccess } = useNotification();

  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMNS.map((c) => c.id));
  const [startDate, setStartDate] = useState<string>('2026-02-01');
  const [endDate, setEndDate] = useState<string>('2026-02-28');
  const [organizationPublicKey, setOrganizationPublicKey] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');

  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const activeColumns = ALL_COLUMNS.filter((c) => selectedColumns.includes(c.id));

  // Fetch preview from backend when org public key or date range changes
  useEffect(() => {
    let mounted = true;
    const fetchPreview = async () => {
      if (!organizationPublicKey) {
        setPreviewData([]);
        return;
      }

      setIsLoadingPreview(true);
      try {
        const params = new URLSearchParams();
        params.set('orgPublicKey', organizationPublicKey);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        params.set('limit', '200');

        const res = await fetch(`/api/payroll/transactions?${params.toString()}`, {
          credentials: 'same-origin',
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to fetch preview');
        const rows = (json?.data && (json.data.data || json.data)) || [];
        if (mounted) setPreviewData(Array.isArray(rows) ? rows : []);
      } catch (err: any) {
        if (mounted) {
          setPreviewData([]);
          notifyError('Preview load failed', err?.message ?? String(err));
        }
      } finally {
        if (mounted) setIsLoadingPreview(false);
      }
    };

    fetchPreview();
    return () => {
      mounted = false;
    };
  }, [organizationPublicKey, startDate, endDate, notifyError]);

  // Local client-side filtered data (in case backend returned broader set)
  const filteredData = useMemo(() => {
    const start = startDate ? new Date(startDate) : new Date('2000-01-01');
    const end = endDate ? new Date(endDate) : new Date('2100-01-01');
    return previewData.filter((row) => {
      const rowDate = new Date(row.setup_date || row.period_start || row.timestamp || '1970-01-01');
      return rowDate >= start && rowDate <= end;
    });
  }, [previewData, startDate, endDate]);

  const handleExport = async () => {
    if (!organizationPublicKey) {
      notifyError('Organization public key is required for export');
      return;
    }
    if (!batchId) {
      notifyError('Payroll batch ID is required for export');
      return;
    }

    try {
      const payload = { kind: 'payroll', organizationPublicKey, batchId };
      const res = await fetch('/api/v1/exports/download-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Export token request failed');

      const url =
        format === 'excel' ? json.excelUrl || json.downloadUrl : json.csvUrl || json.downloadUrl;
      if (!url) throw new Error('No download URL returned');

      notifySuccess('Export ready', 'Opening download in new tab');
      window.open(url, '_blank');
    } catch (err: any) {
      notifyError('Export failed', err?.message ?? String(err));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Report Builder</h1>
        <p className="text-gray-600">
          Select columns and date ranges to preview and export custom payroll data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Controls Sidebar */}
        <div className="md:col-span-1 space-y-6 flex flex-col">
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Date Range</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Export Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Public Key
                  </label>
                  <input
                    type="text"
                    placeholder="G..."
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={organizationPublicKey}
                    onChange={(e) => setOrganizationPublicKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payroll Batch ID
                  </label>
                  <input
                    type="text"
                    placeholder="batch_123"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 bg-white text-gray-800"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'csv' | 'excel')}
                  >
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Columns</h3>
              <div className="space-y-2">
                {ALL_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"
                      checked={selectedColumns.includes(col.id)}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span className="text-gray-700 text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Button
            onClick={handleExport}
            variant="primary"
            size="md"
            className="w-full flex justify-center mt-auto"
          >
            <Icon.DownloadCloud01 className="mr-2" />
            Export Data
          </Button>
        </div>

        {/* Live Preview Pane */}
        <div className="md:col-span-3">
          <Card>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-xl">Live Preview</h3>
                <div className="flex items-center space-x-3">
                  {isLoadingPreview ? (
                    <span className="text-sm text-gray-500">Loading preview…</span>
                  ) : (
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {filteredData.length} records found
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                {activeColumns.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {activeColumns.map((col) => (
                          <th
                            key={col.id}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData.map((row, rowIdx) => (
                        <tr key={row.id ?? row.worker_id ?? rowIdx} className="hover:bg-gray-50">
                          {activeColumns.map((col) => (
                            <td
                              key={col.id}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                            >
                              {String(row[col.id] ?? row[col.id as keyof PreviewRow] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td
                            colSpan={Math.max(1, activeColumns.length)}
                            className="px-6 py-8 text-center text-gray-500"
                          >
                            {isLoadingPreview
                              ? 'Loading preview...'
                              : 'No data found for the selected date range.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    Please select at least one column to preview data.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;
