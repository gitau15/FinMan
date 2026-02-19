import { type Transaction } from '../db';
import { differenceInDays, isSameMonth } from 'date-fns';

export interface RecurringBill {
  merchant: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  lastDate: Date;
  nextExpectedDate: Date;
}

export interface SpendingVelocity {
  dailyBurnRate: number;
  velocityRatio: number; // 0-1, where 1 = on track
  status: 'over' | 'under' | 'on-track';
  projectedEndBalance: number;
  daysInMonth: number;
  daysRemaining: number;
}

/**
 * Detects recurring bills based on transaction history
 * Uses heuristic approach: looks for same merchants appearing multiple times
 */
export function detectRecurringBills(transactions: Transaction[]): RecurringBill[] {
  const merchantTransactions: Map<string, Transaction[]> = new Map();

  // Group transactions by merchant
  transactions.forEach(t => {
    if (t.type !== 'receive') {
      const key = t.merchant.toLowerCase();
      if (!merchantTransactions.has(key)) {
        merchantTransactions.set(key, []);
      }
      merchantTransactions.get(key)!.push(t);
    }
  });

  const recurringBills: RecurringBill[] = [];
  const now = new Date();

  // Analyze each merchant's transaction pattern
  merchantTransactions.forEach((txns, merchant) => {
    if (txns.length < 2) return; // Need at least 2 transactions to detect pattern

    // Sort by date
    const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate intervals between transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = differenceInDays(sorted[i].date, sorted[i - 1].date);
      if (days > 0) intervals.push(days);
    }

    if (intervals.length === 0) return;

    // Determine frequency based on average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    let frequency: 'weekly' | 'biweekly' | 'monthly' = 'monthly';
    let expectedDays = 30;

    if (avgInterval < 10) {
      frequency = 'weekly';
      expectedDays = 7;
    } else if (avgInterval < 20) {
      frequency = 'biweekly';
      expectedDays = 14;
    }

    // Calculate average amount
    const avgAmount = sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length;

    // Predict next occurrence
    const lastTransaction = sorted[sorted.length - 1];
    const nextExpectedDate = new Date(lastTransaction.date);
    nextExpectedDate.setDate(nextExpectedDate.getDate() + expectedDays);

    // Only include if next date is within 60 days
    if (differenceInDays(nextExpectedDate, now) <= 60 && differenceInDays(nextExpectedDate, now) >= -7) {
      recurringBills.push({
        merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1),
        amount: Math.round(avgAmount),
        frequency,
        lastDate: lastTransaction.date,
        nextExpectedDate
      });
    }
  });

  // Sort by next expected date
  return recurringBills.sort((a, b) => a.nextExpectedDate.getTime() - b.nextExpectedDate.getTime());
}

/**
 * Calculates spending velocity and projects end-of-month balance
 */
export function calculateSpendingVelocity(
  transactions: Transaction[],
  monthlyBudget: number,
  currentBalance: number
): SpendingVelocity {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Get the last day of current month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInMonth = lastDayOfMonth;
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  // Calculate spending this month
  const monthlyExpenses = transactions
    .filter(t => {
      const txDate = t.date;
      return t.type !== 'receive' &&
             txDate.getMonth() === currentMonth &&
             txDate.getFullYear() === currentYear;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate daily burn rate
  const dailyBurnRate = monthlyExpenses / dayOfMonth;

  // Project end of month balance
  const projectedTotalExpenses = dailyBurnRate * daysInMonth;
  const projectedEndBalance = currentBalance - (projectedTotalExpenses - monthlyExpenses);

  // Calculate velocity ratio (0 = under budget, 1 = on budget, >1 = over budget)
  const expectedSpendToDate = (monthlyBudget / daysInMonth) * dayOfMonth;
  const velocityRatio = monthlyExpenses / expectedSpendToDate;

  let status: 'over' | 'under' | 'on-track' = 'on-track';
  if (velocityRatio > 1.15) {
    status = 'over';
  } else if (velocityRatio < 0.85) {
    status = 'under';
  }

  return {
    dailyBurnRate,
    velocityRatio,
    status,
    projectedEndBalance,
    daysInMonth,
    daysRemaining
  };
}
