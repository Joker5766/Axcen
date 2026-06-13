const GITHUB_API = 'https://api.github.com';

interface GitHubApiOptions {
  accessToken: string;
  endpoint: string;
  params?: Record<string, string>;
}

async function githubFetch<T>(options: GitHubApiOptions): Promise<T> {
  const url = new URL(`${GITHUB_API}${options.endpoint}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Axcen-App',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

// ─── GitHub User ─────────────────────────────────────────────────────────────

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  return githubFetch<GitHubUser>({
    accessToken,
    endpoint: '/user',
  });
}

// ─── Repositories ────────────────────────────────────────────────────────────

export interface GitHubRepoResponse {
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

export async function fetchUserRepos(accessToken: string): Promise<GitHubRepoResponse[]> {
  const allRepos: GitHubRepoResponse[] = [];
  let page = 1;
  const perPage = 100;

  // Paginate through all repos (max 10 pages = 1000 repos)
  while (page <= 10) {
    const repos = await githubFetch<GitHubRepoResponse[]>({
      accessToken,
      endpoint: '/user/repos',
      params: {
        sort: 'updated',
        direction: 'desc',
        per_page: String(perPage),
        page: String(page),
        type: 'all',
      },
    });

    allRepos.push(...repos);

    if (repos.length < perPage) break;
    page++;
  }

  return allRepos;
}

// ─── Branches ────────────────────────────────────────────────────────────────

export interface GitHubBranchResponse {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export async function fetchRepoBranches(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GitHubBranchResponse[]> {
  const allBranches: GitHubBranchResponse[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= 5) {
    const branches = await githubFetch<GitHubBranchResponse[]>({
      accessToken,
      endpoint: `/repos/${owner}/${repo}/branches`,
      params: {
        per_page: String(perPage),
        page: String(page),
      },
    });

    allBranches.push(...branches);

    if (branches.length < perPage) break;
    page++;
  }

  return allBranches;
}

// ─── Commits ─────────────────────────────────────────────────────────────────

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export async function fetchBranchCommits(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string,
  maxPages: number = 3
): Promise<GitHubCommitResponse[]> {
  const allCommits: GitHubCommitResponse[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= maxPages) {
    const commits = await githubFetch<GitHubCommitResponse[]>({
      accessToken,
      endpoint: `/repos/${owner}/${repo}/commits`,
      params: {
        sha: branch,
        per_page: String(perPage),
        page: String(page),
      },
    });

    allCommits.push(...commits);

    if (commits.length < perPage) break;
    page++;
  }

  return allCommits;
}

// ─── OAuth Token Exchange ────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}
