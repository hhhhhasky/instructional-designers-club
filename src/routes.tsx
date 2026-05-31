import HomePage from './pages/HomePage';
import NewMemberPage from './pages/NewMemberPage';
import ResourcesPage from './pages/ResourcesPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import LearningPage from './pages/LearningPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
    visible: true
  },
  {
    name: '课程中心',
    path: '/courses',
    element: <CoursesPage />,
    visible: true
  },
  {
    name: '课程详情',
    path: '/courses/:id',
    element: <CourseDetailPage />,
    visible: false
  },
  {
    name: '新会员必读',
    path: '/new-member',
    element: <NewMemberPage />,
    visible: true
  },
  {
    name: '资源中心',
    path: '/resources',
    element: <ResourcesPage />,
    visible: true
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    visible: false
  },
  {
    name: '注册',
    path: '/register',
    element: <RegisterPage />,
    visible: false
  },
  {
    name: '账号设置',
    path: '/settings',
    element: <SettingsPage />,
    visible: false
  },
  {
    name: '学习主页',
    path: '/learning',
    element: <LearningPage />,
    visible: false
  }
];

export default routes;
