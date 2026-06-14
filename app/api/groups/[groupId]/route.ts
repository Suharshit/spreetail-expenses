import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100).optional(),
  description: z.string().max(500).optional(),
});

type GroupRouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function GET(req: Request, { params }: GroupRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const isMember = group.memberships.some((m) => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('[GET /api/groups/[groupId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: GroupRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const result = updateGroupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    if (Object.keys(result.data).length === 0) {
      return NextResponse.json({ error: 'No fields provided for update' }, { status: 400 });
    }

    const data = {
      ...(result.data.name !== undefined ? { name: result.data.name.trim() } : {}),
      ...(result.data.description !== undefined
        ? {
            description: result.data.description.trim()
              ? result.data.description.trim()
              : null,
          }
        : {}),
    };

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data,
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

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('[PATCH /api/groups/[groupId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: GroupRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (group._count.expenses > 0) {
      return NextResponse.json(
        { error: 'Cannot delete group with existing expenses. Remove all expenses first.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMembership.deleteMany({
        where: { groupId },
      });
      await tx.group.delete({
        where: { id: groupId },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE /api/groups/[groupId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
