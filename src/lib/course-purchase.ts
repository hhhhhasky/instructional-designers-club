import type { CourseAccessCode } from '@/lib/course-entitlements';

export interface CoursePurchaseProduct {
  code: CourseAccessCode;
  name: string;
  description: string;
  cataloguePath: string;
  purchaseUrl: string;
}

export const COURSE_PURCHASE_PRODUCTS: readonly CoursePurchaseProduct[] = [
  {
    code: 'teaching-general-v1',
    name: '教学通识课',
    description: '从学习科学出发，系统学习教学设计与课堂实践。',
    cataloguePath: '/courses',
    purchaseUrl: 'https://xhslink.com/m/5JAHDTqPSdk',
  },
  {
    code: 'teacher-ai',
    name: '教师 AI 课',
    description: '理解 AI 工具，把教学判断延伸为可复用的工作流。',
    cataloguePath: '/teacher-ai-courses',
    purchaseUrl: 'https://xhslink.com/m/4neOp7EhPHm',
  },
  {
    code: 'daofa-textbook',
    name: '道法教材解读课',
    description: '贯通课标、教材单元与单课，建立一至九年级教材地图。',
    cataloguePath: '/courses/daofa',
    purchaseUrl: 'https://xhslink.com/m/277IB24mn8I',
  },
];

export function getCoursePurchaseProduct(code: CourseAccessCode | null | undefined): CoursePurchaseProduct | undefined {
  return COURSE_PURCHASE_PRODUCTS.find((product) => product.code === code);
}
