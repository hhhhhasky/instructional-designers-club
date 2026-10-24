const taskTypePrefix = /^(?:公开课设计|思政公开课设计|思政公开课|教案诊断|教案优化|优化教案|环节优化|教学设计|研发教学方案|教学方案研发|大单元教学|图片生成|图片课件|HAI Work)\s*[｜|]\s*/;

/** Compatibility for saved historical names; retain separators inside the topic. */
export function haiTaskTitle(title: string): string {
  return title.trim().replace(taskTypePrefix, "").trim() || "未命名任务";
}
