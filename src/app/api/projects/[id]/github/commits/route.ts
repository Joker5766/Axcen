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
      return NextResponse.json({ commits: [] });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const commits = await prisma.gitHubCommit.findMany({
      where: {
        repoId: githubRepository.id,
        ...(query
          ? {
              OR: [
                { sha: { contains: query } },
                { message: { contains: query } },
                { author: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({ commits });
  } catch (error) {
    console.error('Fetch commits error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch synced commits.' },
      { status: 500 }
    );
  }
}
