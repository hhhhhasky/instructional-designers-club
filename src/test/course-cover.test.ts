import { describe, expect, it } from "vitest";
import { getCourseCoverUrl, withProtectedCourseCover } from "@/lib/course-cover";

describe("course cover URL protection", () => {
  it("routes r2.dev course covers through the public cover signer", () => {
    const result = getCourseCoverUrl(
      "course-123",
      "https://pub-example.r2.dev/course-covers/cover%201.png",
    );

    expect(result).toContain("/functions/v1/course-cover");
    expect(result).toContain("courseId=course-123");
    expect(result).not.toContain("pub-example.r2.dev");
  });

  it("leaves externally hosted public covers unchanged", () => {
    const url = "https://images.unsplash.com/photo-123";
    expect(getCourseCoverUrl("course-123", url)).toBe(url);
  });

  it("does not mutate the original course object", () => {
    const course = {
      id: "course-123",
      image_url: "https://pub-example.r2.dev/course-covers/cover.png",
    };
    const protectedCourse = withProtectedCourseCover(course);

    expect(protectedCourse).not.toBe(course);
    expect(course.image_url).toContain("r2.dev");
    expect(protectedCourse.image_url).toContain("/functions/v1/course-cover");
  });
});
