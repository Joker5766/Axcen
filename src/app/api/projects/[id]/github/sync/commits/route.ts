import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fetchBranchCommits } from '@/lib/github';

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

    // Fetch all project branches from database
    const branches = await prisma.branch.findMany({
      where: { projectId },
    });

    let totalCommitsSynced = 0;
    const errors: string[] = [];

    // Loop through each branch and fetch commits from GitHub API
    for (const branch of branches) {
      try {
        const commits = await fetchBranchCommits(
          githubAccount.accessToken,
          githubRepository.repoOwner,
          githubRepository.repoName,
          branch.name
        );

        for (const c of commits) {
          const authorName = c.author?.login || c.commit?.author?.name || 'Unknown';
          const commitDate = c.commit?.author?.date ? new Date(c.commit.author.date) : new Date();

          await prisma.gitHubCommit.upsert({
            where: {
              repoId_sha: {
                repoId: githubRepository.id,
                sha: c.sha,
              },
            },
            create: {
              sha: c.sha,
              message: c.commit.message,
              author: authorName,
              timestamp: commitDate,
              branchName: branch.name,
              repoId: githubRepository.id,
            },
            update: {
              // Optionally update branchName if needed, but usually keep details
              branchName: branch.name,
            },
          });
          totalCommitsSynced++;
        }
      } catch (err) {
        console.error(`Error syncing commits for branch ${branch.name}:`, err);
        errors.push(`Branch ${branch.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Update last synced date on repo
    await prisma.gitHubRepository.update({
      where: { id: githubRepository.id },
      data: {
        lastCommitSync: new Date(),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        projectId,
        userId: user.id,
        action: 'synchronized commits',
        entityType: 'project',
        entityName: `${githubRepository.repoOwner}/${githubRepository.repoName}`,
      },
    });

    return NextResponse.json({
      success: true,
      totalCommitsSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Sync commits error:', error);
    return NextResponse.json(
      { error: 'Failed to synchronize commits from GitHub.' },
      { status: 500 }
    );
  }
}
