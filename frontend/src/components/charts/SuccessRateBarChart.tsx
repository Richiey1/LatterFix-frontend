import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { SuccessRateData } from '../../services/analyticsApi';

interface Props {
  data: SuccessRateData[];
}

const getBarColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'successful': return '#10b981';
    case 'failed': return '#ef4444';
    case 'pending': return '#f59e0b';
    default: return '#3b82f6';
  }
};

const SuccessRateBarChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="h-[300px] w-full bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Transaction Status</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.2} />
          <XAxis dataKey="status" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
          />
          <Legend />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SuccessRateBarChart;
