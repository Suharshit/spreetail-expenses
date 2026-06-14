'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Receipt,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { AddMemberModal } from './AddMemberModal';
import { GroupForm } from './GroupForm';
import { MembersTable } from './MembersTable';
import { ModalShell } from './ModalShell';
import { RemoveMemberModal } from './RemoveMemberModal';

type Membership = {
  id: string;
  joinedAt: Date;
  leftAt: Date | null;
  user: { id: string; name: string; email: string };
};

type GroupDetailClientProps = {
  group: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    createdBy: string;
    memberships: Membership[];
    _count: { expenses: number; settlements: number };
  };
  canManage: boolean;
};

const QUICK_LINKS = [
  {
    href: (groupId: string) => `/groups/${groupId}/expenses`,
    title: 'Expenses',
    description: 'Review expense entries for this group.',
    icon: Receipt,
  },
  {
    href: (groupId: string) => `/groups/${groupId}/balances`,
    title: 'Balances',
    description: 'See who owes what across the group.',
    icon: Wallet,
  },
  {
    href: (groupId: string) => `/groups/${groupId}/settlements`,
    title: 'Settlements',
    description: 'Track completed repayments and transfers.',
    icon: ArrowRightLeft,
  },
  {
    href: (groupId: string) => `/groups/${groupId}/import`,
    title: 'Import CSV',
    description: 'Bring in expenses from a spreadsheet file.',
    icon: Upload,
  },
];

export function GroupDetailClient({ group, canManage }: GroupDetailClientProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPastExpanded, setIsPastExpanded] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    name: string;
    joinedAt: Date;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const activeMembers = group.memberships.filter((membership) => membership.leftAt === null);
  const pastMembers = group.memberships.filter((membership) => membership.leftAt !== null);

  const handleEdit = async (data: { name: string; description: string }) => {
    setIsEditing(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const payload = await response.json();

      if (!response.ok) {
        setEditError(payload.error ?? 'Failed to update group');
        return;
      }

      toast.success('Group updated');
      setIsEditOpen(false);
      router.refresh();
    } catch {
      setEditError('Failed to update group');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${group.name}"? This only works when the group has no expenses.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? 'Failed to delete group');
        return;
      }

      toast.success('Group deleted');
      router.push('/groups');
      router.refresh();
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{group.name}</h1>
              {group.description && (
                <p className="mt-2 max-w-2xl text-sm text-gray-400">{group.description}</p>
              )}
              <p className="mt-4 text-sm text-gray-500">
                Created {format(new Date(group.createdAt), 'MMMM d, yyyy')}
              </p>
            </div>

            {canManage && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Active Members</h2>
              <p className="mt-1 text-sm text-gray-400">
                {activeMembers.length} active member{activeMembers.length === 1 ? '' : 's'}
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setIsAddOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>

          <MembersTable
            memberships={activeMembers}
            showActions={canManage}
            onRemove={
              canManage
                ? (userId, userName) => {
                    const membership = activeMembers.find((item) => item.user.id === userId);
                    if (!membership) {
                      return;
                    }

                    setRemoveTarget({
                      userId,
                      name: userName,
                      joinedAt: new Date(membership.joinedAt),
                    });
                  }
                : undefined
            }
          />
        </section>

        {pastMembers.length > 0 && (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <button
              type="button"
              onClick={() => setIsPastExpanded((value) => !value)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h2 className="text-xl font-semibold text-white">Past Members</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {pastMembers.length} former member{pastMembers.length === 1 ? '' : 's'}
                </p>
              </div>
              {isPastExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {isPastExpanded && (
              <div className="mt-4">
                <MembersTable memberships={pastMembers} showActions={false} />
              </div>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Quick Links</h2>
            <p className="mt-1 text-sm text-gray-400">
              Jump into the next workflows for this group.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.title}
                  href={link.href(group.id)}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-5 transition hover:border-indigo-500/40 hover:bg-gray-900/80"
                >
                  <Icon className="h-5 w-5 text-indigo-400" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{link.title}</h3>
                  <p className="mt-2 text-sm text-gray-400">{link.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <ModalShell isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit group">
        <div className="space-y-4">
          {editError && (
            <div className="rounded-md border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
              {editError}
            </div>
          )}
          <GroupForm
            defaultValues={{
              name: group.name,
              description: group.description ?? '',
            }}
            submitLabel="Save Changes"
            isLoading={isEditing}
            onCancel={() => setIsEditOpen(false)}
            onSubmit={handleEdit}
          />
        </div>
      </ModalShell>

      {isAddOpen && (
        <AddMemberModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          groupId={group.id}
          existingMemberIds={activeMembers.map((membership) => membership.user.id)}
          onSuccess={() => router.refresh()}
        />
      )}

      {removeTarget && (
        <RemoveMemberModal
          key={removeTarget.userId}
          isOpen={removeTarget !== null}
          onClose={() => setRemoveTarget(null)}
          groupId={group.id}
          member={removeTarget}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
