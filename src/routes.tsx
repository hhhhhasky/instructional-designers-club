import { lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

const loadHomePage = () => import('./pages/HomePage');
const loadResourcesPage = () => import('./pages/ResourcesPage');
const loadCoursesPage = () => import('./pages/CoursesPage');
const loadTeacherAiCoursesPage = () => import('./pages/TeacherAiCoursesPage');
const loadPlusTrackPage = () => import('./pages/PlusTrackPage');
const loadCourseDetailPage = () => import('./pages/CourseDetailPage');
const loadActivityDetailPage = () => import('./pages/ActivityDetailPage');
const loadLoginPage = () => import('./pages/LoginPage');
const loadForgotPasswordPage = () => import('./pages/ForgotPasswordPage');
const loadRegisterPage = () => import('./pages/RegisterPage');
const loadSettingsPage = () => import('./pages/SettingsPage');
const loadLearningPage = () => import('./pages/LearningPage');
const loadLearningMapPage = () => import('./pages/LearningMapPage');
const loadHaiPage = () => import('./pages/HaiPage');
const loadHaiWorkPage = () => import('./pages/HaiWorkPage');
const loadHaiWorkTaskPage = () => import('./pages/HaiWorkTaskPage');
const loadAdminPage = () => import('./pages/AdminPage');
const loadAdminManagePage = () => import('./pages/AdminManagePage');

const HomePage = lazy(loadHomePage);
const ResourcesPage = lazy(loadResourcesPage);
const CoursesPage = lazy(loadCoursesPage);
const TeacherAiCoursesPage = lazy(loadTeacherAiCoursesPage);
const PlusTrackPage = lazy(loadPlusTrackPage);
const CourseDetailPage = lazy(loadCourseDetailPage);
const ActivityDetailPage = lazy(loadActivityDetailPage);
const LoginPage = lazy(loadLoginPage);
const ForgotPasswordPage = lazy(loadForgotPasswordPage);
const RegisterPage = lazy(loadRegisterPage);
const SettingsPage = lazy(loadSettingsPage);
const LearningPage = lazy(loadLearningPage);
const LearningMapPage = lazy(loadLearningMapPage);
const HaiPage = lazy(loadHaiPage);
const HaiWorkPage = lazy(loadHaiWorkPage);
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

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
    visible: true,
    preload: loadHomePage
  },
  {
    name: '教学通识课',
    path: '/courses',
    element: <CoursesPage />,
    visible: true,
    preload: loadCoursesPage
  },
  {
    name: '教师AI课',
    path: '/teacher-ai-courses',
    element: <TeacherAiCoursesPage />,
    visible: true,
    preload: loadTeacherAiCoursesPage
  },
  {
    name: 'Plus篇章',
    path: '/courses/plus/:trackId',
    element: <PlusTrackPage />,
    visible: false,
    preload: loadPlusTrackPage
  },
  {
    name: '课程详情',
    path: '/courses/:id',
    element: <CourseDetailPage />,
    visible: false,
    preload: loadCourseDetailPage
  },
  {
    name: '活动详情',
    path: '/activities/:id',
    element: <ActivityDetailPage />,
    visible: false,
    preload: loadActivityDetailPage
  },
  {
    name: '教师AI课跳转',
    path: '/new-member',
    element: <Navigate to="/teacher-ai-courses" replace />,
    visible: false
  },
  {
    name: '资源中心',
    path: '/resources',
    element: <ResourcesPage />,
    visible: true,
    preload: loadResourcesPage
  },
  {
    name: 'HAI',
    path: '/hai',
    element: <Navigate to="/hai/chat" replace />,
    visible: true,
    preload: loadHaiPage
  },
  {
    name: 'HAI Chat',
    path: '/hai/chat',
    element: <HaiPage />,
    visible: false,
    preload: loadHaiPage
  },
  {
    name: 'HAI Work',
    path: '/hai/work',
    element: <HaiWorkPage />,
    visible: false,
    preload: loadHaiWorkPage
  },
  {
    name: 'HAI Work 功能',
    path: '/hai/work/:toolSlug',
    element: <HaiWorkPage />,
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
    visible: false,
    preload: loadLearningPage
  },
  {
    name: '学习地图',
    path: '/learning-map',
    element: <LearningMapPage />,
    visible: false,
    preload: loadLearningMapPage
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
