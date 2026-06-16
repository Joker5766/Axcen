import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invitationId } = await params;

    // Verify invitation exists and belongs to this user
    const invitation = await prisma.projectMember.findFirst({
      where: {
        id: invitationId,
        userId: user.id,
        status: 'PENDING',
      },
      include: {
        project: true,
      }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    // Accept the invitation
    const updatedMember = await prisma.$transaction(async (tx) => {
      const mb = await tx.projectMember.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      });

      // Log activity
      await tx.activity.create({
        data: {
          projectId: invitation.projectId,
          userId: user.id,
          action: 'joined',
          entityType: 'member',
          entityName: user.name,
        },
      });

      return mb;
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invitationId } = await params;

    // Verify invitation exists and belongs to this user
    const invitation = await prisma.projectMember.findFirst({
      where: {
        id: invitationId,
        userId: user.id,
        status: 'PENDING',
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    // Decline / delete invitation membership
    await prisma.projectMember.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decline invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to decline invitation.' },
      { status: 500 }
    );
  }
}
