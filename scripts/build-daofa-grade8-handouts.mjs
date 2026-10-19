import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const root = process.argv[2] || '/Users/apple/Library/Mobile Documents/iCloud~md~obsidian/Documents/哈老师の知识库/业务文档/教学设计师俱乐部文档/教师培训课程/道法教材解读课';
const out = 'output/daofa-handouts-20261019';
await fs.mkdir(out, { recursive: true });
const books = [
  { id: 'grade-8-up', dir: '15_八年级上册', file: '八年级上册_教材解读_视频口播逐字稿_总分详略版_20261018.md', prefix: '八上', units: [4, 10, 16, 22], lessons: [7, 8, 9, 13, 14, 15, 19, 20, 21, 25, 26, 27] },
  { id: 'grade-8-down', dir: '16_八年级下册', file: '八年级下册《道德与法治》新教材解读｜视频逐字稿.md', prefix: '八下', units: [4, 9, 14, 19, 28], lessons: [7, 8, 12, 13, 17, 18, 22, 23, 24, 25, 26, 27, 31, 32] },
];
const manifest = [];
for (const book of books) {
  const source = path.join(root, '03_18册教材解读', book.dir, '04_讲义与脚本', book.file);
  let text = await fs.readFile(source, 'utf8');
  text = text.split('\n## 编稿依据与备课核对索引（不口播）')[0].replace(/\n---\s*$/, '').trim();
  text = text.replace(/^# .+$/m, `# 八年级${book.prefix === '八上' ? '上' : '下'}册《道德与法治》教材解读`)
    .replace('各位老师，大家好，我是哈老师。\n\n', '')
    .replace('原稿把它归纳为三个方面', '可以把它归纳为三个方面')
    .replace('今天这个视频，我的工作就是帮你翻译。', '这份讲义会帮助你理解这些概念。')
    .replace('我希望大家听完以后', '我希望大家读完以后')
    .replace('我们下期再见。', '')
    .replaceAll('人民当家做主', '人民当家作主')
    .replaceAll('框体', '框题')
    .replace('怎样我们怎样对待他呢？', '我们应该怎样对待它呢？')
    .replace('国家根本不用他', '国家根本不用它')
    .replace('有尊严的活着', '有尊严地活着')
    .replace('讲清求', '讲清楚')
    .replace('（干活麻溜的，服务态度好一些，有人民公仆的态度。', '，也就是办事高效、服务态度好，体现人民公仆的责任。')
    .replace('依法执政有哪些具体的表现和特征呢？', '依法行政、建设法治政府有哪些具体的表现和特征呢？')
    // Remove the sentence contradicted by the following paragraph and the lesson's own conclusion.
    .replace('国家机构和国家机关不是一个概念，国家机构包括国家机关。中华人民共和国主席属于国家机构的一种，不是国家机关。\n\n', '');
  const imageDir = path.join(root, '07_成品与版本/PPT图片_压缩版_20261019/03_18册教材解读', book.dir, '05_课件与图表/PPT图片');
  const images = new Map();
  const entries = [];
  const slide = async (number, label) => {
    const name = `${book.prefix}_PPT_${String(number).padStart(2, '0')}.jpg`;
    const bytes = await fs.readFile(path.join(imageDir, name));
    images.set(name, `data:image/jpeg;base64,${bytes.toString('base64')}`);
    entries.push({ number, name, label });
    return `\n\n![${label}](${name})\n\n`;
  };
  let unit = 0, lesson = 0;
  const chunks = [];
  for (const line of text.split('\n')) {
    chunks.push(line);
    if (line.startsWith('## ') && /第[一二三四五]单元/.test(line)) {
      chunks.push(await slide(book.units[unit++], line.slice(3)));
    } else if (line.startsWith('### ') && (book.id.endsWith('down') || line.includes('第一框'))) {
      chunks.push(await slide(book.lessons[lesson++], line.slice(4)));
    } else if (book.id.endsWith('up') && line === '先看全册结构。') {
      chunks.push(await slide(2, '八年级上册的教材定位与主要内容'));
    } else if (book.id.endsWith('up') && line === '接下来，按照教材顺序，逐课逐框拆开讲。') {
      chunks.push(await slide(3, '四个单元怎样共同组成教材'));
    } else if (book.id.endsWith('down') && line === '今天我们来聊聊新版八年级下册《道德与法治》教材。') {
      chunks.push(await slide(2, '八年级下册的教材定位与主要内容'));
    } else if (book.id.endsWith('down') && line.startsWith('## 一、先看整册')) {
      chunks.push(await slide(3, '五个单元怎样共同组成教材'));
    } else if (book.id.endsWith('up') && line === '最后是核心要义——“十个坚持”。') {
      chunks.push(await slide(28, '总体国家安全观的安全领域与核心要义'));
    }
  }
  if (unit !== book.units.length || lesson !== book.lessons.length) throw Error(`图片匹配失败 ${book.id}: ${unit}/${lesson}`);
  const markdown = chunks.join('\n').trim() + '\n';
  if (/编稿依据|原稿|原笔记|不口播|\/Users\/|<!--/.test(markdown)) throw Error('学员内容含内部说明');
  let headingIndex = 0;
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    urlTransform: (url) => images.get(decodeURIComponent(url)) || url,
    components: {
      h2: ({ children }) => React.createElement('h2', { id: `section-${++headingIndex}` }, children),
      img: ({ src, alt }) => React.createElement('figure', null,
        React.createElement('button', { type: 'button', 'aria-label': `放大课件：${alt}`, 'aria-pressed': 'false' }, React.createElement('img', { src, alt, decoding: 'async', width: 1600, height: 900 })),
        React.createElement('figcaption', null, alt, ' · 点击放大，再次点击收起')),
    },
  }, markdown));
  const title = `八年级${book.prefix === '八上' ? '上' : '下'}册图文讲义`;
  const doc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>
*{box-sizing:border-box}html{background:#fffdf8;color:#273b37}body{margin:0;padding:28px 32px 48px;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.95;overflow-wrap:anywhere}article{max-width:900px;margin:auto}h1,h2,h3{font-family:"Songti SC","STSong",serif;line-height:1.5;color:#24554e}h1{font-size:28px;margin:0 0 32px}h2{font-size:24px;border-top:1px solid #d9e1d6;padding-top:32px;margin:48px 0 24px}h3{font-size:20px;margin:36px 0 20px}p{margin:14px 0}strong{font-weight:650;color:#153e35}hr{border:0;border-top:1px dashed #d9e1d6;margin:36px 0}figure{margin:24px 0 32px}figure button{display:block;width:100%;padding:0;background:none;border:1px solid #d9e1d6;border-radius:6px;cursor:zoom-in;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{font-size:12px;color:#758179;text-align:center;line-height:1.6;padding:8px}figure.zoomed button{max-height:650px;overflow:auto;cursor:zoom-out}figure.zoomed img{width:1600px;max-width:none}button:focus-visible{outline:3px solid #bca16a;outline-offset:3px}ul,ol{padding-left:1.5em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9e1d6;padding:8px}@media(max-width:600px){body{padding:22px 18px 36px;font-size:16px}h1{font-size:24px}h2{font-size:22px}h3{font-size:19px}figure{margin-left:-8px;margin-right:-8px}}
</style></head><body><article>${html}</article><script>
let scheduled=false;function report(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;parent.postMessage({type:'daofa-handout-height',height:Math.ceil(document.body.getBoundingClientRect().height)},'*')})}new ResizeObserver(report).observe(document.body);window.addEventListener('load',report);document.querySelectorAll('figure button').forEach(button=>button.addEventListener('click',()=>{const expanded=button.parentElement.classList.toggle('zoomed');button.setAttribute('aria-pressed',String(expanded));report()}));report();
</script></body></html>`;
  await fs.writeFile(path.join(out, `${book.id}.md`), markdown);
  await fs.writeFile(path.join(out, `${book.id}.html`), doc);
  manifest.push({ lessonId: `${book.id}-handout`, storageKey: `daofa-textbook/handouts/20261019/${book.id}.html`, source, chars: markdown.length, bytes: Buffer.byteLength(doc), images: entries });
}
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(manifest.map(({ lessonId, chars, bytes, images }) => ({ lessonId, chars, bytes, images: images.length })));
