import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { GroupsPageClient } from '@/components/groups/GroupsPageClient';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const groups = await prisma.group.findMany({
    where: {
      memberships: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      _count: {
        select: { expenses: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return <GroupsPageClient groups={groups} />;
}
