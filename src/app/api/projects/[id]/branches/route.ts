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
    const { name, parentBranchId } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Branch name is required.' },
        { status: 400 }
      );
    }

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

    // Check if branch name already exists for this project
    const existingBranch = await prisma.branch.findFirst({
      where: {
        projectId,
        name: name.trim(),
      },
    });

    if (existingBranch) {
      return NextResponse.json(
        { error: 'A branch with this name already exists.' },
        { status: 400 }
      );
    }

    // Verify parent branch exists and belongs to the project (if specified)
    if (parentBranchId) {
      const parentBranch = await prisma.branch.findFirst({
        where: {
          id: parentBranchId,
          projectId,
        },
      });

      if (!parentBranch) {
        return NextResponse.json(
          { error: 'Specified parent branch does not exist.' },
          { status: 400 }
        );
      }
    }

    const branch = await prisma.$transaction(async (tx) => {
      const br = await tx.branch.create({
        data: {
          name: name.trim(),
          projectId,
          parentBranchId: parentBranchId || null,
        },
      });

      // Log branch creation activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'created branch',
          entityType: 'branch',
          entityName: br.name,
        },
      });

      return br;
    });

    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch.' },
      { status: 500 }
    );
  }
}
