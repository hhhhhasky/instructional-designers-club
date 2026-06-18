import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit2, Archive, Eye, Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
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
  adminCreateCourseCategory,
  adminUpdateCourseCategory,
  adminUpdateCourse,
  adminArchiveCourse,
  getAdminCourseCategories,
  type AdminCourseCategory,
} from "@/db/admin-api";
import { getPlusCourseStructure } from "@/db/api";
import MarkdownEditor from "@/components/admin/MarkdownEditor";
import {
  PLUS_TRACKS,
  getEffectivePlusTracks,
  getPlusTrack,
  resolvePlusCoursePlacement,
  type PlusTrackConfig,
} from "@/lib/plusCourseStructure";
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

const LEVEL_LABELS: Record<Course["level"], string> = {
  entry: "入门",
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  入门: "入门",
  初级: "初级",
  中级: "中级",
  高级: "高级",
};

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
  plus_lesson_order: null,
  plus_representative: false,
  meeting_url: null,
  sort_order: 0,
};

type CourseForm = typeof EMPTY_FORM;
type CategoryMode = "existing" | "new";

export default function CourseManagementSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [structureTracks, setStructureTracks] = useState<PlusTrackConfig[]>(PLUS_TRACKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [plusTrackFilter, setPlusTrackFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("existing");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryTrackId, setCategoryTrackId] = useState<string | null>(null);

  // Category list for dropdown
  const [categories, setCategories] = useState<AdminCourseCategory[]>([]);
  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>();
    categories
      .filter((category) => category.is_active)
      .forEach((category) => categorySet.add(category.name));
    courses.forEach((course) => {
      if (course.category) categorySet.add(course.category);
    });
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [categories, courses]);
  const levelOptions = useMemo(() => {
    const levelSet = new Set<Course["level"]>();
    LEVEL_OPTIONS.forEach((level) => levelSet.add(level));
    courses.forEach((course) => levelSet.add(course.level));
    return Array.from(levelSet);
  }, [courses]);
  const plusTracks = useMemo(
    () => getEffectivePlusTracks(courses, structureTracks),
    [courses, structureTracks]
  );
  const categoryByName = useMemo(() => {
    const map = new Map<string, AdminCourseCategory>();
    categories.forEach((category) => {
      map.set(category.name, category);
    });
    return map;
  }, [categories]);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const [result, structureData] = await Promise.all([
        getAdminCourseList(),
        getPlusCourseStructure(),
      ]);
      setCourses(result);
      setStructureTracks(structureData.length > 0 ? structureData : PLUS_TRACKS);
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
    getAdminCourseCategories().then(setCategories).catch(() => {
      toast.error("加载课程分类失败，请刷新重试");
    });
  }, []);

  // Client-side filter
  const filtered = useMemo(() => {
    let result = courses;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) => {
          const placement = resolvePlusCoursePlacement(c, plusTracks);
          const track = placement ? getPlusTrack(placement.resolvedTrackId, plusTracks) : null;
          return [
            c.title,
            c.instructor,
            c.category,
            c.level,
            c.membership_type,
            track?.title,
            placement?.resolvedTrackId,
            placement?.resolvedModuleId,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        }
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter);
    }
    if (levelFilter !== "all") {
      result = result.filter((c) => c.level === levelFilter);
    }
    if (membershipFilter !== "all") {
      result = result.filter((c) => c.membership_type === membershipFilter);
    }
    if (plusTrackFilter !== "all") {
      result = result.filter((c) => {
        const placement = resolvePlusCoursePlacement(c, plusTracks);
        return Boolean(placement && placement.resolvedTrackId === plusTrackFilter);
      });
    }
    return result;
  }, [
    courses,
    search,
    statusFilter,
    categoryFilter,
    levelFilter,
    membershipFilter,
    plusTrackFilter,
    plusTracks,
  ]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    levelFilter !== "all" ||
    membershipFilter !== "all" ||
    plusTrackFilter !== "all";

  // Reset page on filter change
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };
  const handleCategoryChange = (v: string) => {
    setCategoryFilter(v);
    setPage(1);
  };
  const handleLevelChange = (v: string) => {
    setLevelFilter(v);
    setPage(1);
  };
  const handleMembershipChangeFilter = (v: string) => {
    setMembershipFilter(v);
    setPage(1);
  };
  const handlePlusTrackFilterChange = (v: string) => {
    setPlusTrackFilter(v);
    setPage(1);
  };
  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setLevelFilter("all");
    setMembershipFilter("all");
    setPlusTrackFilter("all");
    setPage(1);
  };
  const handlePreviewCurrentStructure = () => {
    const url = plusTrackFilter === "all"
      ? "/courses"
      : `/courses/plus/${plusTrackFilter}`;
    window.open(url, "_blank");
  };

  // Open dialog for new course
  const handleAdd = () => {
    setEditingCourse(null);
    setForm(EMPTY_FORM);
    setCategoryMode("existing");
    setNewCategoryName("");
    setCategoryTrackId(null);
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
      plus_lesson_order: course.plus_lesson_order,
      plus_representative: course.plus_representative ?? false,
      meeting_url: course.meeting_url,
      sort_order: course.sort_order,
    });
    setCategoryMode("existing");
    setNewCategoryName("");
    setCategoryTrackId(course.category ? categoryByName.get(course.category)?.plus_track_id ?? null : null);
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
      const normalizedForm: CourseForm = {
        ...form,
        category: form.category?.trim() || null,
      };
      let payload: CourseForm = normalizedForm.membership_type === "plus"
        ? normalizedForm
        : {
            ...normalizedForm,
            plus_lesson_order: null,
            plus_representative: false,
          };
      if (categoryMode === "new") {
        const categoryName = newCategoryName.trim();
        if (!categoryName) {
          toast.error("新分类名称不能为空");
          return;
        }
        let category: AdminCourseCategory;
        try {
          category = await adminCreateCourseCategory(
            categoryName,
            normalizedForm.membership_type === "plus" ? categoryTrackId : undefined
          );
        } catch {
          toast.error("创建分类失败，请确认当前账号有管理员权限后重试");
          return;
        }
        setCategories((prev) => {
          if (prev.some((item) => item.id === category.id || item.name === category.name)) {
            return prev.map((item) => (item.id === category.id ? category : item));
          }
          return [...prev, category].sort((a, b) => {
            const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
            return orderDiff || a.name.localeCompare(b.name, "zh-Hans-CN");
          });
        });
        payload = {
          ...payload,
          category_id: category.id,
          category: category.name,
        };
      } else if (payload.category) {
        const category = categoryByName.get(payload.category);
        if (
          normalizedForm.membership_type === "plus" &&
          category &&
          category.plus_track_id !== categoryTrackId
        ) {
          const updatedCategory = await adminUpdateCourseCategory(category.id, {
            plus_track_id: categoryTrackId,
          });
          setCategories((prev) =>
            prev.map((item) => (item.id === updatedCategory.id ? updatedCategory : item))
          );
        }
        payload = {
          ...payload,
          category_id: category?.id ?? payload.category_id,
        };
      } else {
        payload = {
          ...payload,
          category_id: null,
          category: null,
        };
      }
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
            plus_lesson_order: null,
            plus_representative: false,
          }),
    }));
    if (value !== "plus") {
      setCategoryTrackId(null);
    }
  };

  // Handle category select: set both category text and category_id
  const handleCategorySelect = (catName: string) => {
    const category = categoryByName.get(catName);
    setForm((prev) => ({
      ...prev,
      category: catName || null,
      category_id: category?.id ?? null,
    }));
    setCategoryTrackId(category?.plus_track_id ?? null);
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
      <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 flex-1 w-full xl:w-auto">
          {/* 搜索框 */}
          <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt" />
            <input
              type="text"
              placeholder="搜索课程、讲师、分类、篇章..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
            />
          </div>

          {/* 分类筛选 */}
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="筛选课程分类"
            className="h-10 px-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            <option value="all">全部分类</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {/* 等级筛选 */}
          <select
            value={levelFilter}
            onChange={(e) => handleLevelChange(e.target.value)}
            aria-label="筛选课程等级"
            className="h-10 px-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            <option value="all">全部等级</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level] ?? level}
              </option>
            ))}
          </select>

          {/* 类型筛选 */}
          <select
            value={membershipFilter}
            onChange={(e) => handleMembershipChangeFilter(e.target.value)}
            aria-label="筛选课程类型"
            className="h-10 px-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            <option value="all">全部类型</option>
            {MEMBERSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="筛选课程状态"
            className="h-10 px-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Plus 篇章筛选 */}
          <select
            value={plusTrackFilter}
            onChange={(e) => handlePlusTrackFilterChange(e.target.value)}
            aria-label="筛选 Plus 篇章"
            className="h-10 px-3 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            <option value="all">全部 Plus 篇章</option>
            {plusTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 self-stretch xl:self-auto">
          <span className="text-ds-sm text-txs">
            共 {filtered.length} 门课程
          </span>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={handleClearFilters}>
              清空筛选
            </Button>
          )}
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            添加课程
          </Button>
          <Button variant="outline" onClick={handlePreviewCurrentStructure}>
            <ExternalLink className="w-4 h-4 mr-1" />
            预览结构
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
                  Plus篇章
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
                    <PlusStructureLabel course={course} tracks={plusTracks} />
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
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setCategoryMode("existing")}
                      className={cn(
                        "h-9 rounded-ds-md border text-ds-xs font-ds-medium transition-colors",
                        categoryMode === "existing"
                          ? "border-ac bg-acl text-ac"
                          : "border-bd bg-bg text-txs hover:border-ac/50"
                      )}
                    >
                      选择已有
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryMode("new")}
                      className={cn(
                        "h-9 rounded-ds-md border text-ds-xs font-ds-medium transition-colors",
                        categoryMode === "new"
                          ? "border-ac bg-acl text-ac"
                          : "border-bd bg-bg text-txs hover:border-ac/50"
                      )}
                    >
                      创建新分类
                    </button>
                  </div>
                  {categoryMode === "existing" ? (
                    <select
                      value={form.category || ""}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    >
                      <option value="">无分类</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="输入新分类名称"
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    />
                  )}
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

            {/* Plus 结构：由分类所属篇章决定，课程本身不再维护旧逐课结构字段 */}
            {form.membership_type === "plus" && (
              <div className="space-y-3 border border-ac/20 bg-acl/20 rounded-ds-lg p-4">
                <div>
                  <h4 className="text-ds-sm font-ds-semibold text-tx">Plus篇章归属</h4>
                  <p className="text-ds-xs text-txs mt-1">
                    Plus 结构由课程分类决定：篇章到分类/系列课，再到单课。这里维护当前分类所属篇章。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">分类所属篇章</label>
                    <select
                      value={categoryTrackId ?? ""}
                      onChange={(e) => setCategoryTrackId(e.target.value || null)}
                      aria-label="分类所属篇章"
                      className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                    >
                      <option value="">不进入 Plus 结构</option>
                      {plusTracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-ds-xs text-txs mb-1">系列内单课排序</label>
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

function PlusStructureLabel({ course, tracks }: { course: Course; tracks: PlusTrackConfig[] }) {
  if (course.membership_type !== "plus") {
    return <span className="text-txt">—</span>;
  }

  const placement = resolvePlusCoursePlacement(course, tracks);
  const track = placement ? getPlusTrack(placement.resolvedTrackId, tracks) : null;

  if (!placement || !track) {
    return <span className="text-txt">未进入 Plus 结构</span>;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-tx">{track.title}</p>
      <p className="text-ds-xs text-txs">{course.category || placement.resolvedModuleId}</p>
    </div>
  );
}
