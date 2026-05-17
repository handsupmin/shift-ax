#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunPhase {
    Initialized,
    Planning,
    AwaitingPlanReview,
    ExecutionReady,
    Executing,
    ReviewPending,
    CommitReady,
    Committed,
    Blocked,
    Failed,
}

pub fn can_transition(from: RunPhase, to: RunPhase) -> bool {
    if from == to {
        return true;
    }

    matches!(
        (from, to),
        (RunPhase::Initialized, RunPhase::Planning)
            | (RunPhase::Initialized, RunPhase::ExecutionReady)
            | (RunPhase::Initialized, RunPhase::Blocked)
            | (RunPhase::Initialized, RunPhase::Failed)
            | (RunPhase::Planning, RunPhase::AwaitingPlanReview)
            | (RunPhase::Planning, RunPhase::Blocked)
            | (RunPhase::Planning, RunPhase::Failed)
            | (RunPhase::AwaitingPlanReview, RunPhase::ExecutionReady)
            | (RunPhase::AwaitingPlanReview, RunPhase::Blocked)
            | (RunPhase::AwaitingPlanReview, RunPhase::Failed)
            | (RunPhase::ExecutionReady, RunPhase::Executing)
            | (RunPhase::ExecutionReady, RunPhase::Blocked)
            | (RunPhase::ExecutionReady, RunPhase::Failed)
            | (RunPhase::Executing, RunPhase::ReviewPending)
            | (RunPhase::Executing, RunPhase::Blocked)
            | (RunPhase::Executing, RunPhase::Failed)
            | (RunPhase::ReviewPending, RunPhase::CommitReady)
            | (RunPhase::ReviewPending, RunPhase::Executing)
            | (RunPhase::ReviewPending, RunPhase::Blocked)
            | (RunPhase::ReviewPending, RunPhase::Failed)
            | (RunPhase::CommitReady, RunPhase::Committed)
            | (RunPhase::CommitReady, RunPhase::Executing)
            | (RunPhase::CommitReady, RunPhase::Blocked)
            | (RunPhase::CommitReady, RunPhase::Failed)
            | (RunPhase::Blocked, RunPhase::Planning)
            | (RunPhase::Blocked, RunPhase::ExecutionReady)
            | (RunPhase::Blocked, RunPhase::Failed)
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Pending,
    Running,
    RetryReady,
    Completed,
    Failed,
}

#[derive(Debug, Clone)]
pub struct Task<'a> {
    pub task_id: &'a str,
    pub status: TaskStatus,
    pub priority: i64,
    pub dependencies: Vec<&'a str>,
    pub created_order: usize,
}

pub fn retry_delay_ms(attempt_count: u32, base_delay_ms: u64, max_delay_ms: u64) -> u64 {
    let exponent = attempt_count.saturating_sub(1).min(20);
    let delay = base_delay_ms.saturating_mul(2_u64.saturating_pow(exponent));
    delay.min(max_delay_ms)
}

pub fn ready_task_ids(tasks: &[Task<'_>]) -> Vec<String> {
    let mut ready = tasks
        .iter()
        .filter(|task| matches!(task.status, TaskStatus::Pending | TaskStatus::RetryReady))
        .filter(|task| {
            task.dependencies.iter().all(|dependency| {
                tasks
                    .iter()
                    .any(|candidate| candidate.task_id == *dependency && candidate.status == TaskStatus::Completed)
            })
        })
        .collect::<Vec<_>>();

    ready.sort_by(|left, right| {
        right
            .priority
            .cmp(&left.priority)
            .then_with(|| left.created_order.cmp(&right.created_order))
            .then_with(|| left.task_id.cmp(right.task_id))
    });

    ready
        .into_iter()
        .map(|task| task.task_id.to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finite_state_machine_allows_only_reviewed_paths_to_commit() {
        assert!(can_transition(RunPhase::Initialized, RunPhase::Planning));
        assert!(can_transition(RunPhase::CommitReady, RunPhase::Committed));
        assert!(!can_transition(RunPhase::Initialized, RunPhase::Committed));
        assert!(!can_transition(RunPhase::Failed, RunPhase::Executing));
    }

    #[test]
    fn retry_delay_is_exponential_and_capped() {
        assert_eq!(retry_delay_ms(1, 1_000, 60_000), 1_000);
        assert_eq!(retry_delay_ms(3, 1_000, 60_000), 4_000);
        assert_eq!(retry_delay_ms(10, 10_000, 60_000), 60_000);
    }

    #[test]
    fn dag_ready_queue_waits_for_dependencies_then_uses_priority() {
        let tasks = vec![
            Task {
                task_id: "a",
                status: TaskStatus::Pending,
                priority: 1,
                dependencies: vec![],
                created_order: 0,
            },
            Task {
                task_id: "b",
                status: TaskStatus::Pending,
                priority: 10,
                dependencies: vec!["a"],
                created_order: 1,
            },
            Task {
                task_id: "c",
                status: TaskStatus::Pending,
                priority: 2,
                dependencies: vec![],
                created_order: 2,
            },
        ];

        assert_eq!(ready_task_ids(&tasks), vec!["c".to_string(), "a".to_string()]);

        let completed_a = vec![
            Task { status: TaskStatus::Completed, ..tasks[0].clone() },
            tasks[1].clone(),
            tasks[2].clone(),
        ];

        assert_eq!(
            ready_task_ids(&completed_a),
            vec!["b".to_string(), "c".to_string()]
        );
    }
}
