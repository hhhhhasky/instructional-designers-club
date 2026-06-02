import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit2, Archive, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getAdminCourseList,
  adminCreateCourse,
  adminUpdateCourse,
  adminArchiveCourse,
} from "@/db/admin-api";
import { getCourseCategories } from "@/db/api";
import type { Course, MembershipType } from "@/types/types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "archived", label: "已归档" },
];

const LEVEL_OPTIONS = ["入门", "初级", "中级", "高级"] as const;
const MEMBERSHIP_OPTIONS: { value: MembershipType; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const EMPTY_FORM: Omit<Course, "id" | "view_count" | "created_at" | "updated_at"> = {
  title: "",
  description: null,
  instructor: null,
  category_id: null,
  category: null,
  level: "入门",
  semester: null,
  duration: 60,
  credits: "0",
  status: "draft",
  membership_type: "plus",
  is_trial: false,
  image_url: null,
  video_url: null,
  meeting_url: null,
  sort_order: 0,
};

type CourseForm = typeof EMPTY_FORM;

export default function CourseManagementSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);

  // Category list for dropdown
  const [categories, setCategories] = useState<string[]>([]);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAdminCourseList();
      setCourses(result);
    } catch {
      setError("加载课程数据失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    getCourseCategories().then((cats) => {
      setCategories(cats.filter((c) => c !== "全部"));
    });
  }, []);

  // Client-side filter
  const filtered = useMemo(() => {
    let result = courses;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.instructor || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    return result;
  }, [courses, search, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page on filter change
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  // Open dialog for new course
  const handleAdd = () => {
    setEditingCourse(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description,
      instructor: course.instructor,
      category_id: course.category_id,
      category: course.category,
      level: course.level as CourseForm["level"],
      semester: course.semester,
      duration: course.duration,
      credits: course.credits,
      status: course.status,
      membership_type: course.membership_type,
      is_trial: course.is_trial,
      image_url: course.image_url,
      video_url: course.video_url,
      meeting_url: course.meeting_url,
      sort_order: course.sort_order,
    });
    setDialogOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("课程名称不能为空");
      return;
    }
    try {
      setSaving(true);
      if (editingCourse) {
        await adminUpdateCourse(editingCourse.id, form);
        toast.success("课程更新成功");
      } else {
        await adminCreateCourse(form);
        toast.success("课程创建成功");
      }
      setDialogOpen(false);
      await loadCourses();
    } catch {
      toast.error(editingCourse ? "更新课程失败" : "创建课程失败");
    } finally {
      setSaving(false);
    }
  };

  // Archive
  const handleArchive = async (course: Course) => {
    if (course.status === "archived") {
      toast.info("课程已处于归档状态");
      return;
    }
    try {
      await adminArchiveCourse(course.id);
      toast.success("课程已归档");
      await loadCourses();
    } catch {
      toast.error("归档失败");
    }
  };

  // Form field updater
  const updateForm = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Handle category select: set both category text and category_id
  const handleCategorySelect = (catName: string) => {
    setForm((prev) => ({ ...prev, category: catName }));
  };

  if (loading) return <LoadingOverlay message="正在加载课程数据..." />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-txs mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-ac hover:underline"
        >
          刷新页面
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt" />
            <input
              type="text"
              placeholder="搜索课程名、讲师、分类..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md w-64 focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
            />
          </div>

          {/* 状态筛选 */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-ds-sm text-txs">
            共 {filtered.length} 门课程
          </span>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            添加课程
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-bd bg-warm">
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  课程名称
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  讲师
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  分类
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  等级
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  类型
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  状态
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  排序
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-bdl hover:bg-bgs/50 transition-colors"
                >
                  <td className="px-4 py-3 font-ds-medium text-tx max-w-[200px] truncate">
                    {course.title}
                  </td>
                  <td className="px-4 py-3 text-txs">
                    {course.instructor || "—"}
                  </td>
                  <td className="px-4 py-3 text-txs">
                    {course.category || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-txs">
                    {course.level}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MembershipBadge type={course.membership_type} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-txs">
                    {course.sort_order ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(course)}
                        className="p-1.5 rounded-ds-md hover:bg-warm transition-colors text-txs hover:text-ac"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(course)}
                        className="p-1.5 rounded-ds-md hover:bg-warm transition-colors text-txs hover:text-am"
                        title="归档"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-txs"
                  >
                    没有匹配的课程
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-ds-sm text-txs px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? "编辑课程" : "添加课程"}
            </DialogTitle>
            <DialogDescription>
              {editingCourse ? "修改课程信息" : "填写课程信息以创建新课程"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">基本信息</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-ds-xs text-txs mb-1">课程名称 *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    placeholder="请输入课程名称"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-ds-xs text-txs mb-1">课程描述</label>
                  <textarea
                    value={form.description || ""}
                    onChange={(e) => updateForm("description", e.target.value || null)}
                    placeholder="请输入课程描述（选填）"
                    rows={3}
                    className="w-full px-4 py-2 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">讲师</label>
                  <input
                    type="text"
                    value={form.instructor || ""}
                    onChange={(e) => updateForm("instructor", e.target.value || null)}
                    placeholder="讲师姓名（选填）"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">分类</label>
                  <select
                    value={form.category || ""}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  >
                    <option value="">无分类</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">难度等级</label>
                  <select
                    value={form.level}
                    onChange={(e) => updateForm("level", e.target.value as CourseForm["level"])}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  >
                    {LEVEL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">学期</label>
                  <input
                    type="text"
                    value={form.semester || ""}
                    onChange={(e) => updateForm("semester", e.target.value || null)}
                    placeholder="如 2025春（选填）"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 课程设置 */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">课程设置</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-ds-xs text-txs mb-1">时长（分钟）</label>
                  <input
                    type="number"
                    value={form.duration || ""}
                    onChange={(e) => updateForm("duration", parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">学分</label>
                  <input
                    type="number"
                    value={form.credits || ""}
                    onChange={(e) => updateForm("credits", e.target.value)}
                    step="0.1"
                    min={0}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">会员类型</label>
                  <select
                    value={form.membership_type}
                    onChange={(e) => updateForm("membership_type", e.target.value as MembershipType)}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  >
                    {MEMBERSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">发布状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value as CourseForm["status"])}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  >
                    {STATUS_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">排序号</label>
                  <input
                    type="number"
                    value={form.sort_order || ""}
                    onChange={(e) => updateForm("sort_order", parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_trial}
                      onChange={(e) => updateForm("is_trial", e.target.checked)}
                      className="w-4 h-4 rounded border-bd text-ac focus:ring-ac"
                    />
                    <span className="text-ds-sm text-tx">允许试看</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 链接信息 */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">链接信息</h4>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-ds-xs text-txs mb-1">封面图 URL</label>
                  <input
                    type="text"
                    value={form.image_url || ""}
                    onChange={(e) => updateForm("image_url", e.target.value || null)}
                    placeholder="封面图片链接（选填）"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">视频 URL</label>
                  <input
                    type="text"
                    value={form.video_url || ""}
                    onChange={(e) => updateForm("video_url", e.target.value || null)}
                    placeholder="视频文件链接（R2 上传后填入）"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-ds-xs text-txs mb-1">会议链接</label>
                  <input
                    type="text"
                    value={form.meeting_url || ""}
                    onChange={(e) => updateForm("meeting_url", e.target.value || null)}
                    placeholder="腾讯会议等链接（选填）"
                    className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : editingCourse ? "保存修改" : "创建课程"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 会员类型 Badge
function MembershipBadge({ type }: { type: MembershipType }) {
  const styles: Record<MembershipType, string> = {
    free: "bg-mint-soft text-tl",
    plus: "bg-yellow-soft text-am",
    pro: "bg-blue-soft text-pp",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold",
        styles[type]
      )}
    >
      {type.toUpperCase()}
    </span>
  );
}

// 状态 Badge
function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    draft: "bg-warm text-txs",
    published: "bg-mint-soft text-tl",
    archived: "bg-error-bg text-error-tx",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold",
        styleMap[status] || "bg-warm text-txs"
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
