'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ModalShell } from '@/components/groups/ModalShell';
import { type ExpenseMember, type ExpenseFormValues, type SerializedExpenseWithSplits } from '@/types/expenses';
import { ExpenseForm } from './ExpenseForm';

type EditExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  expense: SerializedExpenseWithSplits | null;
  members: ExpenseMember[];
  onSuccess: () => void;
};

export function EditExpenseModal({
  isOpen,
  onClose,
  groupId,
  expense,
  members,
  onSuccess,
}: EditExpenseModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const normalizedMembers = useMemo(
    () =>
      members.map((member) => ({
        id: member.userId,
        name: member.name,
        joinedAt: new Date(member.joinedAt),
        leftAt: member.leftAt ? new Date(member.leftAt) : null,
      })),
    [members]
  );

  const defaultValues = useMemo<Partial<ExpenseFormValues> | undefined>(() => {
    if (!expense) {
      return undefined;
    }

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
      notes: expense.notes ?? '',
    };
  }, [expense]);

  const handleSubmit = async (data: ExpenseFormValues) => {
    if (!expense) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? 'Failed to update expense');
        return;
      }

      toast.success('Expense updated');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to update expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="Edit expense"
      panelClassName="max-w-5xl max-h-[90vh] overflow-hidden"
      bodyClassName="max-h-[calc(90vh-6rem)] overflow-y-auto pr-1"
    >
      {expense && defaultValues && (
        <ExpenseForm
          groupId={groupId}
          members={normalizedMembers}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isLoading}
          mode="edit"
        />
      )}
    </ModalShell>
  );
}

