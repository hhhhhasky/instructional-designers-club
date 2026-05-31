// 课程数据
export interface Course {
  id: string;
  title: string; // 课程名称
  category: string; // 学习营名称/分类
  link: string; // 课程链接
  image: string; // 课程配图
  level: '初级' | '中级' | '高级'; // 难度级别
  description?: string; // 课程描述
}

export const courses: Course[] = [
  // 建构主义系列
  {
    id: 'constructivism-knowledge',
    title: '知识是被发现的，还是被发明的？',
    category: '建构主义',
    link: 'https://meeting.tencent.com/crm/lRoWvwPD77',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpcpwakkqo.png',
    level: '中级',
    description: '探讨建构主义的知识观'
  },
  {
    id: 'constructivism-learning',
    title: '人是如何学习的？',
    category: '建构主义',
    link: 'https://meeting.tencent.com/crm/KePA55pPef',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpcpwakkqo.png',
    level: '中级',
    description: '建构主义的学习观'
  },
  {
    id: 'constructivism-teaching',
    title: '讲授还是探究？',
    category: '建构主义',
    link: 'https://meeting.tencent.com/crm/KePV87vPc6',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpcpwakkqo.png',
    level: '中级',
    description: '建构主义的教学观'
  },
  {
    id: 'constructivism-design',
    title: '建构主义的教学设计',
    category: '建构主义',
    link: 'https://meeting.tencent.com/crm/2ZGOPWPd42',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpcpwakkqo.png',
    level: '高级',
    description: '如何基于建构主义进行教学设计'
  },

  // 真实任务设计系列
  {
    id: 'authentic-task-why',
    title: 'AI时代为什么需要任务导向的教学？',
    category: '真实任务设计',
    link: 'https://meeting.tencent.com/crm/29do0Gqbe0',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpiuvr6pz4.png',
    level: '初级',
    description: '探讨AI时代任务导向教学的重要性'
  },
  {
    id: 'authentic-task-deep',
    title: '深入理解任务',
    category: '真实任务设计',
    link: 'https://meeting.tencent.com/crm/2p9G70QD23',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpiuvr6pz4.png',
    level: '中级',
    description: '深入理解什么是真实任务'
  },
  {
    id: 'authentic-task-kmr',
    title: 'KMR设计法真实任务设计',
    category: '真实任务设计',
    link: 'https://meeting.tencent.com/crm/Ngkjb6ZXce',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpiuvr6pz4.png',
    level: '高级',
    description: '学习KMR设计法进行真实任务设计'
  },
  {
    id: 'authentic-task-script',
    title: '任务脚本',
    category: '真实任务设计',
    link: 'https://meeting.tencent.com/crm/l71JoooE7e',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpiuvr6pz4.png',
    level: '高级',
    description: '如何编写任务脚本'
  },

  // 教学目标系列
  {
    id: 'learning-objectives-intro',
    title: '初识布卢姆教育目标分类学框架',
    category: '教学目标',
    link: 'https://meeting.tencent.com/crm/NoWn7Lor4f',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfph3qrkyrk.png',
    level: '初级',
    description: '认识布卢姆教育目标分类学'
  },
  {
    id: 'learning-objectives-knowledge',
    title: '深入布卢姆的知识分类',
    category: '教学目标',
    link: 'https://meeting.tencent.com/crm/2a3pJXV91a',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfph3qrkyrk.png',
    level: '中级',
    description: '深入理解布卢姆的知识维度'
  },
  {
    id: 'learning-objectives-cognitive',
    title: '深入布卢姆的认知分类',
    category: '教学目标',
    link: 'https://meeting.tencent.com/crm/KPvQEEWBad',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfph3qrkyrk.png',
    level: '中级',
    description: '深入理解布卢姆的认知过程维度'
  },
  {
    id: 'learning-objectives-solo',
    title: '初识马扎诺+SOLO分类理论',
    category: '教学目标',
    link: 'https://meeting.tencent.com/crm/Nbo0XG9D4f',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfph3qrkyrk.png',
    level: '中级',
    description: '认识马扎诺和SOLO分类理论'
  },
  {
    id: 'learning-objectives-design',
    title: '分析12个优质课教案的教学目标设计',
    category: '教学目标',
    link: 'https://meeting.tencent.com/crm/KeQdq3mZ90',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfph3qrkyrk.png',
    level: '高级',
    description: '通过案例分析学习教学目标设计'
  },

  // 学习科学系列
  {
    id: 'learning-science-intro',
    title: '学习科学导论',
    category: '学习科学入门',
    link: 'https://meeting.tencent.com/crm/N8pYvM114e',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_f345ed5f-cfeb-4016-a7fb-2435788eda1f.jpg',
    level: '初级',
    description: '学习科学的基本概念和框架'
  },
  {
    id: 'learning-science-basic',
    title: '初识学习科学',
    category: '学习科学入门',
    link: 'https://meeting.tencent.com/crm/2ZBL79jdc9',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_9e058625-a91a-44a6-af25-e2f78d2aac1f.jpg',
    level: '初级',
    description: '学习科学的入门课程'
  },
  {
    id: 'teaching-science-basic',
    title: '初识教学科学',
    category: '学习科学入门',
    link: 'https://meeting.tencent.com/crm/K07PqmRgb9',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_1250d718-a749-4be2-96d8-41ee99d835b3.jpg',
    level: '初级',
    description: '教学科学的基础知识'
  },
  {
    id: 'evaluation-science-basic',
    title: '初识评估科学',
    category: '学习科学入门',
    link: 'https://meeting.tencent.com/crm/2rE0J6y514',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_62f0cfbf-552f-45d6-835f-7fb151f699b6.jpg',
    level: '初级',
    description: '评估科学的基本原理'
  },

  // 认知负荷理论系列
  {
    id: 'cognitive-load-intro',
    title: '初识认知负荷理论',
    category: '认知负荷理论',
    link: 'https://meeting.tencent.com/crm/2pqV3Jng03',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_c561ceb7-d8f2-487f-888c-79c633a17241.jpg',
    level: '初级',
    description: '认知负荷理论的基本概念'
  },
  {
    id: 'cognitive-load-principle',
    title: '认知负荷理论基本原理',
    category: '认知负荷理论',
    link: 'https://meeting.tencent.com/crm/2qva4AnA90',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_65b3a78e-e383-45c6-9e61-956b747e139f.jpg',
    level: '中级',
    description: '深入理解认知负荷理论的基本原理'
  },
  {
    id: 'cognitive-load-strategy-internal',
    title: '优化内部认知负荷的教学策略',
    category: '认知负荷理论',
    link: 'https://meeting.tencent.com/crm/Kn5p5je9fa',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_19aae71a-4332-4b25-a5b1-034edb0a695d.jpg',
    level: '高级',
    description: '学习如何优化内部认知负荷'
  },
  {
    id: 'cognitive-load-strategy-external-knowledge',
    title: '降低外部认知负荷的教学策略：优化知识呈现',
    category: '认知负荷理论',
    link: 'https://meeting.tencent.com/crm/2qvo7n3519',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_d798d7d3-9f07-4d58-83a4-814f48f59c19.jpg',
    level: '高级',
    description: '通过优化知识呈现降低外部认知负荷'
  },
  {
    id: 'cognitive-load-strategy-external-task',
    title: '降低外部认知负荷的教学策略：安排任务',
    category: '认知负荷理论',
    link: 'https://meeting.tencent.com/crm/KeZJrkZW05',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_f872c8f2-2fe8-4e41-8230-5f75786ac584.jpg',
    level: '高级',
    description: '通过合理安排任务降低外部认知负荷'
  },

  // 罗森海因教学原理系列
  {
    id: 'rosenshine-intro',
    title: '初识罗森海因教学原理',
    category: '罗森海因教学原理',
    link: 'https://meeting.tencent.com/crm/2j7J6Or9c9',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_48792344-740c-4d3f-baf6-fe967ded5faf.jpg',
    level: '初级',
    description: '认识罗森海因的教学原理'
  },
  {
    id: 'rosenshine-01',
    title: '罗森海因教学原理01',
    category: '罗森海因教学原理',
    link: 'https://meeting.tencent.com/crm/KnVJRJ4we2',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_4c31f285-26c7-4a95-b311-ebd3827cc92a.jpg',
    level: '中级',
    description: '罗森海因教学原理详解（一）'
  },
  {
    id: 'rosenshine-02',
    title: '罗森海因教学原理02',
    category: '罗森海因教学原理',
    link: 'https://meeting.tencent.com/crm/NxQJR3Ro93',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_53deb0a2-4b2c-4297-874a-1a2352d15c83.jpg',
    level: '中级',
    description: '罗森海因教学原理详解（二）'
  },
  {
    id: 'rosenshine-03',
    title: '罗森海因教学原理03',
    category: '罗森海因教学原理',
    link: 'https://meeting.tencent.com/crm/l5Lqv4yDc5',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_203266ee-8306-4a05-8d4f-6a4bb0da5e87.jpg',
    level: '中级',
    description: '罗森海因教学原理详解（三）'
  },
  {
    id: 'rosenshine-04',
    title: '罗森海因教学原理04',
    category: '罗森海因教学原理',
    link: 'https://meeting.tencent.com/crm/NX4Bm8p7a7',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_2abc767a-e161-4a98-a33d-87fd136e5f98.jpg',
    level: '高级',
    description: '罗森海因教学原理详解（四）'
  },

  // 新会员必看系列
  {
    id: 'new-member-guide',
    title: '如何使用俱乐部进行学习？',
    category: '新会员必看',
    link: 'https://meeting.tencent.com/crm/KPzWZZLZ52',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_7c222017-8a21-42ce-8e16-b2b66adfaa19.jpg',
    level: '初级',
    description: '新会员入门指南'
  },
  {
    id: 'instructional-design-difference',
    title: '教学设计和备课有什么区别？',
    category: '新会员必看',
    link: 'https://meeting.tencent.com/crm/KwPoZX4qdf',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_f6ef4671-2683-4912-8e78-b47fa3933eb1.jpg',
    level: '初级',
    description: '理解教学设计与备课的区别'
  },
  {
    id: 'create-model-intro',
    title: '初识CREATE教学设计模型',
    category: '新会员必看',
    link: 'https://meeting.tencent.com/crm/KzXXmJQXd2',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_4b4ca18a-da61-4608-bdd7-c5b51fec4117.jpg',
    level: '初级',
    description: '认识CREATE教学设计模型'
  },
  {
    id: 'teaching-illusion-share',
    title: '《教学幻象》新书分享',
    category: '选修课',
    link: 'https://meeting.tencent.com/crm/2ZGnPJJp21',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_791b2c8b-78a8-4947-9a0d-3714917b7664.jpg',
    level: '中级',
    description: '《教学幻象》新书分享会'
  },
  {
    id: 'instructional-design-deconstruct',
    title: '拆解"得到"的教学设计',
    category: '选修课',
    link: 'https://meeting.tencent.com/crm/lvYgVLJP07',
    image: 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_cde31ad6-c9dc-4cc0-8566-c0ea732edfe9.jpg',
    level: '高级',
    description: '分析"得到"平台的教学设计方法'
  },

  // 讲授法系列
  {
    id: 'lecture-method-intro',
    title: '重新认识讲授法',
    category: '讲授法',
    link: 'https://meeting.tencent.com/crm/2V8mvVXP6a',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpewtj2rr4.png',
    level: '初级',
    description: '重新理解讲授法的价值和应用'
  },
  {
    id: 'lecture-method-design',
    title: '如何设计一段纯粹讲授？',
    category: '讲授法',
    link: 'https://meeting.tencent.com/crm/2j7rajez3c',
    image: 'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/conv-7iwdhpt0pyps/20251220/file-8cfpewtj2rr4.png',
    level: '中级',
    description: '学习如何设计高效的纯粹讲授环节'
  }
];

// 获取所有分类
export const getCategories = (): string[] => {
  const categories = ['全部', ...new Set(courses.map(course => course.category))];
  return categories;
};

// 根据分类筛选课程
export const getCoursesByCategory = (category: string): Course[] => {
  if (category === '全部') {
    return courses;
  }
  return courses.filter(course => course.category === category);
};

// 根据ID获取课程
export const getCourseById = (id: string): Course | undefined => {
  return courses.find(course => course.id === id);
};
