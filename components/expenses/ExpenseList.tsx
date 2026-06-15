'use client';

import { format } from 'date-fns';
import { type SerializedExpenseWithSplits } from '@/types/expenses';
import { ExpenseRow } from './ExpenseRow';

type ExpenseListProps = {
  expenses: SerializedExpenseWithSplits[];
  currentUserId: string;
  groupMembers: { id: string; name: string }[];
  onEdit: (expense: SerializedExpenseWithSplits) => void;
  onDelete: (expenseId: string) => void;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExpenseList({
  expenses,
  currentUserId,
  groupMembers,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  const monthGroups = expenses.reduce<
    Array<{
      key: string;
      label: string;
      subtotal: number;
      expenses: SerializedExpenseWithSplits[];
    }>
  >((groups, expense) => {
    const key = format(new Date(expense.expenseDate), 'yyyy-MM');
    const label = format(new Date(expense.expenseDate), 'MMMM yyyy');
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.expenses.push(expense);
      existingGroup.subtotal += expense.amountInr;
      return groups;
    }

    groups.push({
      key,
      label,
      subtotal: expense.amountInr,
      expenses: [expense],
    });

    return groups;
  }, []);

  if (groupMembers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {monthGroups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {group.label}
            </h2>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <div className="space-y-3">
            {group.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                currentUserId={currentUserId}
                onEdit={() => onEdit(expense)}
                onDelete={() => onDelete(expense.id)}
              />
            ))}
          </div>

          <div className="flex justify-end text-sm font-medium text-gray-300">
            {group.label.split(' ')[0]} total: {formatInr(group.subtotal)}
          </div>
        </section>
      ))}
    </div>
  );
}

