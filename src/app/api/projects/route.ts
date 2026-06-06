import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all projects where user is a member
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
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
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('GET projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required.' },
        { status: 400 }
      );
    }

    const project = await prisma.$transaction(async (tx) => {
      // 1. Create the project
      const proj = await tx.project.create({
        data: {
          name: name.trim(),
          description: description?.trim() || '',
          ownerId: user.id,
        },
      });

      // 2. Add owner to members list
      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      // 3. Create default 'main' branch
      await tx.branch.create({
        data: {
          name: 'main',
          projectId: proj.id,
        },
      });

      // 4. Log project creation activity
      await tx.activity.create({
        data: {
          projectId: proj.id,
          userId: user.id,
          action: 'created',
          entityType: 'project',
          entityName: proj.name,
        },
      });

      return proj;
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('POST projects error:', error);
    return NextResponse.json(
      { error: 'Failed to create project.' },
      { status: 500 }
    );
  }
}
