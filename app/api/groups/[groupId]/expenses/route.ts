import { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  assertNonZeroSplits,
  buildAuthoritativeSplits,
  calculateAmountInr,
  expenseInclude,
  serializeExpense,
} from '@/lib/expenses-server';
import { prisma } from '@/lib/prisma';
import { createExpenseSchema } from '@/types/expenses';

type ExpensesRouteContext = {
  params: Promise<{ groupId: string }>;
};

async function getAuthorizedGroup(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      createdBy: true,
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!group) {
    return { error: NextResponse.json({ error: 'Group not found' }, { status: 404 }) };
  }

  const isMember = group.memberships.some((membership) => membership.userId === userId);
  if (!isMember) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { group };
}

export async function GET(request: NextRequest, { params }: ExpensesRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;
    const authorized = await getAuthorizedGroup(groupId, session.user.id);
    if (authorized.error) {
      return authorized.error;
    }

    const searchParams = request.nextUrl.searchParams;
    const excludeSettlements = searchParams.get('excludeSettlements') !== 'false';
    const member = searchParams.get('member');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const currency = searchParams.get('currency');

    const where: Prisma.ExpenseWhereInput = {
      groupId,
      ...(excludeSettlements ? { isSettlement: false } : {}),
      ...(member
        ? {
            splits: {
              some: {
                userId: member,
              },
            },
          }
        : {}),
      ...(from || to
        ? {
            expenseDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(currency === 'INR' || currency === 'USD' ? { currency } : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { expenseDate: 'desc' },
    });

    return NextResponse.json(expenses.map(serializeExpense));
  } catch (error) {
    console.error('[GET /api/groups/[groupId]/expenses]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: ExpensesRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;
    const authorized = await getAuthorizedGroup(groupId, session.user.id);
    if (authorized.error) {
      return authorized.error;
    }

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const input = {
      ...parsed.data,
      description: parsed.data.description.trim(),
      notes: parsed.data.notes?.trim() || undefined,
      splitWith: Array.from(new Set(parsed.data.splitWith)),
    };

    const expenseDate = new Date(`${input.expenseDate}T00:00:00.000Z`);

    const activeMemberships = authorized.group.memberships.filter(
      (membership) =>
        membership.joinedAt <= expenseDate &&
        (!membership.leftAt || membership.leftAt >= expenseDate)
    );

    const activeUserIds = new Set(activeMemberships.map((membership) => membership.userId));
    const invalidUserIds = input.splitWith.filter((userId) => !activeUserIds.has(userId));

    if (invalidUserIds.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected members were not active on the expense date' },
        { status: 400 }
      );
    }

    if (!activeUserIds.has(input.paidByUserId)) {
      return NextResponse.json(
        { error: 'Paid by member was not active on the expense date' },
        { status: 400 }
      );
    }

    const { amountInr, exchangeRate } = calculateAmountInr(input.amount, input.currency);
    const splits = buildAuthoritativeSplits(input, amountInr);
    assertNonZeroSplits(splits);

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          description: input.description,
          paidByUserId: input.paidByUserId,
          amount: input.amount,
          currency: input.currency,
          amountInr,
          exchangeRate,
          splitType: input.splitType,
          expenseDate,
          notes: input.notes ?? null,
          isSettlement: false,
        },
      });

      await tx.expenseSplit.createMany({
        data: splits.map((split) => ({
          expenseId: expense.id,
          userId: split.userId,
          amountOwed: split.amountOwed,
          percentage: split.percentage ?? null,
          splitRatio: split.splitRatio ?? null,
        })),
      });

      const createdExpense = await tx.expense.findUnique({
        where: { id: expense.id },
        include: expenseInclude,
      });

      return createdExpense;
    });

    return NextResponse.json(result ? serializeExpense(result) : null, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('split') || message.includes('Percentage') ? 400 : 500;
    if (status === 500) {
      console.error('[POST /api/groups/[groupId]/expenses]', error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
