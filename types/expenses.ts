import { Expense, ExpenseSplit, User } from '@prisma/client';
import { z } from 'zod';

export type ExpenseSplitWithUser = ExpenseSplit & {
  user: Pick<User, 'id' | 'name'>;
};

export type ExpenseWithSplits = Expense & {
  paidBy: Pick<User, 'id' | 'name' | 'email'> | null;
  splits: ExpenseSplitWithUser[];
};

export type SplitType = 'equal' | 'unequal' | 'percentage' | 'share';

export type ExpenseFormValues = {
  description: string;
  expenseDate: string;
  paidByUserId: string;
  amount: number;
  currency: 'INR' | 'USD';
  splitType: SplitType;
  splitWith: string[];
  splitDetails: Array<{
    userId: string;
    amountOwed?: number;
    percentage?: number;
    splitRatio?: number;
  }>;
  notes?: string;
};

export type SerializedExpenseSplitWithUser = Omit<
  ExpenseSplitWithUser,
  'amountOwed' | 'splitRatio' | 'percentage'
> & {
  amountOwed: number;
  splitRatio: number | null;
  percentage: number | null;
};

export type SerializedExpenseWithSplits = Omit<
  ExpenseWithSplits,
  'amount' | 'amountInr' | 'exchangeRate' | 'expenseDate' | 'createdAt' | 'splits'
> & {
  amount: number;
  amountInr: number;
  exchangeRate: number;
  expenseDate: string;
  createdAt: string;
  splits: SerializedExpenseSplitWithUser[];
};

export type ExpenseMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  leftAt: string | null;
};

export const USD_TO_INR_RATE = 83.5;

export const createExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200),
  expenseDate: z.string().min(1, 'Date is required'),
  paidByUserId: z.string().min(1, 'Paid by is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['INR', 'USD']),
  splitType: z.enum(['equal', 'unequal', 'percentage', 'share']),
  splitWith: z.array(z.string()).min(1, 'At least one member must be selected'),
  splitDetails: z.array(
    z.object({
      userId: z.string(),
      amountOwed: z.number().optional(),
      percentage: z.number().min(0).max(100).optional(),
      splitRatio: z.number().positive().optional(),
    })
  ),
  notes: z.string().max(500).optional(),
});

