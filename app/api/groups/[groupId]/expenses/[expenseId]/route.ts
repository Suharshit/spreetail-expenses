import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  assertNonZeroSplits,
  buildAuthoritativeSplits,
  calculateAmountInr,
  decimalToNumber,
  expenseInclude,
  serializeExpense,
} from '@/lib/expenses-server';
import { prisma } from '@/lib/prisma';
import { createExpenseSchema, type ExpenseFormValues } from '@/types/expenses';

type ExpenseRouteContext = {
  params: Promise<{ groupId: string; expenseId: string }>;
};

const updateExpenseSchema = createExpenseSchema.partial();

export async function GET(_request: Request, { params }: ExpenseRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        memberships: {
          select: { userId: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isMember = group.memberships.some((membership) => membership.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        groupId,
      },
      include: expenseInclude,
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(serializeExpense(expense));
  } catch (error) {
    console.error('[GET /api/groups/[groupId]/expenses/[expenseId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: ExpenseRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        groupId,
      },
      include: expenseInclude,
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
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
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const canEdit = expense.paidByUserId === session.user.id || group.createdBy === session.user.id;
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const existingInput: ExpenseFormValues = {
      description: expense.description,
      expenseDate: expense.expenseDate.toISOString().slice(0, 10),
      paidByUserId: expense.paidByUserId ?? '',
      amount: decimalToNumber(expense.amount) ?? 0,
      currency: expense.currency as 'INR' | 'USD',
      splitType: expense.splitType as ExpenseFormValues['splitType'],
      splitWith: expense.splits.map((split) => split.userId),
      splitDetails: expense.splits.map((split) => ({
        userId: split.userId,
        amountOwed: decimalToNumber(split.amountOwed) ?? undefined,
        percentage: decimalToNumber(split.percentage) ?? undefined,
        splitRatio: decimalToNumber(split.splitRatio) ?? undefined,
      })),
      notes: expense.notes ?? undefined,
    };

    const mergedInput: ExpenseFormValues = {
      ...existingInput,
      ...parsed.data,
      description: (parsed.data.description ?? existingInput.description).trim(),
      notes:
        parsed.data.notes !== undefined
          ? parsed.data.notes.trim() || undefined
          : existingInput.notes,
      splitWith: parsed.data.splitWith
        ? Array.from(new Set(parsed.data.splitWith))
        : existingInput.splitWith,
      splitDetails: parsed.data.splitDetails ?? existingInput.splitDetails,
    };

    const validation = createExpenseSchema.safeParse(mergedInput);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const expenseDate = new Date(`${mergedInput.expenseDate}T00:00:00.000Z`);
    const activeMemberships = group.memberships.filter(
      (membership) =>
        membership.joinedAt <= expenseDate &&
        (!membership.leftAt || membership.leftAt >= expenseDate)
    );
    const activeUserIds = new Set(activeMemberships.map((membership) => membership.userId));

    const invalidUserIds = mergedInput.splitWith.filter((userId) => !activeUserIds.has(userId));
    if (invalidUserIds.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected members were not active on the expense date' },
        { status: 400 }
      );
    }

    if (!activeUserIds.has(mergedInput.paidByUserId)) {
      return NextResponse.json(
        { error: 'Paid by member was not active on the expense date' },
        { status: 400 }
      );
    }

    const shouldRebuildSplits =
      parsed.data.amount !== undefined ||
      parsed.data.currency !== undefined ||
      parsed.data.splitType !== undefined ||
      parsed.data.splitWith !== undefined ||
      parsed.data.splitDetails !== undefined;

    const { amountInr, exchangeRate } = calculateAmountInr(mergedInput.amount, mergedInput.currency);

    const updatedExpense = await prisma.$transaction(async (tx) => {
      if (shouldRebuildSplits) {
        const splits = buildAuthoritativeSplits(mergedInput, amountInr);
        assertNonZeroSplits(splits);

        await tx.expenseSplit.deleteMany({
          where: { expenseId },
        });

        await tx.expense.update({
          where: { id: expenseId },
          data: {
            description: mergedInput.description,
            expenseDate,
            paidByUserId: mergedInput.paidByUserId,
            amount: mergedInput.amount,
            currency: mergedInput.currency,
            amountInr,
            exchangeRate,
            splitType: mergedInput.splitType,
            notes: mergedInput.notes ?? null,
          },
        });

        await tx.expenseSplit.createMany({
          data: splits.map((split) => ({
            expenseId,
            userId: split.userId,
            amountOwed: split.amountOwed,
            percentage: split.percentage ?? null,
            splitRatio: split.splitRatio ?? null,
          })),
        });
      } else {
        await tx.expense.update({
          where: { id: expenseId },
          data: {
            description: mergedInput.description,
            expenseDate,
            paidByUserId: mergedInput.paidByUserId,
            notes: mergedInput.notes ?? null,
          },
        });
      }

      return tx.expense.findUnique({
        where: { id: expenseId },
        include: expenseInclude,
      });
    });

    return NextResponse.json(updatedExpense ? serializeExpense(updatedExpense) : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('split') || message.includes('Percentage') ? 400 : 500;
    if (status === 500) {
      console.error('[PATCH /api/groups/[groupId]/expenses/[expenseId]]', error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: ExpenseRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        groupId,
      },
      select: {
        id: true,
        paidByUserId: true,
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        createdBy: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const canDelete = expense.paidByUserId === session.user.id || group.createdBy === session.user.id;
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({
        where: { expenseId },
      });

      await tx.expense.delete({
        where: { id: expenseId },
      });
    });

    return NextResponse.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('[DELETE /api/groups/[groupId]/expenses/[expenseId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

