import { Archive, ArchiveRestore, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  archiveHaiWorkTask,
  deleteHaiWorkTask,
  renameHaiWorkTask,
  unarchiveHaiWorkTask,
  type HaiWorkTask,
} from "@/db/hai-api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TaskActionMenuProps = {
  task: HaiWorkTask;
  onArchived?: () => void;
  onUnarchived?: () => void;
  onRenamed?: (title: string) => void;
  onDeleted?: () => void;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
};

/** 任务级操作菜单:归档 / 重命名 / 删除。网页端与手机端共用。 */
export default function TaskActionMenu({
  task,
  onArchived,
  onUnarchived,
  onRenamed,
  onDeleted,
  disabled,
  align = "end",
  triggerClassName,
}: TaskActionMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [busy, setBusy] = useState(false);

  // 每次打开重命名框都重置为最新任务名,避免上一次未保存的草稿串场。
  useEffect(() => {
    if (renameOpen) setTitle(task.title);
  }, [renameOpen, task.title]);

  async function handleArchive() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await archiveHaiWorkTask(task.id);
      toast.success("任务已归档。");
      onArchived?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归档失败,请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchive() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await unarchiveHaiWorkTask(task.id);
      toast.success("任务已恢复。");
      onUnarchived?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败,请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    const trimmed = title.trim();
    if (!trimmed || disabled || busy) return;
    setBusy(true);
    try {
      await renameHaiWorkTask(task.id, trimmed);
      toast.success("任务名已更新。");
      onRenamed?.(trimmed);
      setRenameOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名失败,请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await deleteHaiWorkTask(task.id);
      toast.success("任务已删除。");
      setDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败,请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={disabled}
            aria-label="任务操作"
            className={cn("shrink-0", triggerClassName)}
            // 阻止冒泡到外层 <Link>,避免点菜单时误跳转进任务详情。
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          {task.status === "archived" ? (
            <DropdownMenuItem onClick={() => void handleUnarchive()} disabled={busy}>
              <ArchiveRestore className="h-4 w-4" />恢复
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => void handleArchive()} disabled={busy}>
              <Archive className="h-4 w-4" />归档
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setRenameOpen(true)} disabled={busy}>
            <Pencil className="h-4 w-4" />重命名
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            className="text-red-600 focus:text-red-700"
          >
            <Trash2 className="h-4 w-4" />删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={(open) => { if (!busy) setRenameOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名任务</DialogTitle>
            <DialogDescription>修改任务名称,不影响已有版本与产物。</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRename();
              }
            }}
            className="h-11 w-full rounded-ds-md border border-bd bg-[var(--paper)] px-3 text-sm text-tx outline-none focus:border-ac focus:ring-2 focus:ring-ac/10"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={busy}>取消</Button>
            <Button onClick={() => void handleRename()} disabled={busy || !title.trim()}>
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!busy) setDeleteOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除任务</DialogTitle>
            <DialogDescription>
              将永久删除「{task.title}」及其所有版本,无法恢复。若只是暂时不用,建议改用归档。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>取消</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              {busy ? "删除中…" : "永久删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
