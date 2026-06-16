import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required.' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    
    // Simple initials avatar URL using ui-avatars.com
    const initials = encodeURIComponent(
      name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U'
    );
    const avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=128`;

    let profileCode = '';
    let codeExists = true;
    let attempts = 0;
    while (codeExists && attempts < 10) {
      attempts++;
      const randomStr = Math.random().toString(36).substring(2, 10);
      profileCode = `axc-${randomStr}`;
      const existingUserCode = await prisma.user.findUnique({
        where: { profileCode },
      });
      if (!existingUserCode) {
        codeExists = false;
      }
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        avatarUrl,
        profileCode: codeExists ? null : profileCode,
      },
    });

    await setSessionCookie(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { 
        error: 'Something went wrong. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
