export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string;
}

export interface ProjectMember {
  id: string;
  role: string;
  invitedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  };
}

export interface Branch {
  id: string;
  name: string;
  projectId: string;
  parentBranchId: string | null;
  createdAt: string;
}

export interface Node {
  id: string;
  title: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  branchId: string;
  authorId: string;
  summary: string;
  notes: string;
  nextSteps: string;
  relatedCommits: string[];
  completedWork: string[];
  pendingWork: string[];
  createdAt: string;
  updatedAt: string;
  author: User;
}

export interface Relationship {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: string;
  entityName: string;
  createdAt: string;
  user: User;
}
