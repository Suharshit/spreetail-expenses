import { getServerSession } from 'next-auth';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ExpensesPageClient } from '@/components/expenses/ExpensesPageClient';
import { authOptions } from '@/lib/auth';
import { expenseInclude, serializeExpense, serializeMember } from '@/lib/expenses-server';
import { prisma } from '@/lib/prisma';

type ExpensesPageProps = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{
    member?: string;
    from?: string;
    to?: string;
    currency?: string;
  }>;
};

export default async function ExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { groupId } = await params;
  const filters = await searchParams;

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
    },
  });

  if (!group) {
    notFound();
  }

  const isMember = group.memberships.some((membership) => membership.userId === session.user.id);
  if (!isMember) {
    forbidden();
  }

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      isSettlement: false,
      ...(filters.member
        ? {
            splits: {
              some: {
                userId: filters.member,
              },
            },
          }
        : {}),
      ...(filters.from || filters.to
        ? {
            expenseDate: {
              ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(filters.currency === 'INR' || filters.currency === 'USD'
        ? { currency: filters.currency }
        : {}),
    },
    include: expenseInclude,
    orderBy: { expenseDate: 'desc' },
  });

  return (
    <ExpensesPageClient
      groupId={group.id}
      currentUserId={session.user.id}
      members={group.memberships.map(serializeMember)}
      expenses={expenses.map(serializeExpense)}
      filters={{
        member: filters.member ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
        currency: filters.currency === 'INR' || filters.currency === 'USD' ? filters.currency : '',
      }}
    />
  );
}
