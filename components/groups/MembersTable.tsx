'use client';

import { format } from 'date-fns';
import { getAvatarColor } from './GroupCard';
import { Button } from '@/components/ui/Button';

type MembersTableProps = {
  memberships: Array<{
    id: string;
    joinedAt: Date | string;
    leftAt: Date | string | null;
    user: { id: string; name: string; email: string };
  }>;
  showActions: boolean;
  onRemove?: (userId: string, userName: string) => void;
};

export function MembersTable({
  memberships,
  showActions,
  onRemove,
}: MembersTableProps) {
  if (memberships.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        No members to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-300">
        <thead className="bg-gray-800 text-xs uppercase tracking-wider text-gray-400">
          <tr>
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Joined</th>
            {!showActions && <th className="px-4 py-3">Left</th>}
            {showActions && <th className="px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {memberships.map((m, index) => {
            const initial = m.user.name.charAt(0).toUpperCase();
            const bgColor = getAvatarColor(m.user.name);

            return (
              <tr
                key={m.id}
                className={`${index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'} hover:bg-gray-800/50`}
              >
                <td className="flex items-center space-x-3 px-4 py-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${bgColor}`}
                  >
                    {initial}
                  </div>
                  <div>
                    <div className="font-bold text-white">{m.user.name}</div>
                    <div className="text-xs text-gray-500">{m.user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(new Date(m.joinedAt), 'MMM d, yyyy')}
                </td>
                {!showActions && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.leftAt ? format(new Date(m.leftAt), 'MMM d, yyyy') : '-'}
                  </td>
                )}
                {showActions && (
                  <td className="px-4 py-3">
                    {onRemove && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!text-red-500 hover:!bg-red-500/10 hover:!border-red-500/30"
                        onClick={() => onRemove(m.user.id, m.user.name)}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
