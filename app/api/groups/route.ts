import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
              select: { id: true, name: true, email: true },
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

    return NextResponse.json(groups);
  } catch (error) {
    console.error('[GET /api/groups]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = createGroupSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const { name, description } = result.data;
    const normalizedDescription = description?.trim() ? description.trim() : null;

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name: name.trim(),
          description: normalizedDescription,
          createdBy: session.user.id,
        },
      });

      await tx.groupMembership.create({
        data: {
          groupId: newGroup.id,
          userId: session.user.id,
          joinedAt: new Date(),
        },
      });

      return await tx.group.findUnique({
        where: { id: newGroup.id },
        include: {
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: { expenses: true },
          },
        },
      });
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('[POST /api/groups]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
