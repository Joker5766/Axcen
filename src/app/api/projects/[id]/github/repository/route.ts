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

    const { repoName, repoOwner, repoUrl, defaultBranch } = await request.json();

    if (!repoName || !repoOwner || !repoUrl) {
      return NextResponse.json(
        { error: 'Repository name, owner, and URL are required.' },
        { status: 400 }
      );
    }

    const repository = await prisma.gitHubRepository.upsert({
      where: { projectId },
      create: {
        projectId,
        repoName,
        repoOwner,
        repoUrl,
        defaultBranch: defaultBranch || 'main',
      },
      update: {
        repoName,
        repoOwner,
        repoUrl,
        defaultBranch: defaultBranch || 'main',
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        projectId,
        userId: user.id,
        action: 'linked repository',
        entityType: 'project',
        entityName: `${repoOwner}/${repoName}`,
      },
    });

    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Link repository error:', error);
    return NextResponse.json(
      { error: 'Failed to link repository.' },
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

    const existingRepo = await prisma.gitHubRepository.findUnique({
      where: { projectId },
    });

    if (!existingRepo) {
      return NextResponse.json(
        { error: 'No repository linked to this project.' },
        { status: 400 }
      );
    }

    await prisma.gitHubRepository.delete({
      where: { projectId },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        projectId,
        userId: user.id,
        action: 'unlinked repository',
        entityType: 'project',
        entityName: `${existingRepo.repoOwner}/${existingRepo.repoName}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unlink repository error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink repository.' },
      { status: 500 }
    );
  }
}
