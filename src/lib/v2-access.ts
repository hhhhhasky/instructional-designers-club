import type { Profile } from "@/types/types";

type V2AccessProfile = Pick<Profile, "role" | "status" | "access_level"> | null | undefined;

export function canAccessV2(profile: V2AccessProfile): boolean {
  return profile?.role === "admin" && profile.status === "active";
}

export const V2_PREVIEW_ACCESS_MESSAGE = "教学通识课 V2 当前处于管理员内测阶段，仅 active admin 可以访问。";
