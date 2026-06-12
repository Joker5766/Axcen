import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the GitHub account link (cascading will NOT delete repos/commits since
    // those are linked to Project, not User — user just loses their token)
    const existing = await prisma.gitHubAccount.findUnique({
      where: { userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'No GitHub account connected.' },
        { status: 400 }
      );
    }

    await prisma.gitHubAccount.delete({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect GitHub account.' },
      { status: 500 }
    );
  }
}
