import type { MembershipType } from "@/types/types";

export type PointUserLevelFilter = "all" | MembershipType;

export interface PointUserFilterItem {
  nickname: string;
  phone: string;
  access_level: MembershipType;
}

export function filterPointUsers<T extends PointUserFilterItem>(
  users: T[],
  search: string,
  level: PointUserLevelFilter,
) {
  const keyword = search.trim().toLocaleLowerCase("zh-CN");
  const phoneKeyword = keyword.replace(/\D/gu, "");

  return users.filter((user) => {
    if (level !== "all" && user.access_level !== level) return false;
    if (!keyword) return true;

    const normalizedPhone = user.phone.replace(/\D/gu, "");
    return user.nickname.toLocaleLowerCase("zh-CN").includes(keyword)
      || user.phone.toLocaleLowerCase("zh-CN").includes(keyword)
      || (phoneKeyword.length > 0 && normalizedPhone.includes(phoneKeyword));
  });
}
