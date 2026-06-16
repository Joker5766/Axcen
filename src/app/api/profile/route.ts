import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get user with GitHub account
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { githubAccount: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-generate profileCode for existing users who don't have one yet!
    if (!dbUser.profileCode) {
      let code = '';
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        attempts++;
        const randomStr = Math.random().toString(36).substring(2, 10);
        code = `axc-${randomStr}`;
        const existingUser = await prisma.user.findUnique({
          where: { profileCode: code },
        });
        if (!existingUser) {
          exists = false;
        }
      }
      if (!exists) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { profileCode: code },
          include: { githubAccount: true },
        });
      }
    }

    // 2. Fetch projects where user is a member
    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: {
            members: {
              include: {
                user: { select: { name: true, avatarUrl: true } }
              }
            },
            branches: true,
            githubRepository: true,
            repositoryAnalysis: true,
          }
        }
      }
    });

    const projects = memberships.map(m => m.project);

    // 3. Extract connected repositories
    const connectedRepos = projects
      .map(p => p.githubRepository)
      .filter(Boolean) as any[];

    // 4. Aggregate skill set from tech stacks
    const skillSet = new Set<string>();
    projects.forEach(p => {
      if (p.repositoryAnalysis) {
        try {
          const stack = JSON.parse(p.repositoryAnalysis.techStack || '[]') as string[];
          stack.forEach(tech => skillSet.add(tech));
        } catch (e) {}
      }
    });

    // 5. Query stats: total commits authored
    const authorNames = [dbUser.name];
    if (dbUser.githubAccount?.githubUsername) {
      authorNames.push(dbUser.githubAccount.githubUsername);
    }

    const totalCommitsCount = await prisma.gitHubCommit.count({
      where: {
        author: { in: authorNames },
      }
    });

    // Total nodes created
    const totalNodesCount = await prisma.node.count({
      where: { authorId: user.id },
    });

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        createdAt: dbUser.createdAt,
        githubUsername: dbUser.githubAccount?.githubUsername || null,
        profileCode: dbUser.profileCode || null,
        bannerGradient: dbUser.bannerGradient || null,
        isProfilePrivate: dbUser.isProfilePrivate,
      },
      stats: {
        totalProjects: projects.length,
        totalRepos: connectedRepos.length,
        totalCommits: totalCommitsCount,
        totalNodes: totalNodesCount,
      },
      skills: Array.from(skillSet),
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        membersCount: p.members.length,
        branchesCount: p.branches.length,
        repo: p.githubRepository ? `${p.githubRepository.repoOwner}/${p.githubRepository.repoName}` : null,
      })),
      repositories: connectedRepos.map(r => ({
        id: r.id,
        name: r.repoName,
        owner: r.repoOwner,
        url: r.repoUrl,
        defaultBranch: r.defaultBranch,
      })),
    });
  } catch (error) {
    console.error('Fetch profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile data.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { avatarUrl, bannerGradient, isProfilePrivate } = body;

    const updateData: any = {};

    if (typeof avatarUrl === 'string') {
      updateData.avatarUrl = avatarUrl;
    }

    if (typeof bannerGradient === 'string') {
      updateData.bannerGradient = bannerGradient;
    }

    if (typeof isProfilePrivate === 'boolean') {
      updateData.isProfilePrivate = isProfilePrivate;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        createdAt: updatedUser.createdAt,
        profileCode: updatedUser.profileCode,
        bannerGradient: updatedUser.bannerGradient,
        isProfilePrivate: updatedUser.isProfilePrivate,
      }
    });
  } catch (error) {
    console.error('PATCH profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile.' },
      { status: 500 }
    );
  }
}
