import { lazy, type ReactNode } from 'react';
import { COURSE_PATH, COURSE_SLUGS, LEARNING_MAP_PATH, courseCatalogPath } from './lib/course-paths';
import RouteRedirect from './components/routing/RouteRedirect';
import { DAOFA_TOOL_ENTRIES } from './lib/daofa-catalog';
import { Navigate, useParams } from 'react-router-dom';

const loadHomePage = () => import('./pages/HomePage');
const loadResourcesPage = () => import('./pages/ResourcesPage');
const loadCourseLibraryPage = () => import('./pages/CourseLibraryPage');
const loadCoursesPage = () => import('./pages/CoursesPage');
const loadGongding2027CatalogPage = () => import('./pages/Gongding2027CatalogPage');
const loadTeacherAiCoursesPage = () => import('./pages/TeacherAiCoursesPage');
const loadCourseLessonRoute = () => import('./pages/CourseLessonRoute');
const loadFreeCourseCatalogPage = () => import('./pages/FreeCourseCatalogPage');
const loadCourseV2CatalogPage = () => import('./pages/CourseV2CatalogPage');
const loadCourseV2LessonPage = () => import('./pages/CourseV2LessonPage');
const loadDaofaCoursePage = () => import('./pages/DaofaCoursePage');
const loadDaofaLessonPage = () => import('./pages/DaofaLessonPage');
const loadActivityDetailPage = () => import('./pages/ActivityDetailPage');
const loadLoginPage = () => import('./pages/LoginPage');
const loadForgotPasswordPage = () => import('./pages/ForgotPasswordPage');
const loadResetPasswordPage = () => import('./pages/ResetPasswordPage');
const loadConfirmEmailPage = () => import('./pages/ConfirmEmailPage');
const loadRegisterPage = () => import('./pages/RegisterPage');
const loadSettingsPage = () => import('./pages/SettingsPage');
const loadLearningPage = () => import('./pages/LearningPage');
const loadLearningMapPage = () => import('./pages/LearningMapPage');
const loadLiveEntryPage = () => import('./pages/LiveEntryPage');
const loadLiveParticipantPage = () => import('./pages/LiveParticipantPage');
const loadLiveAudienceDashboardPage = () => import('./pages/LiveAudienceDashboardPage');
const loadHaiPage = () => import('./pages/HaiPage');
const loadHaiPointsPage = () => import('./pages/HaiPointsPage');
const loadHaiWorkPage = () => import('./pages/HaiWorkPage');
const loadHaiImageGenerationPage = () => import('./pages/HaiImageGenerationPage');
const loadHaiImagePptPage = () => import('./pages/HaiImagePptPage');
const loadHaiWorkTaskPage = () => import('./pages/HaiWorkTaskPage');
const loadAdminPage = () => import('./pages/AdminPage');
const loadAdminManagePage = () => import('./pages/AdminManagePage');

const HomePage = lazy(loadHomePage);
const ResourcesPage = lazy(loadResourcesPage);
const CourseLibraryPage = lazy(loadCourseLibraryPage);
const CoursesPage = lazy(loadCoursesPage);
const Gongding2027CatalogPage = lazy(loadGongding2027CatalogPage);
const TeacherAiCoursesPage = lazy(loadTeacherAiCoursesPage);
const CourseLessonRoute = lazy(loadCourseLessonRoute);
const FreeCourseCatalogPage = lazy(loadFreeCourseCatalogPage);
const CourseV2CatalogPage = lazy(loadCourseV2CatalogPage);
const CourseV2LessonPage = lazy(loadCourseV2LessonPage);
const DaofaCoursePage = lazy(loadDaofaCoursePage);
const DaofaLessonPage = lazy(loadDaofaLessonPage);
const ActivityDetailPage = lazy(loadActivityDetailPage);
const LoginPage = lazy(loadLoginPage);
const ForgotPasswordPage = lazy(loadForgotPasswordPage);
const ResetPasswordPage = lazy(loadResetPasswordPage);
const ConfirmEmailPage = lazy(loadConfirmEmailPage);
const RegisterPage = lazy(loadRegisterPage);
const SettingsPage = lazy(loadSettingsPage);
const LearningPage = lazy(loadLearningPage);
const LearningMapPage = lazy(loadLearningMapPage);
const LiveEntryPage = lazy(loadLiveEntryPage);
const LiveParticipantPage = lazy(loadLiveParticipantPage);
const LiveAudienceDashboardPage = lazy(loadLiveAudienceDashboardPage);
const HaiPage = lazy(loadHaiPage);
const HaiPointsPage = lazy(loadHaiPointsPage);
const HaiWorkPage = lazy(loadHaiWorkPage);
const HaiImageGenerationPage = lazy(loadHaiImageGenerationPage);
const HaiImagePptPage = lazy(loadHaiImagePptPage);
const HaiWorkTaskPage = lazy(loadHaiWorkTaskPage);
const AdminPage = lazy(loadAdminPage);
const AdminManagePage = lazy(loadAdminManagePage);

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  preload?: () => Promise<unknown>;
}

function LegacyPlusTrack() {
  const { trackId } = useParams();
  return <RouteRedirect to={courseCatalogPath(COURSE_SLUGS.teachingGeneral)} hash={trackId} />;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
    visible: true,
    preload: loadHomePage
  },
  {
    name: '课程',
    path: COURSE_PATH,
    element: <CourseLibraryPage />,
    visible: true,
    preload: loadCourseLibraryPage
  },
  {
    name: '教学通识课',
    path: courseCatalogPath(COURSE_SLUGS.teachingGeneral),
    element: <CoursesPage />,
    visible: false,
    preload: loadCoursesPage
  },
  {
    name: '搞定公开课 2027 版',
    path: courseCatalogPath(COURSE_SLUGS.gongding),
    element: <Gongding2027CatalogPage />,
    visible: false,
    preload: loadGongding2027CatalogPage
  },
  {
    name: '道法教材解读课',
    path: courseCatalogPath(COURSE_SLUGS.daofa),
    element: <DaofaCoursePage />,
    visible: false,
    preload: loadDaofaCoursePage
  },
  ...DAOFA_TOOL_ENTRIES.flatMap((tool) => [
    { name: tool.title, path: tool.href, element: <DaofaLessonPage toolId={tool.mediaId} />, preload: loadDaofaLessonPage },
    { name: tool.title, path: `/courses/daofa/${tool.mediaId}`, element: <RouteRedirect to={tool.href} /> },
  ]),
  {
    name: '教师AI课',
    path: courseCatalogPath(COURSE_SLUGS.teacherAi),
    element: <TeacherAiCoursesPage />,
    visible: false,
    preload: loadTeacherAiCoursesPage
  },
  {
    name: 'Plus篇章',
    path: '/courses/plus/:trackId',
    element: <LegacyPlusTrack />,
    visible: false
  },
  {
    name: '免费体验课',
    path: courseCatalogPath(COURSE_SLUGS.free),
    element: <FreeCourseCatalogPage />,
    preload: loadFreeCourseCatalogPage
  },
  ...Object.values(COURSE_SLUGS).filter((slug) => slug !== COURSE_SLUGS.v2).map((slug) => ({
    name: '课程学习',
    path: `${courseCatalogPath(slug)}/:lessonSlug`,
    element: <CourseLessonRoute />,
    preload: loadCourseLessonRoute
  })),
  ...['/courses/:id', '/courses/daofa/:id'].map((path) => ({
    name: '课程学习',
    path,
    element: <CourseLessonRoute />,
    preload: loadCourseLessonRoute
  })),
  {
    name: '教学通识课 V2',
    path: courseCatalogPath(COURSE_SLUGS.v2),
    element: <CourseV2CatalogPage />,
    visible: false,
    preload: loadCourseV2CatalogPage
  },
  {
    name: 'V2 课程详情',
    path: `${courseCatalogPath(COURSE_SLUGS.v2)}/:lessonSlug`,
    element: <CourseV2LessonPage />,
    visible: false,
    preload: loadCourseV2LessonPage
  },
  {
    name: '活动详情',
    path: '/activities/:id',
    element: <ActivityDetailPage />,
    visible: false,
    preload: loadActivityDetailPage
  },
  ...([
    ['/course-library', COURSE_PATH],
    ['/courses', courseCatalogPath(COURSE_SLUGS.teachingGeneral)],
    ['/teacher-ai-courses', courseCatalogPath(COURSE_SLUGS.teacherAi)],
    ['/new-member', courseCatalogPath(COURSE_SLUGS.teacherAi)],
    ['/courses/daofa', courseCatalogPath(COURSE_SLUGS.daofa)],
    ['/courses/gongding-gongkaike', courseCatalogPath(COURSE_SLUGS.gongding)],
    ['/course-v2', courseCatalogPath(COURSE_SLUGS.v2)],
    ['/learning-map', LEARNING_MAP_PATH],
  ]).map(([path, to]) => ({ name: '', path, element: <RouteRedirect to={to} /> })),
  {
    name: 'V2 课程详情',
    path: '/course-v2/lesson/:lessonId',
    element: <CourseV2LessonPage />,
    preload: loadCourseV2LessonPage
  },
  {
    name: '资源中心',
    path: '/resources',
    element: <ResourcesPage />,
    visible: false,
    preload: loadResourcesPage
  },
  {
    name: 'HAI',
    path: '/hai',
    element: <Navigate to="/hai/work" replace />,
    visible: true,
    preload: loadHaiWorkPage
  },
  {
    name: 'HAI Chat',
    path: '/hai/chat',
    element: <HaiPage />,
    visible: false,
    preload: loadHaiPage
  },
  {
    name: 'HAI 积分',
    path: '/hai/points',
    element: <HaiPointsPage />,
    visible: false,
    preload: loadHaiPointsPage
  },
  {
    name: 'HAI Work',
    path: '/hai/work',
    element: <HaiWorkPage />,
    visible: false,
    preload: loadHaiWorkPage
  },
  {
    name: 'HAI 图片生成',
    path: '/hai/work/image-generation',
    element: <Navigate to="/hai/work" replace />,
    visible: false,
    preload: loadHaiImageGenerationPage
  },
  {
    name: 'HAI 图片生成任务',
    path: '/hai/work/image-generation/:taskId',
    element: <HaiImageGenerationPage />,
    visible: false,
    preload: loadHaiImageGenerationPage
  },
  {
    name: 'HAI 教案转图片课件',
    path: '/hai/work/image-generation/ppt',
    element: <Navigate to="/hai/work" state={{ imagePpt: true }} replace />,
    visible: false,
    preload: loadHaiImagePptPage
  },
  {
    name: 'HAI 图片课件任务',
    path: '/hai/work/image-generation/ppt/:deckId',
    element: <HaiImagePptPage />,
    visible: false,
    preload: loadHaiImagePptPage
  },
  {
    name: 'HAI Work 功能',
    path: '/hai/work/:toolSlug',
    element: <Navigate to="/hai/work" replace />,
    visible: false,
    preload: loadHaiWorkPage
  },
  {
    name: 'HAI Work 任务',
    path: '/hai/work/tasks/:taskId',
    element: <HaiWorkTaskPage />,
    visible: false,
    preload: loadHaiWorkTaskPage
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    visible: false,
    preload: loadLoginPage
  },
  {
    name: '忘记密码',
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    visible: false,
    preload: loadForgotPasswordPage
  },
  {
    name: '注册',
    path: '/register',
    element: <RegisterPage />,
    visible: false,
    preload: loadRegisterPage
  },
  {
    name: '重置密码', path: '/reset-password', element: <ResetPasswordPage />, visible: false, preload: loadResetPasswordPage
  },
  {
    name: '邮箱验证', path: '/auth/confirm', element: <ConfirmEmailPage />, visible: false, preload: loadConfirmEmailPage
  },
  {
    name: '账号设置',
    path: '/settings',
    element: <SettingsPage />,
    visible: false,
    preload: loadSettingsPage
  },
  {
    name: '学习主页',
    path: '/learning',
    element: <LearningPage />,
    visible: true,
    preload: loadLearningPage
  },
  {
    name: '学习地图',
    path: LEARNING_MAP_PATH,
    element: <LearningMapPage />,
    visible: false,
    preload: loadLearningMapPage
  },
  {
    name: 'Live 互动',
    path: '/live',
    element: <LiveEntryPage />,
    visible: true,
    preload: loadLiveEntryPage
  },
  {
    name: 'Live 数据展示屏',
    path: '/live/:roomCode/dashboard',
    element: <LiveAudienceDashboardPage />,
    visible: false,
    preload: loadLiveAudienceDashboardPage
  },
  {
    name: 'Live 房间',
    path: '/live/:roomCode',
    element: <LiveParticipantPage />,
    visible: false,
    preload: loadLiveParticipantPage
  },
  {
    name: '数据看板',
    path: '/admin',
    element: <AdminPage />,
    visible: false,
    preload: loadAdminPage
  },
  {
    name: '数据维护',
    path: '/admin/manage',
    element: <AdminManagePage />,
    visible: false,
    preload: loadAdminManagePage
  }
];

export default routes;
