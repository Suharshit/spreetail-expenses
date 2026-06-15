'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ModalShell } from '@/components/groups/ModalShell';
import { ExpenseForm } from './ExpenseForm';
import { type ExpenseFormValues, type ExpenseMember } from '@/types/expenses';

type AddExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: ExpenseMember[];
  onSuccess: () => void;
};

export function AddExpenseModal({
  isOpen,
  onClose,
  groupId,
  members,
  onSuccess,
}: AddExpenseModalProps) {
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

  const handleSubmit = async (data: ExpenseFormValues) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? 'Failed to add expense');
        return;
      }

      toast.success('Expense added');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="Add expense"
      panelClassName="max-w-5xl max-h-[90vh] overflow-hidden"
      bodyClassName="max-h-[calc(90vh-6rem)] overflow-y-auto pr-1"
    >
      <ExpenseForm
        groupId={groupId}
        members={normalizedMembers}
        onSubmit={handleSubmit}
        onCancel={onClose}
        isLoading={isLoading}
        mode="create"
      />
    </ModalShell>
  );
}

