import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      );
    }

    // Check project membership of current user (only members can invite)
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the user to invite
    const invitee = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!invitee) {
      return NextResponse.json(
        { error: 'No user found with this email. Ask them to register first.' },
        { status: 404 }
      );
    }

    // Check if invitee is already a member
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: invitee.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this project.' },
        { status: 400 }
      );
    }

    // Add user as a member
    const newMember = await prisma.$transaction(async (tx) => {
      const mb = await tx.projectMember.create({
        data: {
          projectId,
          userId: invitee.id,
          role: 'MEMBER',
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Log invite activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'invited',
          entityType: 'member',
          entityName: invitee.name,
        },
      });

      return mb;
    });

    return NextResponse.json({ member: newMember });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json(
      { error: 'Failed to invite member.' },
      { status: 500 }
    );
  }
}
