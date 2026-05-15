#!/usr/bin/env node
// 从环境变量生成 docs/config.js
// CF Pages 构建命令: node build.js
//
// 支持的环境变量:
//   DOMAIN_API_ENDPOINTS   多个 URL 用逗号分隔,逐个尝试,任一返回即用

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'docs', 'config.js');

function splitList(raw) {
  return String(raw || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

const env = process.env;

if (!env.DOMAIN_API_ENDPOINTS) {
  console.log('[build] 未检测到 DOMAIN_API_ENDPOINTS env,保留 docs/config.js 当前内容');
  process.exit(0);
}

const cfg = {
  domainApiEndpoints: splitList(env.DOMAIN_API_ENDPOINTS)
};

const out =
  '// 由 build.js 在构建时根据环境变量生成,不要手动编辑(本地预览见仓库版本)\n' +
  'window.PWA_RESCUE_CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\n';

fs.writeFileSync(CONFIG_PATH, out, 'utf8');
console.log('[build] docs/config.js 已根据 env 重新生成');
console.log('[build] 内容预览:\n' + out);
