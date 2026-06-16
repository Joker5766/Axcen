import { prisma } from './db';
import {
  fetchRepoRootContents,
  fetchRepoFileContent,
  fetchRepoBranches,
  fetchBranchCommits
} from './github';

export async function analyzeRepository(projectId: string, userId: string) {
  // 1. Get project and its github repository details
  const githubRepo = await prisma.gitHubRepository.findUnique({
    where: { projectId },
  });
  if (!githubRepo) {
    throw new Error('No GitHub repository linked to this project.');
  }

  // Retrieve user's GitHub account and token
  const githubAccount = await prisma.gitHubAccount.findUnique({
    where: { userId },
  });
  if (!githubAccount || !githubAccount.accessToken) {
    throw new Error('GitHub account not connected. Please connect your GitHub account in Settings.');
  }

  const token = githubAccount.accessToken;
  const owner = githubRepo.repoOwner;
  const repo = githubRepo.repoName;

  // 2. Automatically sync branches from GitHub
  let ghBranches: any[] = [];
  try {
    ghBranches = await fetchRepoBranches(token, owner, repo);
    for (const ghBranch of ghBranches) {
      await prisma.branch.upsert({
        where: {
          projectId_name: {
            projectId,
            name: ghBranch.name,
          },
        },
        create: {
          name: ghBranch.name,
          projectId,
          githubSyncedFrom: true,
        },
        update: {
          githubSyncedFrom: true,
        },
      });
    }
  } catch (err) {
    console.error('Error syncing branches:', err);
  }

  // 3. Automatically sync commits for all branches
  const dbBranches = await prisma.branch.findMany({ where: { projectId } });
  for (const branch of dbBranches) {
    try {
      const commits = await fetchBranchCommits(token, owner, repo, branch.name, 2); // fetch 2 pages (up to 200 commits) to keep it fast
      for (const c of commits) {
        const authorName = c.author?.login || c.commit?.author?.name || 'Unknown';
        const commitDate = c.commit?.author?.date ? new Date(c.commit.author.date) : new Date();

        await prisma.gitHubCommit.upsert({
          where: {
            repoId_sha: {
              repoId: githubRepo.id,
              sha: c.sha,
            },
          },
          create: {
            sha: c.sha,
            message: c.commit.message,
            author: authorName,
            timestamp: commitDate,
            branchName: branch.name,
            repoId: githubRepo.id,
          },
          update: {
            branchName: branch.name,
          },
        });
      }
    } catch (err) {
      console.error(`Error syncing commits for branch ${branch.name}:`, err);
    }
  }

  // Update repository sync times
  await prisma.gitHubRepository.update({
    where: { id: githubRepo.id },
    data: {
      lastBranchSync: new Date(),
      lastCommitSync: new Date(),
    },
  });

  // 4. Scan repository root files to detect tech stack (NO guessing)
  const techStack: string[] = [];
  try {
    const rootContents = await fetchRepoRootContents(token, owner, repo);
    if (rootContents && Array.isArray(rootContents)) {
      const hasFile = (name: string) => rootContents.some(item => item.name === name);

      if (hasFile('Dockerfile')) techStack.push('Docker');
      if (hasFile('docker-compose.yml') || hasFile('docker-compose.yaml')) techStack.push('Docker Compose');
      if (hasFile('Cargo.toml')) techStack.push('Rust');

      if (hasFile('package.json')) {
        techStack.push('Node.js');
        const content = await fetchRepoFileContent(token, owner, repo, 'package.json');
        if (content) {
          try {
            const pkg = JSON.parse(content);
            const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            
            if (allDeps['react']) techStack.push('React');
            if (allDeps['next']) techStack.push('Next.js');
            if (allDeps['typescript'] || hasFile('tsconfig.json')) techStack.push('TypeScript');
            if (allDeps['tailwindcss'] || allDeps['@tailwindcss/postcss'] || allDeps['@tailwindcss/vite']) techStack.push('Tailwind CSS');
            if (allDeps['prisma'] || allDeps['@prisma/client']) techStack.push('Prisma');
            
            if (allDeps['pg'] || allDeps['postgres'] || allDeps['pg-promise'] || pkg.name?.includes('postgres')) {
              techStack.push('PostgreSQL');
            }
          } catch (e) {}
        }
      } else if (hasFile('tsconfig.json')) {
        techStack.push('TypeScript');
      }

      if (hasFile('requirements.txt')) {
        techStack.push('Python');
        const content = await fetchRepoFileContent(token, owner, repo, 'requirements.txt');
        if (content) {
          const lines = content.toLowerCase();
          if (lines.includes('django')) techStack.push('Django');
          if (lines.includes('flask')) techStack.push('Flask');
          if (lines.includes('fastapi')) techStack.push('FastAPI');
        }
      }

      if (hasFile('pom.xml')) {
        techStack.push('Java');
        const content = await fetchRepoFileContent(token, owner, repo, 'pom.xml');
        if (content && content.includes('spring-boot')) {
          techStack.push('Spring Boot');
        }
      }

      const hasGradle = hasFile('build.gradle') || hasFile('build.gradle.kts');
      if (hasGradle) {
        techStack.push('Gradle');
        const fileName = hasFile('build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle';
        const content = await fetchRepoFileContent(token, owner, repo, fileName);
        if (content) {
          if (content.toLowerCase().includes('kotlin')) techStack.push('Kotlin');
          else techStack.push('Java');
          
          if (content.includes('spring-boot')) techStack.push('Spring Boot');
          if (content.toLowerCase().includes('android')) techStack.push('Android');
        } else {
          techStack.push('Java');
        }
      }

      if (hasFile('composer.json')) {
        techStack.push('PHP');
        const content = await fetchRepoFileContent(token, owner, repo, 'composer.json');
        if (content) {
          try {
            const comp = JSON.parse(content);
            const req = { ...(comp.require || {}), ...(comp['require-dev'] || {}) };
            if (req['laravel/framework'] || req['laravel']) techStack.push('Laravel');
          } catch (e) {}
        }
      }

      if (hasFile('pubspec.yaml')) {
        techStack.push('Dart');
        const content = await fetchRepoFileContent(token, owner, repo, 'pubspec.yaml');
        if (content && content.includes('flutter')) {
          techStack.push('Flutter');
        }
      }

      if (hasFile('Gemfile')) {
        techStack.push('Ruby');
        const content = await fetchRepoFileContent(token, owner, repo, 'Gemfile');
        if (content && content.toLowerCase().includes('rails')) {
          techStack.push('Rails');
        }
      }
    }
  } catch (err) {
    console.error('Error in tech stack detection:', err);
  }

  // 5. Query all synchronized commits and branches for the project
  const branches = await prisma.branch.findMany({ where: { projectId } });
  const commits = await prisma.gitHubCommit.findMany({
    where: { repoId: githubRepo.id },
    orderBy: { timestamp: 'asc' }, // sort chronologically ascending for clustering
  });

  const totalBranches = branches.length;
  const totalCommits = commits.length;
  const uniqueContributors = Array.from(new Set(commits.map(c => c.author))).filter(Boolean);
  const firstCommitDate = commits.length > 0 ? commits[0].timestamp : null;
  const lastCommitDate = commits.length > 0 ? commits[commits.length - 1].timestamp : null;

  // Retrieve user-customized nodes (isAiGenerated: false) to exclude their commits from clustering
  const userNodes = await prisma.node.findMany({
    where: {
      branch: { projectId },
      isAiGenerated: false,
    }
  });
  const excludedCommitShas = new Set<string>();
  userNodes.forEach(n => {
    try {
      const shas = JSON.parse(n.relatedCommits || '[]') as string[];
      shas.forEach(sha => excludedCommitShas.add(sha));
    } catch (e) {}
  });

  // Filter commits to only cluster those that aren't already user-customized
  const commitsToCluster = commits.filter(c => !excludedCommitShas.has(c.sha));

  // Clean up old purely AI-generated nodes
  const oldAiNodes = await prisma.node.findMany({
    where: {
      branch: { projectId },
      isAiGenerated: true,
    }
  });
  for (const node of oldAiNodes) {
    await prisma.node.delete({ where: { id: node.id } });
  }

  // 6. Deterministic Commit Clustering Algorithm
  // Helper to categorize commit topic based on keywords
  const getCommitTopic = (message: string): string => {
    const msg = message.toLowerCase();
    if (/auth|login|signup|signin|user|oauth|session|jwt|cookie|token/i.test(msg)) return 'Auth';
    if (/ui|layout|css|style|tailwind|page|component|view|button|font|icon/i.test(msg)) return 'UI';
    if (/api|route|endpoint|http|fetch|axios|request|controller|handler/i.test(msg)) return 'API';
    if (/db|database|prisma|sql|postgres|schema|migration|model|seed/i.test(msg)) return 'DB';
    if (/docker|compose|deploy|config|env|setup|ci|cd|action/i.test(msg)) return 'DevOps';
    if (/test|jest|cypress|spec|assert/i.test(msg)) return 'Test';
    if (/github|sync|repo|repository|import/i.test(msg)) return 'GitHub';
    if (/bug|fix|resolve|crash|error|patch/i.test(msg)) return 'BugFix';
    return 'General';
  };

  const getTopicTitle = (topic: string): string => {
    switch (topic) {
      case 'Auth': return 'Authentication & Access Control';
      case 'UI': return 'User Interface & Styling';
      case 'API': return 'API & Backend Integration';
      case 'DB': return 'Database Schema & Migrations';
      case 'DevOps': return 'DevOps & Configuration';
      case 'Test': return 'Testing & Quality Assurance';
      case 'GitHub': return 'GitHub Sync & Repository Integration';
      case 'BugFix': return 'Bug Fixes & Refactoring';
      case 'General':
      default:
        return 'Development Tasks';
    }
  };

  // Group commits by branch
  const commitsByBranch: Record<string, typeof commits> = {};
  commitsToCluster.forEach(c => {
    const key = c.branchName || 'main';
    if (!commitsByBranch[key]) commitsByBranch[key] = [];
    commitsByBranch[key].push(c);
  });

  const generatedClusters: {
    branchId: string;
    branchName: string;
    title: string;
    status: string;
    summary: string;
    relatedCommits: string[];
    completedWork: string[];
    author: string;
  }[] = [];

  const timeThresholdMs = 8 * 60 * 60 * 1000; // 8 hours proximity threshold

  for (const branchRecord of branches) {
    const branchCommits = commitsByBranch[branchRecord.name] || [];
    if (branchCommits.length === 0) continue;

    // Group branch commits by author
    const commitsByAuthor: Record<string, typeof commits> = {};
    branchCommits.forEach(c => {
      const auth = c.author || 'Unknown';
      if (!commitsByAuthor[auth]) commitsByAuthor[auth] = [];
      commitsByAuthor[auth].push(c);
    });

    for (const [author, authorCommits] of Object.entries(commitsByAuthor)) {
      // authorCommits are already sorted ascending by timestamp (due to previous order by)
      let currentClusterCommits: typeof commits = [];
      
      for (let i = 0; i < authorCommits.length; i++) {
        const c = authorCommits[i];
        if (currentClusterCommits.length === 0) {
          currentClusterCommits.push(c);
          continue;
        }

        const lastCommit = currentClusterCommits[currentClusterCommits.length - 1];
        const timeDiff = new Date(c.timestamp).getTime() - new Date(lastCommit.timestamp).getTime();

        // Proximity checks
        const isCloseInTime = timeDiff <= timeThresholdMs;
        const topicC = getCommitTopic(c.message);
        const topicLast = getCommitTopic(lastCommit.message);

        // Allow grouping if they are close in time and either has a general/bugfix topic or they share topics
        const hasTopicOverlap = topicC === 'General' || topicLast === 'General' || topicC === 'BugFix' || topicLast === 'BugFix' || topicC === topicLast;

        if (isCloseInTime && hasTopicOverlap) {
          currentClusterCommits.push(c);
        } else {
          // Finalize current cluster
          finalizeCluster(currentClusterCommits, branchRecord.id, branchRecord.name, author);
          currentClusterCommits = [c];
        }
      }

      if (currentClusterCommits.length > 0) {
        finalizeCluster(currentClusterCommits, branchRecord.id, branchRecord.name, author);
      }
    }
  }

  function finalizeCluster(clusterCommits: typeof commits, branchId: string, branchName: string, author: string) {
    // Determine the most common specific topic (excluding General/BugFix if possible)
    const topics = clusterCommits.map(c => getCommitTopic(c.message));
    const specificTopics = topics.filter(t => t !== 'General' && t !== 'BugFix');
    const topicToUse = specificTopics.length > 0 
      ? getMostFrequent(specificTopics) 
      : getMostFrequent(topics);

    const title = getTopicTitle(topicToUse);
    
    // Status is IN_PROGRESS if the latest commit is less than 3 days old, otherwise COMPLETED
    const latestTimestamp = new Date(clusterCommits[clusterCommits.length - 1].timestamp).getTime();
    const ageInDays = (new Date().getTime() - latestTimestamp) / (1000 * 60 * 60 * 24);
    const status = ageInDays < 3 ? 'IN_PROGRESS' : 'COMPLETED';

    const startTime = new Date(clusterCommits[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(clusterCommits[clusterCommits.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(clusterCommits[0].timestamp).toLocaleDateString();

    const summary = `Development area focusing on ${title} on branch '${branchName}', created by ${author} on ${dateStr} (${startTime} - ${endTime}).`;

    const relatedCommits = clusterCommits.map(c => c.sha);
    const completedWork = clusterCommits.map(c => c.message);

    generatedClusters.push({
      branchId,
      branchName,
      title,
      status,
      summary,
      relatedCommits,
      completedWork,
      author,
    });
  }

  function getMostFrequent(arr: string[]): string {
    const counts: Record<string, number> = {};
    let maxCount = 0;
    let maxItem = arr[0] || 'General';
    arr.forEach(val => {
      counts[val] = (counts[val] || 0) + 1;
      if (counts[val] > maxCount) {
        maxCount = counts[val];
        maxItem = val;
      }
    });
    return maxItem;
  }

  // 7. Save clusters as Nodes in the database
  const createdNodes: any[] = [];
  for (const cluster of generatedClusters) {
    const node = await prisma.node.create({
      data: {
        title: cluster.title,
        status: cluster.status,
        branchId: cluster.branchId,
        authorId: userId,
        summary: cluster.summary,
        relatedCommits: JSON.stringify(cluster.relatedCommits),
        completedWork: JSON.stringify(cluster.completedWork),
        pendingWork: JSON.stringify([]),
        isAiGenerated: true,
      }
    });

    // Link commits
    const dbCommits = await prisma.gitHubCommit.findMany({
      where: {
        repoId: githubRepo.id,
        sha: { in: cluster.relatedCommits },
      },
    });

    await prisma.node.update({
      where: { id: node.id },
      data: {
        githubCommits: {
          connect: dbCommits.map(c => ({ id: c.id })),
        },
      },
    });

    createdNodes.push(node);
  }

  // 8. Create chronological NodeRelationships within each branch
  const nodesByBranch: Record<string, typeof createdNodes> = {};
  createdNodes.forEach(n => {
    if (!nodesByBranch[n.branchId]) nodesByBranch[n.branchId] = [];
    nodesByBranch[n.branchId].push(n);
  });

  for (const branchNodes of Object.values(nodesByBranch)) {
    // Sort by creation time / earliest commit
    branchNodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < branchNodes.length - 1; i++) {
      await prisma.nodeRelationship.create({
        data: {
          fromNodeId: branchNodes[i].id,
          toNodeId: branchNodes[i+1].id,
        }
      });
    }
  }

  // 9. Generate factual project summary ONLY if there's enough evidence (e.g. >= 3 commits)
  let projectSummary = '';
  if (totalCommits >= 3) {
    projectSummary = `This repository is connected to ${githubRepo.repoOwner}/${githubRepo.repoName}. The repository comprises ${totalBranches} branches with a total of ${totalCommits} commits contributed by ${uniqueContributors.length} author(s). Factual evidence indicates active development areas including ${
      generatedClusters.length > 0 
        ? Array.from(new Set(generatedClusters.map(c => c.title.toLowerCase()))).slice(0, 3).join(', ')
        : 'general updates'
    }.`;
  }

  // Mock folder structure layout
  const structure = {
    Repository: [`Default branch: ${githubRepo.defaultBranch}`, `${totalBranches} active branches tracked`, `${totalCommits} total commits synchronized`],
    Technologies: techStack.length > 0 ? techStack : ['No technology metadata files detected in repository root']
  };

  const whatHasBeenBuilt = createdNodes
    .filter(n => n.status === 'COMPLETED')
    .map(n => n.title);
  
  const currentlyActiveAreas = createdNodes
    .filter(n => n.status === 'IN_PROGRESS')
    .map(n => n.title);

  const potentialNextSteps = generatedClusters
    .filter(c => c.status === 'IN_PROGRESS')
    .map(c => `Continue work on ${c.title.toLowerCase()} (${c.relatedCommits.length} commits)`)
    .slice(0, 3);

  // 10. Upsert RepositoryAnalysis record
  const analysis = await prisma.repositoryAnalysis.upsert({
    where: { projectId },
    create: {
      projectId,
      summary: projectSummary,
      techStack: JSON.stringify(techStack),
      structure: JSON.stringify(structure),
      totalBranches,
      totalCommits,
      contributors: JSON.stringify(uniqueContributors),
      lastUpdatedDate: lastCommitDate || new Date(),
      firstCommitDate: firstCommitDate,
      lastCommitDate: lastCommitDate,
      defaultBranch: githubRepo.defaultBranch,
      whatHasBeenBuilt: JSON.stringify(whatHasBeenBuilt),
      currentlyActiveAreas: JSON.stringify(currentlyActiveAreas),
      potentialNextSteps: JSON.stringify(potentialNextSteps),
    },
    update: {
      summary: projectSummary,
      techStack: JSON.stringify(techStack),
      structure: JSON.stringify(structure),
      totalBranches,
      totalCommits,
      contributors: JSON.stringify(uniqueContributors),
      lastUpdatedDate: lastCommitDate || new Date(),
      firstCommitDate: firstCommitDate,
      lastCommitDate: lastCommitDate,
      defaultBranch: githubRepo.defaultBranch,
      whatHasBeenBuilt: JSON.stringify(whatHasBeenBuilt),
      currentlyActiveAreas: JSON.stringify(currentlyActiveAreas),
      potentialNextSteps: JSON.stringify(potentialNextSteps),
    }
  });

  return {
    analysis: {
      ...analysis,
      techStack,
      structure,
      contributors: uniqueContributors,
      whatHasBeenBuilt,
      currentlyActiveAreas,
      potentialNextSteps,
    },
    workItemsCount: createdNodes.length
  };
}
