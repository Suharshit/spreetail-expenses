import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addMemberSchema = z.object({
  userId: z.string().min(1),
  joinedAt: z.string().min(1, 'Joined date is required'),
});

const removeMemberSchema = z.object({
  userId: z.string().min(1),
  leftAt: z.string().min(1, 'Left date is required'),
});

type MembersRouteContext = {
  params: Promise<{ groupId: string }>;
};

function parseDateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function getGroupAccess(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      createdBy: true,
      memberships: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!group) {
    return { group: null, isMember: false, isCreator: false };
  }

  return {
    group,
    isMember: group.memberships.length > 0,
    isCreator: group.createdBy === userId,
  };
}

export async function GET(req: Request, { params }: MembersRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const access = await getGroupAccess(groupId, session.user.id);
    if (!access.group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (!access.isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const activeMembers = memberships.filter((m) => m.leftAt === null);
    const pastMembers = memberships.filter((m) => m.leftAt !== null);

    return NextResponse.json({ activeMembers, pastMembers });
  } catch (error) {
    console.error('[GET /api/groups/[groupId]/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: MembersRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const access = await getGroupAccess(groupId, session.user.id);
    if (!access.group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (!access.isMember || !access.isCreator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const result = addMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const { userId, joinedAt } = result.data;
    const joinedAtDate = parseDateValue(joinedAt);

    if (!joinedAtDate) {
      return NextResponse.json({ error: 'Invalid joined date' }, { status: 400 });
    }

    const userToAdd = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToAdd) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (existingMembership) {
      if (existingMembership.leftAt === null) {
        return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
      }

      // Rejoin scenario
      const updatedMembership = await prisma.groupMembership.update({
        where: {
          groupId_userId: { groupId, userId },
        },
        data: {
          leftAt: null,
          joinedAt: joinedAtDate,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json(updatedMembership, { status: 201 });
    }

    const newMembership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId,
        joinedAt: joinedAtDate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(newMembership, { status: 201 });
  } catch (error) {
    console.error('[POST /api/groups/[groupId]/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: MembersRouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const access = await getGroupAccess(groupId, session.user.id);
    if (!access.group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (!access.isMember || !access.isCreator) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const result = removeMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const { userId, leftAt } = result.data;
    const leftAtDate = parseDateValue(leftAt);

    if (!leftAtDate) {
      return NextResponse.json({ error: 'Invalid left date' }, { status: 400 });
    }

    const activeMembership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId,
        leftAt: null,
      },
    });

    if (!activeMembership) {
      return NextResponse.json({ error: 'Active membership not found' }, { status: 404 });
    }

    if (leftAtDate < new Date(activeMembership.joinedAt)) {
      return NextResponse.json(
        { error: 'Left date cannot be before joined date' },
        { status: 400 }
      );
    }

    const updatedMembership = await prisma.groupMembership.update({
      where: {
        groupId_userId: { groupId, userId },
      },
      data: {
        leftAt: leftAtDate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updatedMembership, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/groups/[groupId]/members]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
