import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * 两段式内联确认删除按钮。
 *
 * 第一次点击 → 按钮变红显示「确认删除？」；3 秒后或失焦自动复位。
 * 再次点击（红态）→ 真正执行 onConfirm。
 *
 * 用于表单内的「子项」删除（介绍段落 / 价值观条目 / 创始人标签·信息·数据 / 资源链接等），
 * 避免运营误点一下就丢失内容。与整行「永久删除」的魔词二次确认（ConfirmDialog）形成两级保护。
 */
export default function InlineConfirmButton({
  onConfirm,
  title = "删除",
  size = 16,
  confirmText = "确认删除",
  className = "",
}: {
  onConfirm: () => void;
  title?: string;
  size?: number;
  confirmText?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  // 进入「待确认」状态 3 秒后自动复位，避免按钮长期停留在危险态。
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        onBlur={() => setArmed(false)}
        title="再次点击以确认删除"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-ds-md bg-error-bg text-error-tx text-ds-xs font-ds-semibold hover:opacity-90 ${className}`}
      >
        <Trash2 style={{ width: size, height: size }} />
        {confirmText}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      title={title}
      className={`p-2 rounded-ds-md hover:bg-warm text-txs hover:text-error-tx transition-colors ${className}`}
    >
      <Trash2 style={{ width: size, height: size }} />
    </button>
  );
}
