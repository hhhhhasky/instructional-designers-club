import type { LucideIcon } from 'lucide-react';
import { CheckCircle, Circle, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { canAccessCourse } from '@/lib/access-control';
import type { LearningMapData, NodeExploration } from '@/lib/learningMap';
import type { MembershipType, SeriesCourseItem } from '@/types/types';
import type { MapNodeConfig } from './learningMapConfig';
import { getMapNodeById } from './learningMapConfig';

interface Props {
  nodeId: string | null;
  onChangeNodeId: (id: string | null) => void;
  data: LearningMapData;
  accessLevel: MembershipType;
}

const STATUS_CONFIG: Record<
  SeriesCourseItem['status'],
  { Icon: LucideIcon; color: string }
> = {
  completed: { Icon: CheckCircle, color: 'text-tl' },
  in_progress: { Icon: PlayCircle, color: 'text-ac' },
  not_started: { Icon: Circle, color: 'text-txt' },
};

/** 景点下钻面板：从右侧滑出，保留左侧地图上下文。 */
export default function SpotDetailSheet({
  nodeId,
  onChangeNodeId,
  data,
  accessLevel,
}: Props) {
  const navigate = useNavigate();
  const node = nodeId ? getMapNodeById(nodeId) : undefined;
  const expl = nodeId ? data.nodes[nodeId] : undefined;

  const openCourse = (courseId: string) => {
    onChangeNodeId(null);
    navigate(`/courses/${courseId}`);
  };

  return (
    <Sheet
      open={!!nodeId}
      onOpenChange={(o) => {
        if (!o) onChangeNodeId(null);
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-md p-0 flex flex-col bg-card"
      >
        {node && expl && (
          <DetailBody
            node={node}
            expl={expl}
            accessLevel={accessLevel}
            onOpenCourse={openCourse}
            onChangeNodeId={onChangeNodeId}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DetailBodyProps {
  node: MapNodeConfig;
  expl: NodeExploration;
  accessLevel: MembershipType;
  onOpenCourse: (courseId: string) => void;
  onChangeNodeId: (id: string | null) => void;
}

function DetailBody({
  node,
  expl,
  accessLevel,
  onOpenCourse,
  onChangeNodeId,
}: DetailBodyProps) {
  const Icon = node.icon;
  const isPlanned = !!node.isPlanned;
  const next = expl.nextCourse;

  return (
    <>
      <SheetHeader className="p-5 border-b border-bdl flex-row items-start gap-3 space-y-0 text-left">
        <span className="w-12 h-12 rounded-ds-full bg-acl flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-ac" />
        </span>
        <div className="flex-1 min-w-0">
          <SheetTitle className="text-ds-lg font-ds-black text-tx">{node.name}</SheetTitle>
          <p className="text-ds-sm text-txs mt-1">{node.desc}</p>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* 规划中说明 */}
        {isPlanned && node.longDesc && (
          <div className="bg-aml border border-am/20 rounded-ds-md p-3">
            <p className="text-ds-sm font-ds-bold text-am mb-1.5">📋 该要素的课程正在规划中</p>
            <p className="text-ds-sm text-txs whitespace-pre-line leading-relaxed">
              {node.longDesc}
            </p>
          </div>
        )}

        {/* 探索度 */}
        {!isPlanned && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-ds-sm text-txs">探索度</span>
              <span className="text-ds-sm font-ds-bold text-tx">
                {expl.completedCourses}/{expl.totalCourses} 完成 · {expl.completionPercentage}%
              </span>
            </div>
            <Progress value={expl.completionPercentage} className="h-2" />
          </div>
        )}

        {/* 推荐下一课 */}
        {!isPlanned && next && (
          <button
            type="button"
            onClick={() => onOpenCourse(next.course.courseId)}
            className="group w-full text-left bg-acl rounded-ds-lg border border-ac/20 p-4 hover-lift transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-am" />
              <span className="text-ds-sm font-ds-bold text-tx">推荐下一课</span>
            </div>
            <p className="text-ds-xs text-txs mb-0.5">{next.seriesName}</p>
            <p className="text-ds-sm font-ds-medium text-tx line-clamp-2">{next.course.title}</p>
            <div className="mt-2 text-ds-sm font-ds-bold text-ac group-hover:underline">
              开始学习 →
            </div>
          </button>
        )}
        {!isPlanned && !next && expl.totalCourses > 0 && (
          <div className="text-center py-3 bg-tll rounded-ds-md">
            <p className="text-ds-sm text-tl font-ds-bold">🎉 该要素你已通览</p>
          </div>
        )}

        {/* 系列课列表（按 category 分组） */}
        {!isPlanned && expl.seriesGroups.length > 0 && (
          <div className="space-y-4">
            {expl.seriesGroups.map((group) => (
              <div key={group.categoryName}>
                <h4 className="text-ds-sm font-ds-bold text-tx mb-2 flex items-center gap-2">
                  <span className="w-1 h-3 rounded-full bg-ac" />
                  {group.categoryName}
                  <span className="text-ds-xs text-txs font-ds-regular">
                    · {group.courses.length} 节
                  </span>
                </h4>
                <div className="space-y-0.5">
                  {group.courses.map((c, idx) => (
                    <CourseRow
                      key={c.courseId}
                      course={c}
                      idx={idx}
                      accessLevel={accessLevel}
                      onOpenCourse={onOpenCourse}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 相关理论 / 工具 */}
        <RelatedSection node={node} onChangeNodeId={onChangeNodeId} />
      </div>
    </>
  );
}

interface CourseRowProps {
  course: SeriesCourseItem;
  idx: number;
  accessLevel: MembershipType;
  onOpenCourse: (courseId: string) => void;
}

function CourseRow({ course, idx, accessLevel, onOpenCourse }: CourseRowProps) {
  const cfg = STATUS_CONFIG[course.status];
  const StatusIcon = cfg.Icon;
  const hasAccess = canAccessCourse(accessLevel, course.membershipType);
  return (
    <button
      type="button"
      onClick={() => hasAccess && onOpenCourse(course.courseId)}
      disabled={!hasAccess}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-ds-md hover:bg-bgs disabled:hover:bg-transparent text-left transition-colors"
    >
      <span className="text-ds-xs text-txt w-5 text-right shrink-0">{idx + 1}</span>
      <StatusIcon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
      <span className={`flex-1 text-ds-sm truncate ${hasAccess ? 'text-tx' : 'text-txs'}`}>
        {course.title}
      </span>
      {!hasAccess && <Lock className="w-3 h-3 text-txs shrink-0" />}
      {course.credits > 0 && (
        <span className="text-ds-xs text-am shrink-0">{course.credits}学分</span>
      )}
    </button>
  );
}

function RelatedSection({
  node,
  onChangeNodeId,
}: {
  node: MapNodeConfig;
  onChangeNodeId: (id: string | null) => void;
}) {
  const foundations = (node.relatedFoundations ?? [])
    .map((id) => getMapNodeById(id))
    .filter(Boolean) as MapNodeConfig[];
  const toolkits = (node.relatedToolkits ?? [])
    .map((id) => getMapNodeById(id))
    .filter(Boolean) as MapNodeConfig[];
  if (foundations.length === 0 && toolkits.length === 0) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-bdl">
      {foundations.length > 0 && (
        <ChipGroup label="相关理论" nodes={foundations} onChangeNodeId={onChangeNodeId} />
      )}
      {toolkits.length > 0 && (
        <ChipGroup label="相关工具" nodes={toolkits} onChangeNodeId={onChangeNodeId} />
      )}
    </div>
  );
}

function ChipGroup({
  label,
  nodes,
  onChangeNodeId,
}: {
  label: string;
  nodes: MapNodeConfig[];
  onChangeNodeId: (id: string | null) => void;
}) {
  return (
    <div>
      <h4 className="text-ds-sm font-ds-bold text-tx mb-2 flex items-center gap-2">
        <span className="w-1 h-3 rounded-full bg-pp" />
        {label}
      </h4>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onChangeNodeId(n.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-ds-pill bg-bgs border border-bd text-ds-sm text-tx hover:bg-acl hover:border-ac/20 transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-ac" />
              {n.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
