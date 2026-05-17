import VisitorStats from "./VisitorStats";

const Footer = () => {
  return (
    <footer className="bg-bc border-t-2 border-bd">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* 访问统计 */}
        <div className="border-b border-bdl">
          <VisitorStats />
        </div>

        {/* 版权信息和备案号 */}
        <div className="py-8 text-center">
          <p className="text-ds-xs text-txs flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-ds-semibold" style={{ fontFamily: 'var(--fd)' }}>教学设计师俱乐部</span>
            <span className="hidden sm:inline text-txt">·</span>
            <span>青岛相信成长教育咨询有限公司 版权所有</span>
            <span className="hidden sm:inline text-txt">·</span>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ac transition-colors duration-200"
              title="点击查询ICP备案信息"
            >
              鲁ICP备2026000928号
            </a>
            <span className="hidden sm:inline text-txt">·</span>
            <a
              href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=37021202001808"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ac transition-colors duration-200 flex items-center gap-1"
              title="点击查询公安备案信息"
            >
              <span>鲁公网安备37021202001808号</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
