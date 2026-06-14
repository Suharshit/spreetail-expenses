'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { GroupCard } from './GroupCard';
import { GroupForm } from './GroupForm';
import { ModalShell } from './ModalShell';

type GroupsPageClientProps = {
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    memberships: Array<{
      user: { id: string; name: string };
      leftAt: Date | null;
    }>;
    _count: { expenses: number };
  }>;
};

export function GroupsPageClient({ groups }: GroupsPageClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = async (data: { name: string; description: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'Failed to create group');
        return;
      }

      toast.success('Group created');
      setIsCreateOpen(false);
      router.refresh();
    } catch {
      setError('Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Groups</h1>
            <p className="mt-2 text-sm text-gray-400">
              Track shared expenses with the people in each group.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>New Group</Button>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <h2 className="text-xl font-semibold text-white">No groups yet</h2>
            <p className="mt-2 text-sm text-gray-400">
              Create your first group to start splitting expenses.
            </p>
            <div className="mt-6">
              <Button onClick={() => setIsCreateOpen(true)}>Create your first group</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>

      <ModalShell
        isOpen={isCreateOpen}
        onClose={() => {
          if (!isLoading) {
            setIsCreateOpen(false);
            setError(null);
          }
        }}
        title="Create a new group"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <GroupForm
            submitLabel="Create Group"
            isLoading={isLoading}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={createGroup}
          />
        </div>
      </ModalShell>
    </>
  );
}
