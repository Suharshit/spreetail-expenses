'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ModalShell } from '@/components/groups/ModalShell';
import { Button } from '@/components/ui/Button';

type DeleteExpenseDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: { id: string; description: string; amountInr: number } | null;
  groupId: string;
  onSuccess: () => void;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function DeleteExpenseDialog({
  isOpen,
  onClose,
  expense,
  groupId,
  onSuccess,
}: DeleteExpenseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!expense) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/expenses/${expense.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? 'Failed to delete expense');
        return;
      }

      toast.success('Expense deleted');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={() => !isLoading && onClose()} title="Delete this expense?">
      {expense && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-red-950 bg-red-950/30 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
            <p className="text-sm text-gray-200">
              Deleting {expense.description} ({formatInr(expense.amountInr)}) will recalculate all
              balances in the group.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} isLoading={isLoading}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

