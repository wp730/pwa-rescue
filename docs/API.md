# PWA Rescue API 约定

`docs/index.html`(rescue 页)在每次启动时会向后端拉取**实时配置**:可用的备份域名、客服链接、Logo、轮播图。本文档约定接口的请求/响应格式,以及后端实现要点。

## 端点

前端在 [`index.html`](./index.html#L279-L282) 里配置一个或多个端点(`DOMAIN_API_ENDPOINTS`),并行请求,**任一成功即用**,其余取消。

```js
var DOMAIN_API_ENDPOINTS = [
  'https://api-1.example.com/api/index/pwa-domains',
  'https://api-2.example.com/api/index/pwa-domains',
  'https://your-worker.workers.dev/api/index/pwa-domains'
];
```

**强烈建议**:这些端点必须部署在**完全独立的设施**(不同服务商、不同备案、不同 IP 段)。主域被封时这些 API 域也跟着死,救援就彻底失败了。常见组合:
- Cloudflare Worker(全球边缘 + 独立 IP)
- 独立备案的小 API 域(单独的 ICP / NS)
- AWS Lambda / Vercel Edge / Aliyun Function(再分散一层)

## 请求

```
POST {endpoint}
Content-Type: application/json

{
  "domain": "szthhswk.cyou"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `domain` | **是** | 触发救援的原主域 hostname,例如 `szthhswk.cyou`。**不带协议、不带 path**,纯主机名。后端用它定位商户/项目映射,返回对应的备份配置。前端如果拿不到 hostname(异常路径),不会发请求,直接进入失败页。 |

**Curl 示例**
```bash
curl --request POST \
  --url https://api.example.com/api/v1/site/rescue-domain-list \
  --header 'content-type: application/json' \
  --data '{"domain":"szthhswk.cyou"}'
```

**Headers**
- `Content-Type: application/json`(由前端自动设置)
- 浏览器自动带 `Origin`、`User-Agent`、`Accept-Language` 等

> ⚠️ 因为是 POST + `Content-Type: application/json`,**浏览器会先发 OPTIONS preflight**,后端必须正确响应。详见下方 [CORS](#cors) 章节。

## 响应

**HTTP 状态码**:`200`(其他状态视为失败,前端会尝试下一个端点)
**Content-Type**:`application/json; charset=utf-8`

**响应外壳**:标准包装(`code` + `message` + `data` + `timestamp`)

```json
{
  "code": 200,
  "message": "Successful",
  "timestamp": 1778838493,
  "data": {
    "domains": [
      "https://b1.com",
      "https://b2.com",
      "https://b3.com"
    ],
    "support_url": "https://client.example.com/c/xxxx",
    "logo_url": "https://cdn.example.com/logo.png",
    "carousel_images": [
      "https://cdn.example.com/banner1.png",
      "https://cdn.example.com/banner2.png",
      "https://cdn.example.com/banner3.png",
      "https://cdn.example.com/banner4.png"
    ]
  }
}
```

| 顶层字段 | 类型 | 说明 |
|---------|------|------|
| `code` | `number` | 业务状态码,`200` 或 `0` 视为成功,其他视为失败(前端会尝试下一个端点)。前端也兼容**没有 code 字段**的扁平响应。 |
| `message` | `string` | 文案描述,前端只用于日志,不展示给用户 |
| `timestamp` | `number` | Unix 时间戳,前端不读,可用于后端调试 |
| `data` | `object` | 业务数据,字段如下 |

### `data` 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `domains` | `string[]` | **是** | 备份域名数组,按优先级排序。第一个是默认推荐域(用户看到的"Baixe app"按钮指向)。元素必须是完整 URL 含 `https://`,末尾斜杠可有可无。**长度 ≥ 1**,返回空数组视为失败。 |
| `support_url` | `string` | 否 | 客服链接。右上角圆形图标 + 主按钮下方文字链接 + 失败页"Falar com suporte"按钮共用。**不返回时这些客服入口全部隐藏**。 |
| `logo_url` | `string` | 否 | 顶部 Logo 图片 URL。建议 PNG 透明背景,显示高度 36px,推荐源图至少 72px 高。**不返回时不显示 logo**。 |
| `carousel_images` | `string[]` | 否 | 轮播图 URL,**164:292 竖图比例**,推荐源图 328×584(2x)。建议 2-5 张。**不返回或空数组时不显示轮播区域**。 |

> 前端**没有任何写死兜底**(`FALLBACK_DOMAINS` / `DEFAULT_SUPPORT_URL` / `DEFAULT_LOGO_URL` / `DEFAULT_CAROUSEL_IMAGES` 都已移除)。除接口端点列表外,其他所有展示内容一律由接口提供;接口没给的字段对应的 UI 元素会隐藏。

### 前端容错

| 异常 | 处理 |
|------|------|
| HTTP 非 200 | 当前端点失败,尝试下一个 |
| JSON 解析失败 | 同上 |
| `domains` 缺失/不是数组/空 | 同上 |
| 所有端点失败 / `ctx.from` 缺失 / 没配端点 | 直接展示失败页(`Estamos preparando algo melhor`) |
| `support_url` 缺失 | 隐藏所有客服入口(右上角图标、Baixe app 下方链接、失败页按钮) |
| `logo_url` 缺失或图片加载失败 | 不显示 logo |
| `carousel_images` 缺失或全部过滤后为空 | 整个轮播区域不渲染 |
| 拉到 domains 但**全部 ping 不通** | 若有 `support_url`:CTA 变"Falar com suporte";否则直接展示失败页 |

### 超时

- 单个 endpoint 请求超时:**4 秒**(`FETCH_TIMEOUT`)
- 单个域名 ping 探活超时:**2.5 秒**(`PING_TIMEOUT`)

## 响应示例(各种场景)

### 正常返回
```json
{
  "code": 200,
  "message": "Successful",
  "timestamp": 1778838493,
  "data": {
    "domains": ["https://b1.com", "https://b2.com"],
    "support_url": "https://client.example.com/c/xxxx",
    "logo_url": "https://cdn.example.com/brand-a.png",
    "carousel_images": [
      "https://cdn.example.com/promo-1.png",
      "https://cdn.example.com/promo-2.png"
    ]
  }
}
```

### 只返回必填字段
```json
{
  "code": 200,
  "data": {
    "domains": ["https://b1.com", "https://b2.com"]
  }
}
```

### 失败(任一即触发前端尝试下一个端点)
- HTTP `503`
- `code` 不是 `200` / `0`
- `data.domains` 缺失或空数组
- 任何非 JSON 响应

## CORS

由于使用 `POST + Content-Type: application/json`,浏览器会先发 **preflight OPTIONS** 请求。后端必须正确响应这两类请求:

**OPTIONS 预检响应**(必须返回 `204` 或 `200`):
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

**POST 正式响应**:
```
Access-Control-Allow-Origin: *
```

`Access-Control-Allow-Origin` 也可精确匹配 rescue 页所在域(更安全):

```
Access-Control-Allow-Origin: https://pwa-rescue.pages.dev
```

> `Access-Control-Max-Age: 86400` 让 preflight 结果缓存 24h,避免重复 OPTIONS,提高首屏速度。

## 缓存策略

**强烈建议**:

```
Cache-Control: no-store
```

或非常短的 TTL(最多 30 秒):

```
Cache-Control: max-age=30
```

**理由**:这个接口是救援场景的"开关",域名一被封,后端要能在 30 秒内推出新配置让用户切走。任何长缓存都会让封禁期间用户卡在"打不开"状态。

## 性能要求

- 接口响应时间 **<500ms**(P95)
- 后端**禁止依赖会被一起封的主业务数据库**。配置应该是独立的、可静态化的(KV / 配置中心 / 静态 JSON)。

## 后端实现样例

### Cloudflare Worker(推荐)

```js
export default {
  async fetch(req) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    // 处理 preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    let domain = '';
    try {
      const body = await req.json();
      domain = String(body.domain || '');
    } catch (_) {}

    const config = MERCHANTS_KV
      ? JSON.parse(await MERCHANTS_KV.get(domain) || '{}')
      : null;

    const out = config && config.domains?.length ? config : { domains: [] };

    return new Response(JSON.stringify(out), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }
};
```

### Node / Express

```js
app.options('/api/v1/site/rescue-domain-list', cors());
app.post('/api/v1/site/rescue-domain-list', cors(), express.json(), (req, res) => {
  const domain = String(req.body.domain || '');
  const config = lookup(domain);  // 从 Redis/MySQL/配置文件读

  res.set('Cache-Control', 'no-store');
  res.json(config || { domains: [] });
});
```

## 监控建议

后端记录每次请求的:
- `domain`(哪个主域触发的)
- IP / Region(看封锁地域分布)
- 响应耗时
- 是否命中配置(没命中说明 domain 不在白名单)

这些数据能帮你判断:
- 封禁是不是发生了(`domain` 请求量短时间陡增)
- 封禁地域(IP 分布)
- 推送备份域后用户是否真的切过去(再观察主域回访量下降)

## 未来扩展(预留字段建议)

虽然现在前端不读这些字段,但建议后端**先支持返回**,以便未来平滑升级前端:

| 字段 | 类型 | 用途 |
|------|------|------|
| `title` | `string` | 自定义主标题,覆盖前端写死的 `Atualizando sua conexão` |
| `subtitle` | `string` | 自定义副标 |
| `cta_text` | `string` | 自定义主按钮文案 |
| `version` | `number` | 配置版本号,方便排查"为什么我看到的不是最新的" |
| `expires_at` | `number` | Unix 时间戳,前端可加本地短期缓存 |
| `theme` | `object` | 主题色 `{ primary: '#7c5cff', bg: '#0d0e27' }` |

## 字段配置(前端常量)

前端配置通过 [`docs/config.js`](./config.js) 提供:

```js
window.PWA_RESCUE_CONFIG = {
  domainApiEndpoints: [...]   // 接口端点列表
};
```

`index.html` 在主脚本之前 `<script src="config.js"></script>` 引入这份配置。**只有接口端点需要本地配置,其他所有展示内容(support_url / logo_url / carousel_images)一律由接口返回,前端不提供任何写死兜底。**

**注意**:如果 `domainApiEndpoints` 全部失败 / 都没配 / 当前 URL 无 `from` 参数,前端直接进入失败页(展示"Falar com suporte"按钮)。如果连 `support_url` 也没拿到,失败页的按钮也会被隐藏 —— 这种情况下用户看到的就是一个纯提示页。

## Cloudflare Pages 部署 + env 变量

`config.js` 默认从仓库读取。如果想用 CF Pages 后台的 env 变量统一管理,可以挂上仓库根目录的 [`build.js`](../build.js):

**CF Pages 构建配置**
- **Build command**: `node build.js`
- **Build output directory**: `docs`
- **Framework preset**: None

**环境变量**

| 变量 | 类型 | 必填 | 示例 |
|------|------|------|------|
| `DOMAIN_API_ENDPOINTS` | comma-separated URLs | 是(否则前端没接口可调) | `https://a.com/api/index/pwa-domains,https://b.com/api/index/pwa-domains` |

**工作原理**
- 构建时 `build.js` 读 env,生成新的 `docs/config.js` 覆盖仓库版本
- 没设 env 时脚本直接退出,保留仓库默认值(本地预览/开发不受影响)
- 没用 `build.js` 时,直接编辑 `docs/config.js` 也行

**本地测试构建**
```bash
DOMAIN_API_ENDPOINTS="https://a.com/api,https://b.com/api" node build.js
```
