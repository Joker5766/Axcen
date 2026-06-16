import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // Find the user with this public profileCode
    const dbUser = await prisma.user.findUnique({
      where: { profileCode: code },
      include: { githubAccount: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch public project memberships for this user
    const memberships = await prisma.projectMember.findMany({
      where: { userId: dbUser.id },
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

    // Extract connected repositories
    const connectedRepos = projects
      .map(p => p.githubRepository)
      .filter(Boolean) as any[];

    // Aggregate skill set from tech stacks
    const skillSet = new Set<string>();
    projects.forEach(p => {
      if (p.repositoryAnalysis) {
        try {
          const stack = JSON.parse(p.repositoryAnalysis.techStack || '[]') as string[];
          stack.forEach(tech => skillSet.add(tech));
        } catch (e) {}
      }
    });

    // Query stats: total commits authored
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
      where: { authorId: dbUser.id },
    });

    return NextResponse.json({
      user: {
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        createdAt: dbUser.createdAt,
        githubUsername: dbUser.githubAccount?.githubUsername || null,
        profileCode: dbUser.profileCode,
        bannerGradient: dbUser.bannerGradient || null,
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
    console.error('Fetch public profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile data.' },
      { status: 500 }
    );
  }
}
