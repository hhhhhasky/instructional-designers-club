import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import CourseAccessBadge from './CourseAccessBadge';
import CoursePurchaseButton from './CoursePurchaseButton';

export default function CourseAccessNotice({ productCode }: { productCode: CourseAccessCode }) {
  const { profile, courseAccessCodes, loading } = useAuth();
  if (loading) return null;
  const isAdmin = profile?.role === 'admin';
  const hasAccess = isAdmin || canAccessCourse(courseAccessCodes, productCode);
  return <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex flex-wrap items-center gap-3">
      <CourseAccessBadge hasAccess={hasAccess} isAdmin={isAdmin} />
      <p className="text-sm text-txs">{hasAccess ? '可直接从下方目录开始学习。' : '可浏览课程目录，开通后学习完整内容。'}</p>
    </div>
    {!hasAccess && <CoursePurchaseButton productCode={productCode} />}
  </div>;
}
