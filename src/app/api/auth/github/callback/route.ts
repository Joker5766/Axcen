import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exchangeCodeForToken, fetchGitHubUser } from '@/lib/github';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle GitHub OAuth errors
    if (error) {
      console.error('GitHub OAuth error:', error);
      return NextResponse.redirect(new URL('/?github_error=denied', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?github_error=no_code', request.url));
    }

    // Verify state matches user ID
    if (state !== user.id) {
      return NextResponse.redirect(new URL('/?github_error=invalid_state', request.url));
    }

    // Exchange code for access token
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/github/callback`;
    const accessToken = await exchangeCodeForToken(code, redirectUri);

    // Fetch GitHub user profile
    const githubUser = await fetchGitHubUser(accessToken);

    // Create or update GitHub account link
    await prisma.gitHubAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        accessToken,
        avatarUrl: githubUser.avatar_url,
      },
      update: {
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        accessToken,
        avatarUrl: githubUser.avatar_url,
      },
    });

    // Redirect back to dashboard with success indicator
    return NextResponse.redirect(new URL('/?github_connected=true', request.url));
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?github_error=callback_failed', request.url));
  }
}
