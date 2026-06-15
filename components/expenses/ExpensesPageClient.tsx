'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  type ExpenseMember,
  type SerializedExpenseWithSplits,
} from '@/types/expenses';
import { AddExpenseModal } from './AddExpenseModal';
import { DeleteExpenseDialog } from './DeleteExpenseDialog';
import { EditExpenseModal } from './EditExpenseModal';
import { ExpenseList } from './ExpenseList';

type ExpensesPageClientProps = {
  groupId: string;
  currentUserId: string;
  members: ExpenseMember[];
  expenses: SerializedExpenseWithSplits[];
  filters: {
    member: string;
    from: string;
    to: string;
    currency: '' | 'INR' | 'USD';
  };
};

export function ExpensesPageClient({
  groupId,
  currentUserId,
  members,
  expenses,
  filters,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SerializedExpenseWithSplits | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    description: string;
    amountInr: number;
  } | null>(null);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.userId,
        name: member.name,
      })),
    [members]
  );

  const updateFilters = (nextFilters: Partial<ExpensesPageClientProps['filters']>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...nextFilters };

    if (merged.from) {
      params.set('from', merged.from);
    }
    if (merged.to) {
      params.set('to', merged.to);
    }
    if (merged.member) {
      params.set('member', merged.member);
    }
    if (merged.currency) {
      params.set('currency', merged.currency);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Expenses</h1>
            <p className="mt-2 text-sm text-gray-400">
              {expenses.length} expense{expenses.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>Add Expense</Button>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="from" className="block text-sm font-medium text-gray-300">
                  From
                </label>
                <input
                  id="from"
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilters({ from: event.target.value })}
                  className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="to" className="block text-sm font-medium text-gray-300">
                  To
                </label>
                <input
                  id="to"
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilters({ to: event.target.value })}
                  className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="member" className="block text-sm font-medium text-gray-300">
                Member
              </label>
              <select
                id="member"
                value={filters.member}
                onChange={(event) => updateFilters({ member: event.target.value })}
                className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All members</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="currency" className="block text-sm font-medium text-gray-300">
                Currency
              </label>
              <select
                id="currency"
                value={filters.currency}
                onChange={(event) =>
                  updateFilters({
                    currency: event.target.value as '' | 'INR' | 'USD',
                  })
                }
                className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All</option>
                <option value="INR">INR only</option>
                <option value="USD">USD only</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  router.replace(pathname)
                }
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <h2 className="text-xl font-semibold text-white">No expenses yet</h2>
            <p className="mt-2 text-sm text-gray-400">Add the first one.</p>
          </div>
        ) : (
          <ExpenseList
            expenses={expenses}
            currentUserId={currentUserId}
            groupMembers={memberOptions}
            onEdit={setEditingExpense}
            onDelete={(expenseId) => {
              const expense = expenses.find((item) => item.id === expenseId);
              if (!expense) {
                return;
              }

              setDeleteTarget({
                id: expense.id,
                description: expense.description,
                amountInr: expense.amountInr,
              });
            }}
          />
        )}
      </div>

      <AddExpenseModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        groupId={groupId}
        members={members}
        onSuccess={() => router.refresh()}
      />

      <EditExpenseModal
        isOpen={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        groupId={groupId}
        expense={editingExpense}
        members={members}
        onSuccess={() => router.refresh()}
      />

      <DeleteExpenseDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        expense={deleteTarget}
        groupId={groupId}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
