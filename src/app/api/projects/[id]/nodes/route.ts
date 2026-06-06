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

    if (!title || !title.trim() || !status || !branchId || !summary) {
      return NextResponse.json(
        { error: 'Title, status, branch, and summary are required fields.' },
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

    // Verify branch belongs to project
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        projectId,
      },
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Specified branch does not exist for this project.' },
        { status: 400 }
      );
    }

    const node = await prisma.$transaction(async (tx) => {
      // 1. Create the node with serialized list data
      const nd = await tx.node.create({
        data: {
          title: title.trim(),
          status,
          branchId,
          authorId: user.id,
          summary: summary.trim(),
          notes: notes?.trim() || '',
          nextSteps: nextSteps?.trim() || '',
          relatedCommits: JSON.stringify(relatedCommits || []),
          completedWork: JSON.stringify(completedWork || []),
          pendingWork: JSON.stringify(pendingWork || []),
        },
      });

      // 2. Link Node Relationships (if parentNodes provided)
      if (parentNodes && Array.isArray(parentNodes) && parentNodes.length > 0) {
        const validParents = parentNodes.filter((id) => id && id !== nd.id);
        
        await Promise.all(
          validParents.map((parentId) =>
            tx.nodeRelationship.create({
              data: {
                fromNodeId: parentId,
                toNodeId: nd.id,
              },
            })
          )
        );
      }

      // 3. Log activity
      const actionText = status === 'COMPLETED' ? 'completed node' : 'created node';
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

    // Fetch complete node back with author info
    const fullNode = await prisma.node.findUnique({
      where: { id: node.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!fullNode) {
      return NextResponse.json({ error: 'Failed to retrieve created node.' }, { status: 500 });
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
    console.error('Create node error:', error);
    return NextResponse.json(
      { error: 'Failed to create node.' },
      { status: 500 }
    );
  }
}
