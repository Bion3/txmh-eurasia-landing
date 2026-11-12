# 百度 SEO 第一阶段检查（2026-11-12）

## 已核实（代码层）
- public/robots.txt 已存在，允许通用爬虫抓取，/system 不允许，声明 sitemap.xml。
- public/sitemap.xml 已存在，列出首页、询价、关于、线路索引和若干线路详情页。
- index.html 已包含百度 HTML 验证 meta 标签、canonical、description、结构化数据。
- 网站采用 React SPA；多数页面正文由 JavaScript 客户端渲染，不能仅凭静态 HTML 断言百度已完整抓取正文。
- App.jsx 运行时会覆盖 HTML 的 title 和 description；因此必须同步更新静态和动态 SEO 信息。
- 站点地图仍含 FBA/DDP 线路专题；现阶段仅暂停 FBA/DDP 在线报价，是否保留已有专题需另行审核，不应无确认地删除已有可索引 URL。

## 本分支已做
- 首页静态 HTML 中文优先 title、description、keywords、Open Graph/Twitter 摘要。
- App.jsx 首页、询价、线路索引和关于页的中文搜索元信息。

## 上线前与下一步
1. 核验构建测试及手机/中英文页面，不要因为中文 SEO 丢失英文访客的语言体验。
2. 检查生产环境 GET /robots.txt、/sitemap.xml、/routes 以及站点地图每条 URL 的 HTTP 状态。
3. 通过百度搜索资源平台提交 sitemap，确认百度站点验证、抓取诊断、收录趋势（平台需用户登录）。
4. 优先实现真实路由页面静态预渲染或服务端渲染；不要假定 CSR 页面可被完整索引。
5. 逐页增加独立中文服务内容与 FAQ，避免大量模板化重复内容；每条线路内容必须和实际服务范围一致。
6. 记录百度自然搜索展示、点击、索引页面数、询盘转化；不得承诺排名或收录。
