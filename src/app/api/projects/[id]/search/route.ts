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
    
    // Parse query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || !query.trim()) {
      return NextResponse.json({ nodes: [], branches: [], members: [] });
    }

    const searchTerm = query.trim();

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

    // 1. Search nodes in the project (SQLite contains is case-insensitive by default)
    const nodes = await prisma.node.findMany({
      where: {
        branch: {
          projectId,
        },
        OR: [
          { title: { contains: searchTerm } },
          { summary: { contains: searchTerm } },
          { notes: { contains: searchTerm } },
        ],
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
    });

    // 2. Search branches in the project
    const branches = await prisma.branch.findMany({
      where: {
        projectId,
        name: { contains: searchTerm },
      },
      take: 5,
    });

    // 3. Search members in the project
    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        user: {
          OR: [
            { name: { contains: searchTerm } },
            { email: { contains: searchTerm } },
          ],
        },
      },
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
      take: 5,
    });

    return NextResponse.json({
      nodes,
      branches,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
    });
  } catch (error) {
    console.error('Search project error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search.' },
      { status: 500 }
    );
  }
}
