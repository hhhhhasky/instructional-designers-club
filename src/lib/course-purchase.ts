import { COURSE_SLUGS, courseCatalogPath } from './course-paths';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import { GONGDING_2027_CODE, GONGDING_2027_NAME } from '@/lib/gongding-2027';

export const TEACHING_GENERAL_2025_NAME = '教学通识课 2025 版';

export interface CoursePurchaseProduct {
  code: CourseAccessCode;
  name: string;
  description: string;
  cataloguePath: string;
  purchaseUrl: string;
  wechatQrImage: string;
}

export const TEACHING_GENERAL_2025_CATALOG = {
  code: 'teaching-general-v1',
  name: TEACHING_GENERAL_2025_NAME,
  cataloguePath: courseCatalogPath(COURSE_SLUGS.teachingGeneral),
} as const;

export const GONGDING_2027_PURCHASE_PRODUCT = {
  code: GONGDING_2027_CODE,
  name: GONGDING_2027_NAME,
  description: '《教学通识课》的升级版。购买本课后，可先学习旧版《教学通识课》。',
  cataloguePath: courseCatalogPath(COURSE_SLUGS.gongding),
  purchaseUrl: 'https://xhslink.com/m/5JAHDTqPSdk',
  wechatQrImage: '/images/course-purchase/general-wechat.png',
} as const satisfies CoursePurchaseProduct;

export const COURSE_PURCHASE_PRODUCTS = [
  GONGDING_2027_PURCHASE_PRODUCT,
  {
    code: 'teacher-ai',
    name: '教师 AI 课',
    description: '理解 AI 工具，把教学判断延伸为可复用的工作流。',
    cataloguePath: courseCatalogPath(COURSE_SLUGS.teacherAi),
    purchaseUrl: 'https://xhslink.com/m/4neOp7EhPHm',
    wechatQrImage: '/images/course-purchase/general-wechat.png',
  },
  {
    code: 'daofa-textbook',
    name: '道法教材解读课',
    description: '贯通课标、教材单元与单课，建立一至九年级教材地图。',
    cataloguePath: courseCatalogPath(COURSE_SLUGS.daofa),
    purchaseUrl: 'https://xhslink.com/m/277IB24mn8I',
    wechatQrImage: '/images/course-purchase/daofa-wechat.png',
  },
] as const satisfies readonly CoursePurchaseProduct[];

export function getCoursePurchaseProduct(code: CourseAccessCode | null | undefined): CoursePurchaseProduct | undefined {
  return COURSE_PURCHASE_PRODUCTS.find((product) => product.code === code);
}
