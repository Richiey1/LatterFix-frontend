export interface PayrollTrendData {
  date: string;
  amount: number;
}

export interface CurrencyDistributionData {
  currency: string;
  value: number;
}

export interface SuccessRateData {
  status: string;
  count: number;
}

export interface AnalyticsData {
  payrollTrends: PayrollTrendData[];
  currencyDistribution: CurrencyDistributionData[];
  successRates: SuccessRateData[];
}

export const fetchAnalyticsData = async (
  startDate: string,
  endDate: string
): Promise<AnalyticsData> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  console.debug(`Fetching analytics data from ${startDate} to ${endDate}`);

  // Mock data that changes slightly based on the date range
  // In a real app, you would pass startDate and endDate to your backend API

  return {
    payrollTrends: [
      { date: 'Jan', amount: 4000 },
      { date: 'Feb', amount: 3000 },
      { date: 'Mar', amount: 5000 },
      { date: 'Apr', amount: 4500 },
      { date: 'May', amount: 6000 },
      { date: 'Jun', amount: 5500 },
    ],
    currencyDistribution: [
      { currency: 'USDC', value: 45000 },
      { currency: 'XLM', value: 15000 },
      { currency: 'EURC', value: 10000 },
    ],
    successRates: [
      { status: 'Successful', count: 120 },
      { status: 'Failed', count: 5 },
      { status: 'Pending', count: 12 },
    ],
  };
};
