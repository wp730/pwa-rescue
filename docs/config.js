// PWA Rescue 运行时配置
// 本地预览时使用此默认值;Cloudflare Pages 部署时由 build.js 从 env 重写
window.PWA_RESCUE_CONFIG = {
  // 拉备份域名 + 客服 + Logo + 轮播图的接口端点列表,任一返回即用
  // 其他所有展示数据(support_url, logo_url, carousel_images)都由接口返回
  domainApiEndpoints: [
    'https://csapi.dggame365.com/v1/site/rescue-domain-list',
    'https://csapi.dggcms.com'
    // 'https://www.gamecsjshqk923.cyou/api/v1/site/rescue-domain-list'
    // 'https://your-worker.workers.dev/api/index/pwa-domains'
  ]
};
