import { supabase } from '@/db/supabase';

export async function getDaofaLessonMedia(lessonId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('daofa-course-content', {
    body: { lessonId },
  });
  if (error || typeof data?.url !== 'string') {
    throw new Error('课程媒体暂时无法加载，请稍后重试');
  }
  return data.url;
}
