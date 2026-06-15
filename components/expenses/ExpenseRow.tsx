'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { type SerializedExpenseWithSplits } from '@/types/expenses';

type ExpenseRowProps = {
  expense: SerializedExpenseWithSplits;
  currentUserId: string;
  onEdit: () => void;
  onDelete: () => void;
};

const splitTypeBadgeClasses: Record<string, string> = {
  equal: 'bg-blue-900 text-blue-300',
  unequal: 'bg-purple-900 text-purple-300',
  percentage: 'bg-yellow-900 text-yellow-300',
  share: 'bg-green-900 text-green-300',
};

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ExpenseRow({ expense, currentUserId, onEdit, onDelete }: ExpenseRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentUserSplit = expense.splits.find((split) => split.userId === currentUserId);
  const isPayer = expense.paidByUserId === currentUserId;

  const shareLabel = useMemo(() => {
    if (isPayer) {
      return {
        text: `You paid ${formatInr(expense.amountInr)}`,
        className: 'bg-green-950 text-green-400',
      };
    }

    if (currentUserSplit) {
      return {
        text: `You owe ${formatInr(currentUserSplit.amountOwed)}`,
        className: 'bg-orange-950 text-orange-400',
      };
    }

    return {
      text: 'Not involved',
      className: 'bg-gray-800 text-gray-500',
    };
  }, [currentUserSplit, expense.amountInr, isPayer]);

  return (
    <div
      onClick={() => setIsExpanded((value) => !value)}
      className={`rounded-lg border bg-gray-900 p-4 transition ${
        isExpanded ? 'border-indigo-700' : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="w-full cursor-pointer text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white">{expense.description}</p>
            <p className="mt-1 text-sm text-gray-400">
              {format(new Date(expense.expenseDate), 'MMM d, yyyy')}
            </p>
            {expense.notes && (
              <p className="mt-2 truncate text-sm italic text-gray-500">{expense.notes}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:items-center">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white">
                {expense.paidBy?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <span>Paid by {expense.paidBy?.name ?? 'Unknown'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${splitTypeBadgeClasses[expense.splitType] ?? 'bg-gray-800 text-gray-300'}`}
              >
                {expense.splitType}
              </span>
              {expense.currency === 'USD' && (
                <span className="rounded-full bg-yellow-900 px-2.5 py-1 text-xs font-medium text-yellow-300">
                  USD
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="text-right">
              <p className="text-lg font-semibold text-white">{formatInr(expense.amountInr)}</p>
              {expense.currency === 'USD' && (
                <p className="text-sm text-gray-500">({formatUsd(expense.amount)})</p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${shareLabel.className}`}>
              {shareLabel.text}
            </span>
            <div className="flex gap-2 self-end">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="rounded-md border border-gray-700 p-2 text-gray-300 transition hover:bg-gray-800 hover:text-white"
                aria-label="Edit expense"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="rounded-md border border-red-900/60 p-2 text-red-300 transition hover:bg-red-950"
                aria-label="Delete expense"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <p className="text-sm font-medium text-gray-300">Who splits this expense:</p>
          <div className="mt-3 space-y-2">
            {expense.splits.map((split) => (
              <div key={split.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <span>{split.user.name}</span>
                  {split.userId === currentUserId && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                </div>
                <div className="text-right text-gray-200">
                  {expense.splitType === 'percentage' && split.percentage !== null ? (
                    <span>
                      {split.percentage}% → {formatInr(split.amountOwed)}
                    </span>
                  ) : expense.splitType === 'share' && split.splitRatio !== null ? (
                    <span>
                      {split.splitRatio} {split.splitRatio === 1 ? 'share' : 'shares'} →{' '}
                      {formatInr(split.amountOwed)}
                    </span>
                  ) : (
                    <span>{formatInr(split.amountOwed)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-sm font-semibold text-white">
            <span>Total</span>
            <span>{formatInr(expense.amountInr)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
