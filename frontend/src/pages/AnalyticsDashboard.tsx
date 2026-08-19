import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsData } from '../services/analyticsApi';
import PayrollLineChart from '../components/charts/PayrollLineChart';
import CurrencyPieChart from '../components/charts/CurrencyPieChart';
import SuccessRateBarChart from '../components/charts/SuccessRateBarChart';
import { Calendar } from 'lucide-react';

const AnalyticsDashboard: React.FC = () => {
  // Setup date range state (in a real app you might use a date picker library)
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-06-30');

  // Use TanStack query to fetch the analytics data
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics', startDate, endDate],
    queryFn: () => fetchAnalyticsData(startDate, endDate),
    staleTime: 60000, // cache for 1 minute
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payroll Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Overview of your organization's payroll metrics and transaction status.
          </p>
        </div>

        {/* Date Range Filters */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <Calendar className="w-5 h-5 text-slate-400 ml-2" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm border-none focus:ring-0 text-slate-700 dark:text-slate-300 outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm border-none focus:ring-0 text-slate-700 dark:text-slate-300 outline-none"
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          Failed to load analytics data. {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Trend Chart - Takes up 2 columns on large screens */}
            <div className="lg:col-span-2">
              <PayrollLineChart data={data.payrollTrends} />
            </div>

            {/* Currency Distribution Pie Chart */}
            <div className="lg:col-span-1">
              <CurrencyPieChart data={data.currencyDistribution} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Success/Failure Bar Chart */}
            <div className="lg:col-span-1">
              <SuccessRateBarChart data={data.successRates} />
            </div>
            
            {/* Summary Statistics Card */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold mb-6 text-slate-800 dark:text-white">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Processed</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {data.payrollTrends.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {(() => {
                      const success = data.successRates.find(r => r.status === 'Successful')?.count || 0;
                      const total = data.successRates.reduce((sum, r) => sum + r.count, 0);
                      return total > 0 ? Math.round((success / total) * 100) + '%' : '0%';
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
