import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** 二次确认需手动输入的"魔词"，输入一致才允许确认。不传则不启用。 */
  confirmWord?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
}

/**
 * 通用二次确认弹窗。
 * 支持「输入魔词」级别的强确认，用于不可逆的永久删除（防误删）。
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "确认操作？",
  description = "此操作不可撤销，请确认。",
  confirmWord,
  confirmText = "确认",
  cancelText = "取消",
  variant = "danger",
  onConfirm,
}: ConfirmDialogProps) {
  // 用 key 强制在每次打开不同确认场景时重置内部输入态
  return (
    <ConfirmDialogInner
      key={`${title}-${confirmWord ?? ""}`}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmWord={confirmWord}
      confirmText={confirmText}
      cancelText={cancelText}
      variant={variant}
      onConfirm={onConfirm}
    />
  );
}

function ConfirmDialogInner({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  confirmText,
  cancelText,
  variant,
  onConfirm,
}: ConfirmDialogProps) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const wordOk = !confirmWord || word.trim() === confirmWord;

  const handleConfirm = async () => {
    if (!wordOk) return;
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
      setWord("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setWord("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {variant === "danger" && (
              <AlertTriangle className="w-5 h-5 text-error-tx" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {confirmWord && (
          <div className="space-y-1.5">
            <p className="text-ds-sm text-tx">
              请输入{" "}
              <code className="px-1.5 py-0.5 rounded bg-warm text-ac font-ds-semibold">
                {confirmWord}
              </code>{" "}
              以确认
            </p>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoFocus
              placeholder={`输入 ${confirmWord}`}
              className="w-full h-11 px-4 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || !wordOk}
            className={
              variant === "danger"
                ? "bg-error-bg text-error-tx hover:opacity-90"
                : ""
            }
          >
            {busy ? "处理中..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
