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
  githubSyncedFrom?: boolean;
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
  githubCommits?: GitHubCommit[];
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

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  branches: Branch[];
  activities?: Activity[];
  githubRepository?: GitHubRepository | null;
}

// ─── GitHub Integration Types ────────────────────────────────────────────────

export interface GitHubAccount {
  id: string;
  githubId: number;
  githubUsername: string;
  avatarUrl: string | null;
}

export interface GitHubRepository {
  id: string;
  projectId: string;
  repoName: string;
  repoOwner: string;
  repoUrl: string;
  defaultBranch: string;
  lastBranchSync: string | null;
  lastCommitSync: string | null;
}

export interface GitHubCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  branchName: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

