import { getServerSession } from 'next-auth';
import { forbidden, notFound, redirect } from 'next/navigation';
import { GroupDetailClient } from '@/components/groups/GroupDetailClient';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type GroupDetailPageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { groupId } = await params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      _count: {
        select: { expenses: true, settlements: true },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const isMember = group.memberships.some((membership) => membership.user.id === session.user.id);

  if (!isMember) {
    forbidden();
  }

  return (
    <GroupDetailClient group={group} canManage={group.createdBy === session.user.id} />
  );
}
