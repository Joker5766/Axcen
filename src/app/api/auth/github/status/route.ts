import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const githubAccount = await prisma.gitHubAccount.findUnique({
      where: { userId: user.id },
      select: {
        githubUsername: true,
        avatarUrl: true,
        githubId: true,
      },
    });

    if (!githubAccount) {
      return NextResponse.json({
        connected: false,
        githubUsername: null,
        avatarUrl: null,
      });
    }

    return NextResponse.json({
      connected: true,
      githubUsername: githubAccount.githubUsername,
      avatarUrl: githubAccount.avatarUrl,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    return NextResponse.json(
      { error: 'Failed to check GitHub status.' },
      { status: 500 }
    );
  }
}
