import type { Course } from "@/types/types";
import { getCourseAccessCode } from "./course-entitlements";

export const COURSE_PATH = "/course";
export const LEARNING_MAP_PATH = "/learning/map";

export const COURSE_SLUGS = {
  teachingGeneral: "teaching-general-2025",
  teacherAi: "teacher-ai",
  daofa: "daofa",
  gongding: "gaoding-gongkaike-2027",
  free: "free",
  v2: "teaching-general-v2",
} as const;

export type CourseRouteEntry = Pick<Course, "id" | "membership_type" | "access_product_code"> & {
  route_slug: string;
};

export function courseCatalogPath(slug: string) {
  return `${COURSE_PATH}/${slug}`;
}

export function courseSlug(course: Pick<Course, "membership_type" | "access_product_code">) {
  switch (getCourseAccessCode(course)) {
    case "teaching-general-v1":
    case "teaching-general-legacy":
      return COURSE_SLUGS.teachingGeneral;
    case "teacher-ai":
      return COURSE_SLUGS.teacherAi;
    case "daofa-textbook":
      return COURSE_SLUGS.daofa;
    case "gongding-gongkaike":
      return COURSE_SLUGS.gongding;
    case "teaching-general-v2":
      return COURSE_SLUGS.v2;
    default:
      return COURSE_SLUGS.free;
  }
}

export function courseLessonPath(slug: string, lessonSlug: string) {
  return `${courseCatalogPath(slug)}/${encodeURIComponent(lessonSlug)}`;
}

export function legacyCourseLessonPath(id: string) {
  return `/courses/${encodeURIComponent(id)}`;
}

export function v2LessonPath(lesson: { id: string; route_slug?: string }) {
  return lesson.route_slug
    ? courseLessonPath(COURSE_SLUGS.v2, lesson.route_slug)
    : `/course-v2/lesson/${encodeURIComponent(lesson.id)}`;
}
