import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fetchRepoBranches } from '@/lib/github';

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

    // Get GitHubRepository linked to this project
    const githubRepository = await prisma.gitHubRepository.findUnique({
      where: { projectId },
    });

    if (!githubRepository) {
      return NextResponse.json(
        { error: 'No GitHub repository linked to this project.' },
        { status: 400 }
      );
    }

    // Retrieve user's GitHub account and token
    const githubAccount = await prisma.gitHubAccount.findUnique({
      where: { userId: user.id },
    });

    if (!githubAccount || !githubAccount.accessToken) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please connect your GitHub account in Settings.' },
        { status: 400 }
      );
    }

    // Fetch branches from GitHub
    const ghBranches = await fetchRepoBranches(
      githubAccount.accessToken,
      githubRepository.repoOwner,
      githubRepository.repoName
    );

    let createdCount = 0;
    let updatedCount = 0;

    for (const ghBranch of ghBranches) {
      const existingBranch = await prisma.branch.findUnique({
        where: {
          projectId_name: {
            projectId,
            name: ghBranch.name,
          },
        },
      });

      if (!existingBranch) {
        await prisma.branch.create({
          data: {
            name: ghBranch.name,
            projectId,
            githubSyncedFrom: true,
          },
        });
        createdCount++;
      } else {
        await prisma.branch.update({
          where: { id: existingBranch.id },
          data: {
            githubSyncedFrom: true,
          },
        });
        updatedCount++;
      }
    }

    // Update last synced date on repo
    await prisma.gitHubRepository.update({
      where: { id: githubRepository.id },
      data: {
        lastBranchSync: new Date(),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        projectId,
        userId: user.id,
        action: 'synchronized branches',
        entityType: 'project',
        entityName: `${githubRepository.repoOwner}/${githubRepository.repoName}`,
      },
    });

    return NextResponse.json({
      success: true,
      branchesCount: ghBranches.length,
      createdCount,
      updatedCount,
    });
  } catch (error) {
    console.error('Sync branches error:', error);
    return NextResponse.json(
      { error: 'Failed to synchronize branches from GitHub.' },
      { status: 500 }
    );
  }
}
