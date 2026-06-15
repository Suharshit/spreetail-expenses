import 'server-only';

import { Prisma } from '@prisma/client';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  calculateUnequalSplit,
  roundToTwo,
} from '@/lib/splitCalculator';
import {
  ExpenseFormValues,
  ExpenseMember,
  SerializedExpenseWithSplits,
  USD_TO_INR_RATE,
} from '@/types/expenses';

export const expenseInclude = {
  paidBy: {
    select: { id: true, name: true, email: true },
  },
  splits: {
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  },
} satisfies Prisma.ExpenseInclude;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

type MembershipWithUser = Prisma.GroupMembershipGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  return parseFloat(value.toString());
}

export function serializeExpense(expense: ExpenseWithRelations): SerializedExpenseWithSplits {
  return {
    ...expense,
    amount: decimalToNumber(expense.amount) ?? 0,
    amountInr: decimalToNumber(expense.amountInr) ?? 0,
    exchangeRate: decimalToNumber(expense.exchangeRate) ?? 0,
    expenseDate: expense.expenseDate.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    splits: expense.splits.map((split) => ({
      ...split,
      amountOwed: decimalToNumber(split.amountOwed) ?? 0,
      percentage: decimalToNumber(split.percentage),
      splitRatio: decimalToNumber(split.splitRatio),
    })),
  };
}

export function serializeMember(membership: MembershipWithUser): ExpenseMember {
  return {
    id: membership.id,
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    joinedAt: membership.joinedAt.toISOString(),
    leftAt: membership.leftAt ? membership.leftAt.toISOString() : null,
  };
}

export function isMembershipActiveOnDate(
  membership: { joinedAt: Date; leftAt: Date | null },
  expenseDate: Date
) {
  return membership.joinedAt <= expenseDate && (!membership.leftAt || membership.leftAt >= expenseDate);
}

export function calculateAmountInr(amount: number, currency: 'INR' | 'USD') {
  if (currency === 'USD') {
    return {
      amountInr: roundToTwo(amount * USD_TO_INR_RATE),
      exchangeRate: USD_TO_INR_RATE,
    };
  }

  return {
    amountInr: roundToTwo(amount),
    exchangeRate: 1,
  };
}

type SplitRow = {
  userId: string;
  amountOwed: number;
  percentage: number | null;
  splitRatio: number | null;
};

export function buildAuthoritativeSplits(input: ExpenseFormValues, amountInr: number): SplitRow[] {
  if (input.splitType === 'equal') {
    const result = calculateEqualSplit(amountInr, input.splitWith);
    return input.splitWith.map((userId) => ({
      userId,
      amountOwed: result[userId],
      percentage: null,
      splitRatio: null,
    }));
  }

  const detailsByUser = new Map(input.splitDetails.map((detail) => [detail.userId, detail]));

  if (input.splitType === 'unequal') {
    const unequalInput = input.splitWith.map((userId) => {
      const detail = detailsByUser.get(userId);
      if (!detail || detail.amountOwed === undefined) {
        throw new Error('Each selected member needs an amount');
      }

      return {
        userId,
        amountOwed: roundToTwo(detail.amountOwed),
      };
    });

    const { result, isValid } = calculateUnequalSplit(amountInr, unequalInput);
    if (!isValid) {
      throw new Error('Unequal split amounts must sum to the total');
    }

    return input.splitWith.map((userId) => ({
      userId,
      amountOwed: result[userId],
      percentage: null,
      splitRatio: null,
    }));
  }

  if (input.splitType === 'percentage') {
    const percentageInput = input.splitWith.map((userId) => {
      const detail = detailsByUser.get(userId);
      if (!detail || detail.percentage === undefined) {
        throw new Error('Each selected member needs a percentage');
      }

      return {
        userId,
        percentage: roundToTwo(detail.percentage),
      };
    });

    const { result, isValid } = calculatePercentageSplit(amountInr, percentageInput);
    if (!isValid) {
      throw new Error('Percentages must sum to 100');
    }

    return input.splitWith.map((userId) => ({
      userId,
      amountOwed: result[userId],
      percentage: percentageInput.find((item) => item.userId === userId)?.percentage ?? null,
      splitRatio: null,
    }));
  }

  const shareInput = input.splitWith.map((userId) => {
    const detail = detailsByUser.get(userId);
    if (!detail || detail.splitRatio === undefined) {
      throw new Error('Each selected member needs a share ratio');
    }

    return {
      userId,
      ratio: detail.splitRatio,
    };
  });

  const result = calculateShareSplit(amountInr, shareInput);

  return input.splitWith.map((userId) => ({
    userId,
    amountOwed: result[userId],
    percentage: null,
    splitRatio: shareInput.find((item) => item.userId === userId)?.ratio ?? null,
  }));
}

export function assertNonZeroSplits(splits: Array<{ userId: string; amountOwed: number }>) {
  const zeroSplit = splits.find((split) => split.amountOwed <= 0);

  if (zeroSplit) {
    throw new Error('A split cannot be zero');
  }
}

export function normalizeExistingExpense(expense: SerializedExpenseWithSplits): ExpenseFormValues {
  return {
    description: expense.description,
    expenseDate: expense.expenseDate.slice(0, 10),
    paidByUserId: expense.paidByUserId ?? '',
    amount: expense.amount,
    currency: expense.currency as 'INR' | 'USD',
    splitType: expense.splitType as ExpenseFormValues['splitType'],
    splitWith: expense.splits.map((split) => split.userId),
    splitDetails: expense.splits.map((split) => ({
      userId: split.userId,
      amountOwed: split.amountOwed,
      percentage: split.percentage ?? undefined,
      splitRatio: split.splitRatio ?? undefined,
    })),
    notes: expense.notes ?? undefined,
  };
}

