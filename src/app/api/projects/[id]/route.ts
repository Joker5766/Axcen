import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

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

    // Fetch the project and its related models in a single query
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
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
        },
        branches: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 50, // limit to last 50 activities for performance
        },
        githubRepository: true,
        repositoryAnalysis: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    // Fetch nodes separately to include connections and authors
    const nodes = await prisma.node.findMany({
      where: {
        branch: {
          projectId,
        },
      },
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
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Parse list columns from serialized JSON strings
    const parsedNodes = nodes.map((node) => ({
      ...node,
      relatedCommits: JSON.parse(node.relatedCommits || '[]'),
      completedWork: JSON.parse(node.completedWork || '[]'),
      pendingWork: JSON.parse(node.pendingWork || '[]'),
    }));

    // Fetch node relationships
    const relationships = await prisma.nodeRelationship.findMany({
      where: {
        fromNode: {
          branch: {
            projectId,
          },
        },
      },
    });

    let parsedAnalysis = null;
    if (project.repositoryAnalysis) {
      parsedAnalysis = {
        ...project.repositoryAnalysis,
        techStack: JSON.parse(project.repositoryAnalysis.techStack || '[]'),
        structure: JSON.parse(project.repositoryAnalysis.structure || '{}'),
        contributors: JSON.parse(project.repositoryAnalysis.contributors || '[]'),
        whatHasBeenBuilt: JSON.parse(project.repositoryAnalysis.whatHasBeenBuilt || '[]'),
        currentlyActiveAreas: JSON.parse(project.repositoryAnalysis.currentlyActiveAreas || '[]'),
        potentialNextSteps: JSON.parse(project.repositoryAnalysis.potentialNextSteps || '[]'),
      };
    }

    return NextResponse.json({
      project,
      nodes: parsedNodes,
      relationships,
      analysis: parsedAnalysis,
    });
  } catch (error) {
    console.error('GET project detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project details.' },
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

    const { id: projectId } = await params;

    // Verify user is project OWNER or has permission
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
        role: 'OWNER',
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden. Only the project owner can delete this project.' },
        { status: 403 }
      );
    }

    // Delete the project and all cascade relations (handled by DB Cascade rule)
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project.' },
      { status: 500 }
    );
  }
}

