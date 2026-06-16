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
    const { sourceNodeId, targetNodeId } = await request.json();

    if (!sourceNodeId || !targetNodeId) {
      return NextResponse.json(
        { error: 'Source and Target node IDs are required.' },
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

    const sourceNode = await prisma.node.findUnique({
      where: { id: sourceNodeId },
      include: { githubCommits: true },
    });
    const targetNode = await prisma.node.findUnique({
      where: { id: targetNodeId },
      include: { githubCommits: true },
    });

    if (!sourceNode || !targetNode) {
      return NextResponse.json(
        { error: 'One or both of the nodes do not exist.' },
        { status: 404 }
      );
    }

    // Merge logic
    const mergedCommits = Array.from(
      new Set([
        ...JSON.parse(sourceNode.relatedCommits || '[]'),
        ...JSON.parse(targetNode.relatedCommits || '[]'),
      ])
    ) as string[];

    const mergedCompleted = Array.from(
      new Set([
        ...JSON.parse(sourceNode.completedWork || '[]'),
        ...JSON.parse(targetNode.completedWork || '[]'),
      ])
    ) as string[];

    const mergedPending = Array.from(
      new Set([
        ...JSON.parse(sourceNode.pendingWork || '[]'),
        ...JSON.parse(targetNode.pendingWork || '[]'),
      ])
    ) as string[];

    const mergedNotes = [targetNode.notes, sourceNode.notes].filter(Boolean).join('\n\n');
    const mergedNextSteps = [targetNode.nextSteps, sourceNode.nextSteps].filter(Boolean).join('\n\n');

    // Perform transaction
    const finalNode = await prisma.$transaction(async (tx) => {
      // Connect all commits of source node to target node
      const commitIds = Array.from(
        new Set([
          ...(sourceNode.githubCommits || []).map((c) => c.id),
          ...(targetNode.githubCommits || []).map((c) => c.id),
        ])
      );

      // Update target node
      const nd = await tx.node.update({
        where: { id: targetNodeId },
        data: {
          relatedCommits: JSON.stringify(mergedCommits),
          completedWork: JSON.stringify(mergedCompleted),
          pendingWork: JSON.stringify(mergedPending),
          notes: mergedNotes || null,
          nextSteps: mergedNextSteps || null,
          isAiGenerated: false, // user action marks it as custom
          githubCommits: {
            set: commitIds.map((id) => ({ id })),
          },
        },
      });

      // Redirect Relationships:
      // Find all relationships involving sourceNodeId
      const sourceRelations = await tx.nodeRelationship.findMany({
        where: {
          OR: [{ fromNodeId: sourceNodeId }, { toNodeId: sourceNodeId }],
        },
      });

      for (const rel of sourceRelations) {
        if (rel.fromNodeId === sourceNodeId) {
          // Redirect to targetNodeId -> X (if X !== targetNodeId)
          if (rel.toNodeId !== targetNodeId) {
            const exists = await tx.nodeRelationship.findUnique({
              where: {
                fromNodeId_toNodeId: {
                  fromNodeId: targetNodeId,
                  toNodeId: rel.toNodeId,
                },
              },
            });
            if (!exists) {
              await tx.nodeRelationship.create({
                data: {
                  fromNodeId: targetNodeId,
                  toNodeId: rel.toNodeId,
                },
              });
            }
          }
        } else if (rel.toNodeId === sourceNodeId) {
          // Redirect Y -> targetNodeId (if Y !== targetNodeId)
          if (rel.fromNodeId !== targetNodeId) {
            const exists = await tx.nodeRelationship.findUnique({
              where: {
                fromNodeId_toNodeId: {
                  fromNodeId: rel.fromNodeId,
                  toNodeId: targetNodeId,
                },
              },
            });
            if (!exists) {
              await tx.nodeRelationship.create({
                data: {
                  fromNodeId: rel.fromNodeId,
                  toNodeId: targetNodeId,
                },
              });
            }
          }
        }
      }

      // Delete the old relationships for sourceNodeId
      await tx.nodeRelationship.deleteMany({
        where: {
          OR: [{ fromNodeId: sourceNodeId }, { toNodeId: sourceNodeId }],
        },
      });

      // Delete the source node
      await tx.node.delete({
        where: { id: sourceNodeId },
      });

      // Log activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'merged cluster',
          entityType: 'node',
          entityName: `${sourceNode.title} into ${targetNode.title}`,
        },
      });

      return nd;
    });

    const fullNode = await prisma.node.findUnique({
      where: { id: finalNode.id },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
        githubCommits: true,
      },
    });

    const parsedNode = {
      ...fullNode,
      relatedCommits: JSON.parse(fullNode?.relatedCommits || '[]'),
      completedWork: JSON.parse(fullNode?.completedWork || '[]'),
      pendingWork: JSON.parse(fullNode?.pendingWork || '[]'),
    };

    return NextResponse.json({ node: parsedNode });
  } catch (error) {
    console.error('Merge nodes error:', error);
    return NextResponse.json(
      { error: 'Failed to merge nodes.' },
      { status: 500 }
    );
  }
}
