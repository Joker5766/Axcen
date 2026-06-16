import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, branchId } = await params;

    // Check project membership of current user
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the branch to delete
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        projectId,
      },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found.' }, { status: 404 });
    }

    // Check if default branch
    const githubRepo = await prisma.gitHubRepository.findUnique({
      where: { projectId },
    });

    const defaultBranchName = githubRepo?.defaultBranch || 'main';
    if (branch.name === defaultBranchName) {
      return NextResponse.json(
        { error: `Cannot delete the default branch '${defaultBranchName}'.` },
        { status: 400 }
      );
    }

    // Perform delete
    await prisma.$transaction(async (tx) => {
      await tx.branch.delete({
        where: { id: branchId },
      });

      // Log activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'deleted branch',
          entityType: 'branch',
          entityName: branch.name,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json(
      { error: 'Failed to delete branch.' },
      { status: 500 }
    );
  }
}
