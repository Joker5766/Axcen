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
    const { nodeId, commitShas, newTitle } = await request.json();

    if (!nodeId || !commitShas || !Array.isArray(commitShas) || commitShas.length === 0 || !newTitle || !newTitle.trim()) {
      return NextResponse.json(
        { error: 'Node ID, commit SHAs to split, and a new title are required.' },
        { status: 400 }
      );
    }

    // Check project membership
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const originalNode = await prisma.node.findUnique({
      where: { id: nodeId },
      include: { githubCommits: true },
    });

    if (!originalNode) {
      return NextResponse.json({ error: 'Original node not found.' }, { status: 404 });
    }

    const originalCommits = JSON.parse(originalNode.relatedCommits || '[]') as string[];
    
    // Validate all commitShas belong to original node
    const invalidShas = commitShas.filter(sha => !originalCommits.includes(sha));
    if (invalidShas.length > 0) {
      return NextResponse.json(
        { error: `The following commits do not belong to the original node: ${invalidShas.join(', ')}` },
        { status: 400 }
      );
    }

    // Remaining commits for original node
    const remainingCommits = originalCommits.filter(sha => !commitShas.includes(sha));

    if (remainingCommits.length === 0) {
      return NextResponse.json(
        { error: 'Cannot split all commits out of a node. Leave at least one commit or delete the node instead.' },
        { status: 400 }
      );
    }

    // Find git commits to move
    const movedGitCommits = originalNode.githubCommits.filter(c => commitShas.includes(c.sha));
    const remainingGitCommits = originalNode.githubCommits.filter(c => remainingCommits.includes(c.sha));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create new node
      const newNode = await tx.node.create({
        data: {
          title: newTitle.trim(),
          status: originalNode.status,
          branchId: originalNode.branchId,
          authorId: user.id,
          summary: `Split area focusing on ${newTitle.trim()}, moved from '${originalNode.title}'.`,
          relatedCommits: JSON.stringify(commitShas),
          completedWork: JSON.stringify(movedGitCommits.map(c => c.message)),
          pendingWork: JSON.stringify([]),
          isAiGenerated: false, // user action
          githubCommits: {
            connect: movedGitCommits.map(c => ({ id: c.id })),
          },
        },
      });

      // 2. Update original node
      const updatedOriginal = await tx.node.update({
        where: { id: nodeId },
        data: {
          relatedCommits: JSON.stringify(remainingCommits),
          completedWork: JSON.stringify(remainingGitCommits.map(c => c.message)),
          isAiGenerated: false, // user action
          githubCommits: {
            set: remainingGitCommits.map(c => ({ id: c.id })),
          },
        },
      });

      // 3. Link them in the graph timeline
      const getEarliestTimestamp = (commitsList: typeof movedGitCommits) => {
        if (commitsList.length === 0) return 0;
        return Math.min(...commitsList.map(c => new Date(c.timestamp).getTime()));
      };

      const originalTime = getEarliestTimestamp(remainingGitCommits);
      const newTime = getEarliestTimestamp(movedGitCommits);

      // Link sequentially
      if (newTime < originalTime) {
        await tx.nodeRelationship.create({
          data: {
            fromNodeId: newNode.id,
            toNodeId: originalNode.id,
          },
        });

        // Redirect incoming links of originalNode to newNode
        const incoming = await tx.nodeRelationship.findMany({
          where: { toNodeId: originalNode.id, fromNodeId: { not: newNode.id } },
        });

        for (const rel of incoming) {
          await tx.nodeRelationship.update({
            where: { id: rel.id },
            data: { toNodeId: newNode.id },
          });
        }
      } else {
        await tx.nodeRelationship.create({
          data: {
            fromNodeId: originalNode.id,
            toNodeId: newNode.id,
          },
        });

        // Redirect outgoing links of originalNode to newNode
        const outgoing = await tx.nodeRelationship.findMany({
          where: { fromNodeId: originalNode.id, toNodeId: { not: newNode.id } },
        });

        for (const rel of outgoing) {
          await tx.nodeRelationship.update({
            where: { id: rel.id },
            data: { fromNodeId: newNode.id },
          });
        }
      }

      // Log activity
      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: 'split cluster',
          entityType: 'node',
          entityName: `${newTitle.trim()} from ${originalNode.title}`,
        },
      });

      return { updatedOriginal, newNode };
    });

    // Fetch full details
    const fullOriginal = await prisma.node.findUnique({
      where: { id: result.updatedOriginal.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        githubCommits: true,
      },
    });

    const fullNew = await prisma.node.findUnique({
      where: { id: result.newNode.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        githubCommits: true,
      },
    });

    return NextResponse.json({
      originalNode: {
        ...fullOriginal,
        relatedCommits: JSON.parse(fullOriginal?.relatedCommits || '[]'),
        completedWork: JSON.parse(fullOriginal?.completedWork || '[]'),
        pendingWork: JSON.parse(fullOriginal?.pendingWork || '[]'),
      },
      newNode: {
        ...fullNew,
        relatedCommits: JSON.parse(fullNew?.relatedCommits || '[]'),
        completedWork: JSON.parse(fullNew?.completedWork || '[]'),
        pendingWork: JSON.parse(fullNew?.pendingWork || '[]'),
      },
    });
  } catch (error) {
    console.error('Split node error:', error);
    return NextResponse.json(
      { error: 'Failed to split node.' },
      { status: 500 }
    );
  }
}
