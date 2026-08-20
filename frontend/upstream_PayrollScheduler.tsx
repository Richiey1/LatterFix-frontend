import React, { useEffect, useState } from 'react';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { useAutosave } from '../hooks/useAutosave';

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: 'weekly' | 'monthly';
  startDate: string;
}

const initialFormState: PayrollFormState = {
  employeeName: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
};

export default function PayrollScheduler() {
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);

  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    'payroll-scheduler-draft',
    formData
  );

  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
    }
  }, [loadSavedData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-4xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Payroll <span className="text-accent">Scheduler</span>
          </h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">
            Automated distribution engine
          </p>
        </div>
        <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 card glass noise"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
            Employee Name
          </label>
          <input
            type="text"
            name="employeeName"
            value={formData.employeeName}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium"
            placeholder="e.g. Satoshi Nakamoto"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
            Amount (USD equivalent)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">$</span>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full bg-black/20 border border-hi rounded-xl p-4 pl-8 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
            Distribution Frequency
          </label>
          <select
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer"
          >
            <option value="weekly" className="bg-surface">
              Weekly
            </option>
            <option value="monthly" className="bg-surface">
              Monthly
            </option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
            Commencement Date
          </label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
          />
        </div>

        <div className="md:col-span-2 pt-6">
          <button
            id="tour-init-payroll"
            type="submit"
            className="w-full py-4 bg-accent text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-accent/10 uppercase tracking-widest text-sm"
          >
            Initialize Payroll Stream
          </button>
        </div>
      </form>
    </div>
  );
}
