import VisitorStats from "./VisitorStats";

const Footer = () => {
  return (
    <footer className="bg-bgs">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 flex flex-col items-center gap-4">
        <VisitorStats />
        <p className="text-xs text-txt flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
          <span className="font-semibold" style={{ fontFamily: 'var(--fd)' }}>教学设计师俱乐部</span>
          <span>·</span>
          <span>青岛相信成长教育咨询有限公司</span>
          <span>·</span>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ac transition-colors"
          >
            鲁ICP备2026000928号
          </a>
          <span>·</span>
          <a
            href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=37021202001808"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ac transition-colors"
          >
            鲁公网安备37021202001808号
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
