import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, nodeId } = await params;
    const {
      title,
      status,
      branchId,
      summary,
      notes,
      nextSteps,
      relatedCommits,
      completedWork,
      pendingWork,
      parentNodes,
    } = await request.json();

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

    // Find existing node
    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!existingNode) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    const updatedNode = await prisma.$transaction(async (tx) => {
      let commitsToSet: { id: string }[] | undefined = undefined;
      if (relatedCommits !== undefined && Array.isArray(relatedCommits)) {
        const githubRepository = await tx.gitHubRepository.findUnique({
          where: { projectId },
        });
        if (githubRepository) {
          const dbCommits = await tx.gitHubCommit.findMany({
            where: {
              repoId: githubRepository.id,
              sha: { in: relatedCommits },
            },
            select: { id: true },
          });
          commitsToSet = dbCommits.map((c) => ({ id: c.id }));
        } else {
          commitsToSet = [];
        }
      }

      // 1. Update node fields with serialization
      const nd = await tx.node.update({
        where: { id: nodeId },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          status: status !== undefined ? status : undefined,
          branchId: branchId !== undefined ? branchId : undefined,
          summary: summary !== undefined ? summary.trim() : undefined,
          notes: notes !== undefined ? notes.trim() : undefined,
          nextSteps: nextSteps !== undefined ? nextSteps.trim() : undefined,
          relatedCommits: relatedCommits !== undefined ? JSON.stringify(relatedCommits) : undefined,
          completedWork: completedWork !== undefined ? JSON.stringify(completedWork) : undefined,
          pendingWork: pendingWork !== undefined ? JSON.stringify(pendingWork) : undefined,
          isAiGenerated: false,
          githubCommits: commitsToSet !== undefined ? {
            set: commitsToSet,
          } : undefined,
        },
      });

      // 2. Update parent relationships if provided
      if (parentNodes !== undefined && Array.isArray(parentNodes)) {
        // Delete existing relationships where this node is the 'toNode'
        await tx.nodeRelationship.deleteMany({
          where: { toNodeId: nodeId },
        });

        // Add new relationships
        const validParents = parentNodes.filter((id) => id && id !== nodeId);
        await Promise.all(
          validParents.map((parentId) =>
            tx.nodeRelationship.create({
              data: {
                fromNodeId: parentId,
                toNodeId: nodeId,
              },
            })
          )
        );
      }

      // 3. Log activity
      let actionText = 'updated node';
      if (status !== undefined && status !== existingNode.status) {
        if (status === 'COMPLETED') {
          actionText = 'completed node';
        } else if (status === 'IN_PROGRESS') {
          actionText = 'started node';
        }
      }

      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: actionText,
          entityType: 'node',
          entityName: nd.title,
        },
      });

      return nd;
    });

    const fullNode = await prisma.node.findUnique({
      where: { id: updatedNode.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        githubCommits: true,
      },
    });

    if (!fullNode) {
      return NextResponse.json({ error: 'Failed to retrieve updated node.' }, { status: 500 });
    }

    // Parse list columns from serialized JSON strings
    const parsedNode = {
      ...fullNode,
      relatedCommits: JSON.parse(fullNode.relatedCommits || '[]'),
      completedWork: JSON.parse(fullNode.completedWork || '[]'),
      pendingWork: JSON.parse(fullNode.pendingWork || '[]'),
    };

    return NextResponse.json({ node: parsedNode });
  } catch (error) {
    console.error('Update node error:', error);
    return NextResponse.json(
      { error: 'Failed to update node.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, nodeId } = await params;

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

    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!existingNode) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete node (relationships will cascade delete automatically)
      await tx.node.delete({
        where: { id: nodeId },
      });

      // 2. Log activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'deleted node',
          entityType: 'node',
          entityName: existingNode.title,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete node error:', error);
    return NextResponse.json(
      { error: 'Failed to delete node.' },
      { status: 500 }
    );
  }
}
