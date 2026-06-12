import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    // 1. Clean existing database
    await prisma.activity.deleteMany({});
    await prisma.nodeRelationship.deleteMany({});
    await prisma.node.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    // 2. Create Users
    const pwdHash = await hashPassword('password123');
    
    const john = await prisma.user.create({
      data: {
        email: 'john@company.com',
        name: 'John Doe',
        passwordHash: pwdHash,
        avatarUrl: 'https://ui-avatars.com/api/?name=JD&background=4F46E5&color=fff&size=128',
      },
    });

    const sarah = await prisma.user.create({
      data: {
        email: 'sarah@company.com',
        name: 'Sarah Connor',
        passwordHash: pwdHash,
        avatarUrl: 'https://ui-avatars.com/api/?name=SC&background=10B981&color=fff&size=128',
      },
    });

    const alex = await prisma.user.create({
      data: {
        email: 'alex@company.com',
        name: 'Alex Mercer',
        passwordHash: pwdHash,
        avatarUrl: 'https://ui-avatars.com/api/?name=AM&background=EF4444&color=fff&size=128',
      },
    });

    // 3. Create Projects
    const p1 = await prisma.project.create({
      data: {
        name: 'Food Delivery App',
        description: 'On-demand food delivery mobile app and backend workspace dashboard.',
        ownerId: john.id,
      },
    });

    const p2 = await prisma.project.create({
      data: {
        name: 'E-Commerce Platform',
        description: 'Next-gen headless e-commerce store with high performance page rendering.',
        ownerId: sarah.id,
      },
    });

    // 4. Create Project Members
    // Project 1 members
    await prisma.projectMember.create({
      data: { projectId: p1.id, userId: john.id, role: 'OWNER' },
    });
    await prisma.projectMember.create({
      data: { projectId: p1.id, userId: sarah.id, role: 'MEMBER' },
    });
    await prisma.projectMember.create({
      data: { projectId: p1.id, userId: alex.id, role: 'MEMBER' },
    });

    // Project 2 members
    await prisma.projectMember.create({
      data: { projectId: p2.id, userId: sarah.id, role: 'OWNER' },
    });
    await prisma.projectMember.create({
      data: { projectId: p2.id, userId: john.id, role: 'MEMBER' },
    });

    // 5. Create Branches for Project 1
    const bMain = await prisma.branch.create({
      data: { name: 'main', projectId: p1.id },
    });

    const bAuth = await prisma.branch.create({
      data: { name: 'feature/auth', projectId: p1.id, parentBranchId: bMain.id },
    });

    const bAuthRefactor = await prisma.branch.create({
      data: { name: 'feature/auth-refactor', projectId: p1.id, parentBranchId: bAuth.id },
    });

    const bProfile = await prisma.branch.create({
      data: { name: 'feature/profile', projectId: p1.id, parentBranchId: bMain.id },
    });

    // Create Branches for Project 2
    const b2Main = await prisma.branch.create({
      data: { name: 'main', projectId: p2.id },
    });
    const b2Stripe = await prisma.branch.create({
      data: { name: 'feature/stripe-gateway', projectId: p2.id, parentBranchId: b2Main.id },
    });

    // 6. Create Development Nodes for Project 1 (feature/auth branch)
    const nLoginUI = await prisma.node.create({
      data: {
        title: 'Login UI',
        status: 'COMPLETED',
        branchId: bAuth.id,
        authorId: john.id,
        summary: 'Designed and implemented the core login page interface with input fields and validation markup.',
        completedWork: JSON.stringify([
          'Design login card layout with Tailwind CSS',
          'Add email format validation warning',
          'Configure Geist and Inter Google Fonts font weights',
          'Hook up form state submit handler'
        ]),
        pendingWork: JSON.stringify([]),
        relatedCommits: JSON.stringify(['a7f34c2', '5b11ef4']),
        notes: 'Aligned login styling with our brand kit. Works cleanly on small viewport sizes.',
        nextSteps: 'Create authentication API routing to link database.'
      },
    });

    const nValidation = await prisma.node.create({
      data: {
        title: 'Auth Validation Middleware',
        status: 'COMPLETED',
        branchId: bAuth.id,
        authorId: sarah.id,
        summary: 'Added server-side request verification check middleware for auth routing.',
        completedWork: JSON.stringify([
          'Regex email format verification helper',
          'Check password minimum length restriction (6+ characters)',
          'Filter out SQL injection patterns'
        ]),
        pendingWork: JSON.stringify([]),
        relatedCommits: JSON.stringify(['e4f3a2c']),
        notes: 'Applied standard regex validators to protect the auth routes. Returns a standard 400 Bad Request error on failure.',
        nextSteps: 'Begin direct database client integrations.'
      },
    });

    const nApi = await prisma.node.create({
      data: {
        title: 'Auth API Integrations',
        status: 'IN_PROGRESS',
        branchId: bAuth.id,
        authorId: alex.id,
        summary: 'Connecting frontend signup/login handlers to the server API endpoints.',
        completedWork: JSON.stringify([
          'Write signup route handling password hashing',
          'Implement secure httpOnly session cookies'
        ]),
        pendingWork: JSON.stringify([
          'Implement session refresh endpoint',
          'Test login token cookie lifetime expiration edge cases'
        ]),
        relatedCommits: JSON.stringify(['d5b2c91']),
        notes: 'Session token cookie is successfully generated and verified. Currently working on session refresh tokens.',
        nextSteps: 'Add comprehensive mock network latency tests.'
      },
    });

    const nError = await prisma.node.create({
      data: {
        title: 'Toast Notification Error Alerts',
        status: 'NOT_STARTED',
        branchId: bAuth.id,
        authorId: john.id,
        summary: 'Provide visual indicators/toasts on the login screen for API errors or failed connection timeouts.',
        completedWork: JSON.stringify([]),
        pendingWork: JSON.stringify([
          'Incorporate toast alerts widget',
          'Display bad password credentials validation failure indicator'
        ]),
        relatedCommits: JSON.stringify([]),
        notes: 'Will start this node once Alex finishes active API session cookies development.',
        nextSteps: 'Finalize auth branch and merge into main.'
      },
    });

    // 7. Create Node Relationships (connections) for Project 1
    // Login UI -> Validation -> API Integration -> Error Handling
    await prisma.nodeRelationship.create({
      data: { fromNodeId: nLoginUI.id, toNodeId: nValidation.id },
    });
    await prisma.nodeRelationship.create({
      data: { fromNodeId: nValidation.id, toNodeId: nApi.id },
    });
    await prisma.nodeRelationship.create({
      data: { fromNodeId: nApi.id, toNodeId: nError.id },
    });

    // 8. Create Nodes for feature/profile branch
    const nProfileUI = await prisma.node.create({
      data: {
        title: 'User Profile Details Card',
        status: 'COMPLETED',
        branchId: bProfile.id,
        authorId: alex.id,
        summary: 'Built profile component showing user details, avatar, and signup dates.',
        completedWork: JSON.stringify([
          'Design profile page mockup',
          'Display user initials avatar image',
          'Fetch profile API details'
        ]),
        pendingWork: JSON.stringify([]),
        relatedCommits: JSON.stringify(['c7d1e89']),
      },
    });

    // 9. Log Activities
    // Project 1 activities
    await prisma.activity.create({
      data: { projectId: p1.id, userId: john.id, action: 'created', entityType: 'project', entityName: p1.name, createdAt: new Date(Date.now() - 3600000 * 24 * 3) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: john.id, action: 'created branch', entityType: 'branch', entityName: bAuth.name, createdAt: new Date(Date.now() - 3600000 * 24 * 2) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: john.id, action: 'invited', entityType: 'member', entityName: sarah.name, createdAt: new Date(Date.now() - 3600000 * 24 * 2) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: john.id, action: 'invited', entityType: 'member', entityName: alex.name, createdAt: new Date(Date.now() - 3600000 * 24 * 2) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: john.id, action: 'created node', entityType: 'node', entityName: nLoginUI.title, createdAt: new Date(Date.now() - 3600000 * 12) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: sarah.id, action: 'completed node', entityType: 'node', entityName: nValidation.title, createdAt: new Date(Date.now() - 3600000 * 6) },
    });
    await prisma.activity.create({
      data: { projectId: p1.id, userId: alex.id, action: 'started node', entityType: 'node', entityName: nApi.title, createdAt: new Date(Date.now() - 3600000 * 2) },
    });

    // Project 2 activities
    await prisma.activity.create({
      data: { projectId: p2.id, userId: sarah.id, action: 'created', entityType: 'project', entityName: p2.name, createdAt: new Date(Date.now() - 3600000 * 24) },
    });
    await prisma.activity.create({
      data: { projectId: p2.id, userId: sarah.id, action: 'created branch', entityType: 'branch', entityName: b2Stripe.name, createdAt: new Date(Date.now() - 3600000 * 4) },
    });

    return NextResponse.json({
      success: true,
      message: 'Database successfully cleaned and seeded with dummy data.',
      testAccounts: [
        { email: 'john@company.com', password: 'password123', name: 'John Doe (Owner/Dev)' },
        { email: 'sarah@company.com', password: 'password123', name: 'Sarah Connor (Member/Dev)' },
        { email: 'alex@company.com', password: 'password123', name: 'Alex Mercer (Member/Dev)' }
      ]
    });
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
