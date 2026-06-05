/**
 * 构建后脚本：为每个静态路由生成独立的 HTML 文件
 * 原理：读取 dist/index.html，为每个路由创建目录并注入该路由专属的 meta 标签
 * 这样 Netlify 会优先匹配静态文件，爬虫能获取到正确的 meta 标签
 */
import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.VITE_SITE_URL || 'https://idclub.hasky.top';
const SITE_NAME = '教学设计师俱乐部';

const distDir = path.resolve('dist');
const baseHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// 各路由的 SEO meta 数据
const routes = {
  '/': {
    title: SITE_NAME,
    description:
      '一所AI时代的线上创新师范学院。提供系统化教学设计课程、教师AI课、学习营和共学社区，帮助教育者提升教学专业能力。',
    keywords: '教学设计,教师培训,AI教学,课程设计,教学设计师俱乐部',
  },
  '/courses': {
    title: `课程中心 | ${SITE_NAME}`,
    description:
      '探索AI时代的教学设计课程，涵盖教学通识课(Plus)、教师AI课(Pro)和免费课程。系统学习教学设计方法论，提升教学专业能力。',
    keywords: '教学设计课程,教师培训课程,AI教学课程,免费教学课程',
  },
  '/new-member': {
    title: `新会员必读 | ${SITE_NAME}`,
    description:
      '教学设计师俱乐部新会员指南。了解近期活动、新手村教程和专业进阶地图，快速融入共学社区。',
    keywords: '新会员,教学设计入门,新手教程,教学设计师俱乐部',
  },
  '/resources': {
    title: `资源中心 | ${SITE_NAME}`,
    description:
      '精选教学设计文章与翻译作品，涵盖认知负荷理论、建构主义、PBL项目式学习等教学设计前沿话题。',
    keywords: '教学设计文章,教育翻译,教学理论,教学资源',
  },
};

/**
 * 清理 baseHtml 中已有的 SEO 相关标签，避免重复
 * 保留：charset, viewport, favicon, font preconnect/link, script/module
 * 移除：title, description, keywords, og:*, twitter:*, canonical
 */
function cleanBaseMeta(html) {
  return html
    .replace(/<title>.*?<\/title>\n?/, '')
    .replace(/<meta name="description"[^>]*>\n?/g, '')
    .replace(/<meta name="keywords"[^>]*>\n?/g, '')
    .replace(/<meta property="og:[^"]*"[^>]*>\n?/g, '')
    .replace(/<meta name="twitter:[^"]*"[^>]*>\n?/g, '')
    .replace(/<link rel="canonical"[^>]*>\n?/g, '');
}

function buildSeoHead(meta, route) {
  const imageUrl = `${SITE_URL}/og-default.png`;
  const url = `${SITE_URL}${route}`;
  const canonicalUrl = route === '/' ? SITE_URL : url;
  return [
    `<title>${meta.title}</title>`,
    `<meta name="description" content="${meta.description}" />`,
    meta.keywords ? `<meta name="keywords" content="${meta.keywords}" />` : '',
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:title" content="${meta.title}" />`,
    `<meta property="og:description" content="${meta.description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${imageUrl}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${meta.title}" />`,
    `<meta name="twitter:description" content="${meta.description}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');
}

const cleanBase = cleanBaseMeta(baseHtml);

// 1. 更新首页 index.html
console.log('Updating index.html with SEO meta tags...');
const homeSeo = buildSeoHead(routes['/'], '/');
const homeHtml = cleanBase.replace('</head>', `    ${homeSeo}\n  </head>`);
fs.writeFileSync(path.join(distDir, 'index.html'), homeHtml);

// 2. 为每个子路由生成独立 HTML
for (const [route, meta] of Object.entries(routes)) {
  if (route === '/') continue;

  const seo = buildSeoHead(meta, route);
  const html = cleanBase.replace('</head>', `    ${seo}\n  </head>`);

  const dir = path.join(distDir, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`Generated ${route}/index.html`);
}

console.log('SEO HTML generation complete!');
