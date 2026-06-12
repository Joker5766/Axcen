import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserRepos } from '@/lib/github';

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

    const repos = await fetchUserRepos(githubAccount.accessToken);
    return NextResponse.json({ repos });
  } catch (error) {
    console.error('Fetch GitHub repos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories from GitHub.' },
      { status: 500 }
    );
  }
}
