import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit2, Archive, Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
import MarkdownEditor from "@/components/admin/MarkdownEditor";
import { PLUS_TRACKS, getPlusModule, getPlusTrack } from "@/lib/plusCourseStructure";
import type { Course, MembershipType, PlusCourseTrackId } from "@/types/types";

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
  audio_url: null,
  body: null,
  essence: null,
  images: [],
  plus_track_id: null,
  plus_module_id: null,
  plus_module_order: null,
  plus_lesson_order: null,
  plus_representative: false,
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
      audio_url: course.audio_url,
      body: course.body,
      essence: course.essence,
      images: course.images ?? [],
      plus_track_id: course.plus_track_id,
      plus_module_id: course.plus_module_id,
      plus_module_order: course.plus_module_order,
      plus_lesson_order: course.plus_lesson_order,
      plus_representative: course.plus_representative ?? false,
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
      const payload: CourseForm = form.membership_type === "plus"
        ? form
        : {
            ...form,
            plus_track_id: null,
            plus_module_id: null,
            plus_module_order: null,
            plus_lesson_order: null,
            plus_representative: false,
          };
      if (editingCourse) {
        const updatedCourse = await adminUpdateCourse(editingCourse.id, payload);
        setCourses((prev) =>
          prev.map((course) => (course.id === updatedCourse.id ? updatedCourse : course))
        );
        toast.success("课程更新成功");
      } else {
        const createdCourse = await adminCreateCourse(payload);
        setCourses((prev) => [createdCourse, ...prev]);
        toast.success("课程创建成功");
      }
      setDialogOpen(false);
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
      setCourses((prev) =>
        prev.map((item) => (item.id === course.id ? { ...item, status: "archived" } : item))
      );
      toast.success("课程已归档");
    } catch {
      toast.error("归档失败");
    }
  };

  // Form field updater
  const updateForm = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleMembershipChange = (value: MembershipType) => {
    setForm((prev) => ({
      ...prev,
      membership_type: value,
      ...(value === "plus"
        ? {}
        : {
            plus_track_id: null,
            plus_module_id: null,
            plus_module_order: null,
            plus_lesson_order: null,
            plus_representative: false,
          }),
    }));
  };

  const handlePlusTrackChange = (trackId: PlusCourseTrackId | "") => {
    const nextTrackId = trackId || null;
    const firstModule = nextTrackId ? getPlusTrack(nextTrackId)?.modules[0] : null;
    setForm((prev) => ({
      ...prev,
      plus_track_id: nextTrackId,
      plus_module_id: firstModule?.id ?? null,
      plus_module_order: firstModule?.order ?? null,
    }));
  };

  const handlePlusModuleChange = (moduleId: string) => {
    const module = form.plus_track_id ? getPlusModule(form.plus_track_id, moduleId) : undefined;
    setForm((prev) => ({
      ...prev,
      plus_module_id: moduleId || null,
      plus_module_order: module?.order ?? prev.plus_module_order,
    }));
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
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  Plus结构
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
                  <td className="px-4 py-3 text-txs">
                    <PlusStructureLabel course={course} />
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
                        type="button"
                        onClick={() => window.open(`/courses/${course.id}`, '_blank')}
                        className="p-1.5 rounded-ds-md hover:bg-warm transition-colors text-txs hover:text-tl"
                        title="预览"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(course)}
                        className="p-1.5 rounded-ds-md hover:bg-warm transition-colors text-txs hover:text-ac"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
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
                    colSpan={9}
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
                    onChange={(e) => handleMembershipChange(e.target.value as MembershipType)}
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

            {/* Plus 结构：仅 Plus 课程显示，Free/Pro 不写入这些字段 */}
            {form.membership_type === "plus" && (
              <div className="space-y-3 border border-ac/20 bg-acl/20 rounded-ds-lg p-4">
                <div>
                  <h4 className="text-ds-sm font-ds-semibold text-tx">Plus课程结构</h4>
                  <p className="text-ds-xs text-txs mt-1">
                    只影响教学通识课 Plus 的课程地图与篇章详情页，不改变 Pro / Free 课程展示。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">篇章</label>
                    <select
                      value={form.plus_track_id || ""}
                      onChange={(e) => handlePlusTrackChange(e.target.value as PlusCourseTrackId | "")}
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    >
                      <option value="">按旧分类自动归属</option>
                      {PLUS_TRACKS.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">模块</label>
                    <select
                      value={form.plus_module_id || ""}
                      onChange={(e) => handlePlusModuleChange(e.target.value)}
                      disabled={!form.plus_track_id}
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx disabled:bg-warm disabled:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    >
                      <option value="">按旧分类自动归属</option>
                      {(form.plus_track_id ? getPlusTrack(form.plus_track_id)?.modules ?? [] : []).map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">模块排序</label>
                    <input
                      type="number"
                      value={form.plus_module_order ?? ""}
                      onChange={(e) => updateForm("plus_module_order", e.target.value === "" ? null : parseInt(e.target.value))}
                      min={0}
                      placeholder="默认按模块配置排序"
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">模块内单课排序</label>
                    <input
                      type="number"
                      value={form.plus_lesson_order ?? ""}
                      onChange={(e) => updateForm("plus_lesson_order", e.target.value === "" ? null : parseInt(e.target.value))}
                      min={0}
                      placeholder="默认使用课程排序号"
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(form.plus_representative)}
                      onChange={(e) => updateForm("plus_representative", e.target.checked)}
                      className="w-4 h-4 rounded border-bd text-ac focus:ring-ac"
                    />
                    <span className="text-ds-sm text-tx">作为 Plus 首页代表课程候选</span>
                  </div>
                </div>
              </div>
            )}

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
                  <label className="block text-ds-xs text-txs mb-1">音频 URL</label>
                  <input
                    type="text"
                    value={form.audio_url || ""}
                    onChange={(e) => updateForm("audio_url", e.target.value || null)}
                    placeholder="音频文件链接（R2 上传后填入，如 mp3/m4a）"
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

            {/* 正文（长文） */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">正文（长文）</h4>
              <MarkdownEditor
                value={form.body || ""}
                onChange={(v) => updateForm("body", v || null)}
              />
            </div>

            {/* 图片集 */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">图片集</h4>
              <p className="text-ds-xs text-txs -mt-1">添加图片 URL（R2 上传后填入），可添加多张。</p>
              <div className="space-y-2">
                {(form.images ?? []).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const next = [...(form.images ?? [])];
                        next[idx] = e.target.value;
                        updateForm("images", next);
                      }}
                      placeholder={`图片 ${idx + 1} URL`}
                      className="flex-1 h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.images ?? []).filter((_, i) => i !== idx);
                        updateForm("images", next);
                      }}
                      className="px-2.5 py-1.5 text-ds-xs text-am hover:text-ac border border-bd rounded-ds-md hover:bg-bgs transition-colors flex-shrink-0"
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateForm("images", [...(form.images ?? []), ""])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-ds-xs text-ac border border-ac/30 rounded-ds-md hover:bg-acl transition-colors"
                >
                  + 添加一张图片
                </button>
              </div>
            </div>

            {/* 课程精华（选填） */}
            <div className="space-y-3">
              <h4 className="text-ds-sm font-ds-semibold text-tx">课程精华（选填）</h4>
              <p className="text-ds-xs text-txs -mt-1">
                思维导图等看课参考材料，留空则详情页不显示该板块。可插入图片说明。
              </p>
              <MarkdownEditor
                value={form.essence || ""}
                onChange={(v) => updateForm("essence", v || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
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

function PlusStructureLabel({ course }: { course: Course }) {
  if (course.membership_type !== "plus") {
    return <span className="text-txt">—</span>;
  }

  const track = course.plus_track_id ? getPlusTrack(course.plus_track_id) : null;
  const module = course.plus_track_id && course.plus_module_id
    ? getPlusModule(course.plus_track_id, course.plus_module_id)
    : null;

  if (!track && !module) {
    return <span className="text-txt">自动归属</span>;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-tx">{track?.title || "自动篇章"}</p>
      <p className="text-ds-xs text-txs">{module?.title || "自动模块"}</p>
    </div>
  );
}
