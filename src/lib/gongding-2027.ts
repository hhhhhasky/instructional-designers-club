import type { Course } from "@/types/types";

export const GONGDING_2027_CODE = "gongding-gongkaike";
export const GONGDING_2027_NAME = "搞定公开课 2027 版";
export const GONGDING_2027_STATUS = "正在研发中，预计 2027 年初全面上线";
export const GONGDING_2027_LESSON_PLACEHOLDER = "哈老师正在加班加点研发中，请大家敬请期待";

export function isGongdingLessonPreview(course: Course | null): boolean {
  return Boolean(
    course &&
      course.access_product_code === GONGDING_2027_CODE &&
      course.status === "published" &&
      course.description === GONGDING_2027_LESSON_PLACEHOLDER &&
      !course.has_video &&
      !course.has_audio &&
      !course.has_body &&
      !course.has_images &&
      !course.has_essence &&
      !course.has_meeting,
  );
}
