import {
  type CourseRankingItem,
  getAdminCourseRankings,
  getAdminInactiveStudents,
  getAdminMemberOverview,
  getAdminStudentLeaderboard,
  type InactiveStudentsData,
  type LeaderboardStudentItem,
  type MemberOverviewData,
} from "./admin-api";
import { getAdminHaiDashboard, type HaiDashboardData } from "./hai-analytics";
import { supabase } from "./supabase";

export interface MaintenanceSnapshot {
  published_courses: number;
  draft_courses: number;
  active_members: number;
  banned_members: number;
  visible_questions: number;
  pending_resets: number;
  active_content: number;
  open_hai_alerts: number;
}

export interface OperationsDashboardSource {
  members: MemberOverviewData;
  courses: CourseRankingItem[];
  inactive: InactiveStudentsData;
  leaderboard: LeaderboardStudentItem[];
  hai: HaiDashboardData;
  maintenance: MaintenanceSnapshot;
}

export type InsightTone = "critical" | "watch" | "positive" | "info";

export interface OperationsInsight {
  id: string;
  tone: InsightTone;
  title: string;
  evidence: string;
  recommendation: string;
  action_label: string;
  action_tab: string;
}

export interface OperationsMetrics {
  total_members: number;
  paid_members: number;
  paid_ratio: number;
  current_month_growth: number;
  growth_change: number | null;
  activated_members: number;
  activation_rate: number;
  zero_record_members: number;
  learner_touches: number;
  active_learner_touches: number;
  completion_rate: number;
  average_credits: number;
  hai_adoption_rate: number;
  health_score: number;
  insights: OperationsInsight[];
}

export async function getAdminOperationsDashboard(): Promise<OperationsDashboardSource> {
  const [members, courses, inactive, leaderboard, hai, maintenance] = await Promise.all([
    getAdminMemberOverview(),
    getAdminCourseRankings(),
    getAdminInactiveStudents(),
    getAdminStudentLeaderboard(),
    getAdminHaiDashboard(30),
    getAdminMaintenanceSnapshot(),
  ]);

  return { members, courses, inactive, leaderboard, hai, maintenance };
}

export async function getAdminMaintenanceSnapshot(): Promise<MaintenanceSnapshot> {
  const requests = [
    countRows("courses", { column: "status", value: "published" }),
    countRows("courses", { column: "status", value: "draft" }),
    countRows("profiles", { column: "status", value: "active" }),
    countRows("profiles", { column: "status", value: "banned" }),
    countRows("course_questions", { column: "status", value: "visible" }),
    countRows("password_reset_requests", { column: "status", value: "pending" }),
    Promise.all([
      countRows("announcements", { column: "is_active", value: true }),
      countRows("activities", { column: "is_active", value: true }),
      countRows("resources", { column: "is_active", value: true }),
    ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
    countRows("hai_usage_alerts", { column: "status", value: "open" }),
  ];
  const [publishedCourses, draftCourses, activeMembers, bannedMembers, visibleQuestions, pendingResets, activeContent, openHaiAlerts] = await Promise.all(requests);

  return {
    published_courses: publishedCourses,
    draft_courses: draftCourses,
    active_members: activeMembers,
    banned_members: bannedMembers,
    visible_questions: visibleQuestions,
    pending_resets: pendingResets,
    active_content: activeContent,
    open_hai_alerts: openHaiAlerts,
  };
}

async function countRows(table: string, filter: { column: string; value: string | boolean }) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(filter.column, filter.value);
  if (error) throw error;
  return count ?? 0;
}

export function buildOperationsMetrics(source: OperationsDashboardSource): OperationsMetrics {
  const { members, courses, inactive, leaderboard, hai, maintenance } = source;
  const totalMembers = members.total || inactive.total_members || 0;
  const distribution = new Map(members.distribution.map((item) => [item.access_level, item.count]));
  const paidMembers = (distribution.get("plus") ?? 0) + (distribution.get("pro") ?? 0);
  const zeroRecordMembers = inactive.zero_record_students.length;
  const activatedMembers = Math.max(0, totalMembers - zeroRecordMembers);
  const learnerTouches = courses.reduce((sum, course) => sum + course.total_learners, 0);
  const activeLearnerTouches = courses.reduce((sum, course) => sum + course.active_learners, 0);
  const completedTouches = courses.reduce((sum, course) => sum + course.completed_learners, 0);
  const growthLength = members.monthly_growth.length;
  const currentGrowth = members.monthly_growth[growthLength - 1]?.new_members ?? 0;
  const previousGrowth = members.monthly_growth[growthLength - 2]?.new_members ?? 0;
  const activationRate = percent(activatedMembers, totalMembers);
  const completionRate = percent(completedTouches, learnerTouches);
  const paidRatio = percent(paidMembers, totalMembers);
  const haiAdoptionRate = percent(hai.summary.active_users, totalMembers);
  const averageCredits = leaderboard.length > 0
    ? round(leaderboard.reduce((sum, member) => sum + member.total_credits, 0) / leaderboard.length)
    : 0;
  const growthScore = previousGrowth === 0
    ? (currentGrowth > 0 ? 75 : 50)
    : clamp((currentGrowth / previousGrowth) * 60, 0, 100);
  const healthScore = Math.round(
    activationRate * 0.3
    + clamp(completionRate * 1.6, 0, 100) * 0.25
    + hai.summary.success_rate * 0.2
    + clamp(paidRatio * 2, 0, 100) * 0.15
    + growthScore * 0.1,
  );

  const growthChange = previousGrowth > 0
    ? round(((currentGrowth - previousGrowth) / previousGrowth) * 100)
    : null;

  const insights: OperationsInsight[] = [];
  const zeroRatio = percent(zeroRecordMembers, totalMembers);
  if (zeroRatio >= 25) {
    insights.push({
      id: "activation",
      tone: zeroRatio >= 50 ? "critical" : "watch",
      title: "新会员激活是当前最大漏斗",
      evidence: `${zeroRecordMembers} 位会员还没有学习记录，占全部会员 ${formatPercent(zeroRatio)}。`,
      recommendation: "优先设计注册后 7 天的首课引导，并针对零记录会员发起一次定向触达。",
      action_label: "查看沉默学员",
      action_tab: "inactive",
    });
  } else {
    insights.push({
      id: "activation",
      tone: "positive",
      title: "会员首课激活保持健康",
      evidence: `已有 ${formatPercent(activationRate)} 的会员产生过学习记录。`,
      recommendation: "继续观察 30 天未活跃人群，把激活优势转成持续学习习惯。",
      action_label: "查看留存分层",
      action_tab: "inactive",
    });
  }

  const weakestCourse = [...courses]
    .filter((course) => course.total_learners >= 3)
    .sort((a, b) => a.completion_rate - b.completion_rate)[0];
  if (weakestCourse && weakestCourse.completion_rate < 40) {
    insights.push({
      id: "course",
      tone: weakestCourse.completion_rate < 20 ? "critical" : "watch",
      title: "一门课程出现明显完课断点",
      evidence: `《${weakestCourse.title}》完课率为 ${formatPercent(weakestCourse.completion_rate)}，学习人数 ${weakestCourse.total_learners}。`,
      recommendation: "检查课程时长、开场承诺与中段任务密度，必要时拆课或增加阶段反馈。",
      action_label: "进入课程维护",
      action_tab: "courses",
    });
  } else if (courses.length > 0) {
    const strongest = [...courses].sort((a, b) => b.completion_rate - a.completion_rate)[0];
    insights.push({
      id: "course",
      tone: "positive",
      title: "课程完成表现具备可复制样本",
      evidence: `《${strongest.title}》以 ${formatPercent(strongest.completion_rate)} 的完课率领先。`,
      recommendation: "提炼这门课的结构与任务节奏，用作下一批课程的制作模板。",
      action_label: "查看课程排行",
      action_tab: "courses",
    });
  }

  if (hai.summary.open_alerts > 0 || hai.summary.success_rate < 95) {
    insights.push({
      id: "hai",
      tone: hai.summary.open_alerts > 0 || hai.summary.success_rate < 90 ? "critical" : "watch",
      title: "HAI 运行质量需要处理",
      evidence: `成功率 ${formatPercent(hai.summary.success_rate)}，当前有 ${hai.summary.open_alerts} 条未处理告警。`,
      recommendation: "先排查失败调用和额度告警，再判断是否调整模型参数或提示词。",
      action_label: "打开 HAI 看板",
      action_tab: "hai",
    });
  } else {
    insights.push({
      id: "hai",
      tone: "positive",
      title: "HAI 服务运行稳定",
      evidence: `近 30 天成功率 ${formatPercent(hai.summary.success_rate)}，服务 ${hai.summary.active_users} 位会员。`,
      recommendation: "下一步关注使用覆盖率与质检分，而不只是调用次数。",
      action_label: "查看质检详情",
      action_tab: "hai",
    });
  }

  if (maintenance.pending_resets > 0 || maintenance.open_hai_alerts > 0) {
    insights.push({
      id: "service",
      tone: "watch",
      title: "后台仍有待处理事项",
      evidence: `${maintenance.pending_resets} 条密码重置申请，${maintenance.open_hai_alerts} 条 HAI 告警。`,
      recommendation: "把服务性工单当日清零，避免影响会员体验。",
      action_label: "进入服务处理",
      action_tab: maintenance.pending_resets > 0 ? "reset" : "hai",
    });
  }

  return {
    total_members: totalMembers,
    paid_members: paidMembers,
    paid_ratio: paidRatio,
    current_month_growth: currentGrowth,
    growth_change: growthChange,
    activated_members: activatedMembers,
    activation_rate: activationRate,
    zero_record_members: zeroRecordMembers,
    learner_touches: learnerTouches,
    active_learner_touches: activeLearnerTouches,
    completion_rate: completionRate,
    average_credits: averageCredits,
    hai_adoption_rate: haiAdoptionRate,
    health_score: clamp(healthScore, 0, 100),
    insights: insights.slice(0, 4),
  };
}

function percent(value: number, total: number) {
  return total > 0 ? round((value / total) * 100) : 0;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
