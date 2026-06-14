'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { ModalShell } from './ModalShell';

type AddMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  existingMemberIds: string[];
  onSuccess: () => void;
};

type AvailableUser = {
  id: string;
  name: string;
  email: string;
};

export function AddMemberModal({
  isOpen,
  onClose,
  groupId,
  existingMemberIds,
  onSuccess,
}: AddMemberModalProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [joinedAt, setJoinedAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadUsers = async () => {
      setIsFetching(true);
      setError(null);

      try {
        const response = await fetch('/api/users');
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? 'Failed to load users');
          return;
        }

        const availableUsers = (data as AvailableUser[]).filter(
          (user) => !existingMemberIds.includes(user.id)
        );

        setUsers(availableUsers);
        setSelectedUserId(availableUsers[0]?.id ?? '');
      } catch {
        setError('Failed to load users');
      } finally {
        setIsFetching(false);
      }
    };

    void loadUsers();
  }, [existingMemberIds, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          joinedAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Failed to add member');
        return;
      }

      toast.success('Member added');
      onSuccess();
      onClose();
    } catch {
      setError('Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Add member">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="member" className="block text-sm font-medium text-gray-300">
            User
          </label>
          <select
            id="member"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            disabled={isLoading || isFetching || users.length === 0}
            className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          >
            {users.length === 0 && <option value="">No available users</option>}
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="joinedAt" className="block text-sm font-medium text-gray-300">
            Joined Date
          </label>
          <input
            id="joinedAt"
            type="date"
            value={joinedAt}
            onChange={(event) => setJoinedAt(event.target.value)}
            disabled={isLoading}
            className="h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-white outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        {!isFetching && users.length === 0 && !error && (
          <p className="text-sm text-gray-400">
            Everyone is already an active member of this group.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isFetching || users.length === 0}
          >
            Add Member
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
