export interface ShiftAxWorktreeRequest {
  rootDir: string;
  topicSlug: string;
  request: string;
}

export interface ShiftAxWorktreePlan {
  version: 1;
  topic_slug: string;
  preferred_branch_name: string;
  preferred_worktree_path: string;
}

export type ShiftAxWorktreeSupport = 'planned' | 'available';

export function buildWorktreePlan({
  rootDir,
  topicSlug,
}: ShiftAxWorktreeRequest): ShiftAxWorktreePlan {
  return {
    version: 1,
    topic_slug: topicSlug,
    preferred_branch_name: `ax/${topicSlug}`,
    preferred_worktree_path: `${rootDir}/.ax/worktrees/${topicSlug}`,
  };
}
