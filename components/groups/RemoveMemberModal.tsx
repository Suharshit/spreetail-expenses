'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { ModalShell } from './ModalShell';

type RemoveMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  member: { userId: string; name: string; joinedAt: Date } | null;
  onSuccess: () => void;
};

export function RemoveMemberModal({
  isOpen,
  onClose,
  groupId,
  member,
  onSuccess,
}: RemoveMemberModalProps) {
  const [leftAt, setLeftAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!member) {
      return;
    }

    const joinedAtDate = new Date(member.joinedAt);
    const leftAtDate = new Date(leftAt);

    if (leftAtDate < joinedAtDate) {
      setError('Left date cannot be before joined date');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: member.userId,
          leftAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Failed to remove member');
        return;
      }

      toast.success('Member removed');
      onSuccess();
      onClose();
    } catch {
      setError('Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={member ? `Remove ${member.name} from group?` : 'Remove member'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-400">
          This will not delete their past expenses. {member?.name ?? 'This member'} will be
          excluded from new expenses after the left date.
        </p>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="leftAt" className="block text-sm font-medium text-gray-300">
            Left Date
          </label>
          <input
            id="leftAt"
            type="date"
            value={leftAt}
            onChange={(event) => setLeftAt(event.target.value)}
            disabled={isLoading}
            className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isLoading}>
            Remove Member
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
