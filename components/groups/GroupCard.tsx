import Link from 'next/link';

export const AVATAR_COLORS = [
  'bg-purple-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-yellow-600',
  'bg-red-600',
  'bg-pink-600',
];

export function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

type GroupCardProps = {
  group: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    memberships: Array<{
      user: { id: string; name: string };
      leftAt: Date | null;
    }>;
    _count: { expenses: number };
  };
};

export function GroupCard({ group }: GroupCardProps) {
  const activeMembers = group.memberships.filter((m) => m.leftAt === null);
  const extraMembers = Math.max(activeMembers.length - 4, 0);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-white">{group.name}</h3>
        {group.description && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-400">
            {group.description}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <div className="flex -space-x-2">
            {activeMembers.slice(0, 4).map((m) => {
              const initial = m.user.name.charAt(0).toUpperCase();
              const bgColor = getAvatarColor(m.user.name);
              return (
                <div
                  key={m.user.id}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 text-xs font-medium text-white ${bgColor}`}
                  title={m.user.name}
                >
                  {initial}
                </div>
              );
            })}
            {activeMembers.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-gray-800 text-xs font-medium text-white">
                +{activeMembers.length - 4}
              </div>
            )}
          </div>
          <span className="text-sm text-gray-400">
            {activeMembers.length} member{activeMembers.length === 1 ? '' : 's'}
          </span>
          {extraMembers > 0 && (
            <span className="text-sm text-gray-500">+{extraMembers} more</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {group._count.expenses} expense{group._count.expenses === 1 ? '' : 's'}
          </div>
          <Link
            href={`/groups/${group.id}`}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            View Group &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
