# 欧亚大陆业务范围与权限矩阵

本文档把当前目标业务聚焦到中欧、中亚、中俄及欧亚大陆陆路通道，并映射到系统模块、数据字段、算法检查和登录权限。

## 1. 业务范围

当前系统优先服务以下产品：

| 产品线 | 典型客户需求 | 系统对应能力 |
| --- | --- | --- |
| 中欧班列拼箱 LCL | 小批量、多 SKU、电商/配件/设备件，按 CBM 或重量计费 | 官网路线页、询价表、AI 客服、报价中心按体积/重量核价、订单附件/POD 归档 |
| 中欧班列整柜 FCL | 20GP/40HQ/45HQ 整柜，稳定班列计划和舱位 | 自助询价下单、箱型箱量、费率版本、生效审批、门到门节点追踪 |
| 中亚班列与卡车 | 哈萨克斯坦、乌兹别克斯坦、吉尔吉斯斯坦等目的地，铁路/卡车灵活组合 | 路线/目的国标签、供应商覆盖、卡车末端派送、应收应付账期 |
| 中俄陆路与班列 | 满洲里/二连浩特等口岸，俄罗斯及周边俄语区 | 口岸节点、清关资料、供应商 KPI、异常责任和客户轨迹 |
| 欧亚大陆卡车 | 中国至中亚/俄罗斯/欧洲部分门到门或末端段 | 卡车运输方式、提货/派送节点、供应商响应时效、异常/POD 闭环 |

## 2. 市场与通道信息

截至 2026 年一季度，官方数据表明中欧班列仍是欧亚贸易的重要稳定通道：2026 年 1-3 月开行 5,460 列、运输 546,000 TEU，同比分别增长 29% 和 22%；网络覆盖 26 个欧洲国家的 235 个城市，且覆盖欧亚大部分区域。固定班列表服务每周 22 列，覆盖 9 个中国城市和 6 个欧洲城市，较普通服务同线运输时间压缩超过 30%。

中亚和跨里海方向也需要进入系统路线与供应商治理：2026 年初中哈铁路货运量增长，过境中国货物增长明显；跨里海国际运输路线在 2026 年计划加强数字化单证、海关数据交换和集装箱班列增长。

系统含义：

- 路线不应只按“国家”管理，还要按 `corridor`、`border_port`、`rail_terminal`、`truck_leg`、`customs_node` 管理。
- 报价不应只算总价，还要记录 `LCL/FCL/truck`、箱型箱量、CBM、毛重、计费重、口岸和目的站。
- 订单必须覆盖提货、入仓、装柜、出口报关、口岸换装/换轨、在途、到站、进口清关、末端派送、POD 和财务结算。
- 供应商管理必须按铁路平台、口岸代理、清关代理、卡车承运商、海外派送和财务账期分层。

参考信息：

- China State Railway Group / Xinhua via State Council: https://english.www.gov.cn/archive/statistics/202604/16/content_WS69e0998ec6d00ca5f9a0a777.html
- Xinhua report on China-Europe Railway Express network: https://m.kunming.cn/en/c/2026-03-05/14022979.shtml
- Kazakhstan-China rail freight report: https://astanatimes.com/2026/04/kazakhstan-china-rail-freight-up-9-3-in-early-2026/
- Middle Corridor / TITR 2026 plan: https://timesca.com/middle-corridor-countries-approve-2026-plan-focus-on-digitalization-and-container-growth/

## 3. 系统匹配

| 业务要求 | 已匹配模块 | 当前证据 | 下一步 |
| --- | --- | --- | --- |
| 官网获客引流 | 首页、路线页、快速询盘、UTM 归因 | `PublicConversionBar`、`routeLandingPages`、`website_visits` | 增加中欧/中亚/中俄专题路线页与口岸页 |
| 自助询价下单 | 公开报价、订单草稿、门到门准备度 | `QuoteCalculator`、`SelfServiceOrderPage` | 增加 LCL/FCL/truck 分产品字段校验 |
| AI 客服 | 意图识别、DDP/FBA/追踪/资料问答 | `PublicAiAssistant` | 增加中亚/中俄口岸、禁运品、换装换轨问答 |
| 报价中心 | 自动核价、低毛利审批、版本/正式输出 | `QuoteWorkspace`、报价治理迁移 | 报价审批角色、Storage PDF 和邮件回执 |
| 订单全周期 | 门到门节点、详情治理、客户轨迹/POD | `OrderWorkspace`、订单生命周期检查 | 独立订单详情页、真实附件上传、异常责任持久化 |
| 供应商管理 | 供应商 KPI、附件响应、对账付款、费率审批 | `CostCenterWorkspace` | 供应商报价附件上传、报价响应采集 |
| 财务应收应付 | 账期、票据、税率、核销、规则/外部导出 | `FinanceWorkspace`、财务治理迁移 | ERP/用友/金蝶 API、回执失败重试页面 |

## 4. 登录权限分类

| 角色 | 主要职责 | 可读 | 可写/审批 | 不应开放 |
| --- | --- | --- | --- | --- |
| `admin` | 系统管理员、权限和数据修复 | 全部模块 | 全部配置、审批、迁移后数据修复 | 不限制，但需审计 |
| `manager` | 业务主管、低毛利/费率/异常审批 | 全部业务模块 | 报价审批、费率审批、客户合并审批、重大异常关闭 | 不直接录入收付款凭证 |
| `sales` | 获客、客户、报价、报价转订单 | 线索、客户、报价、本人订单 | 线索转客户、创建报价、提交审批、报价输出 | 成本明细、供应商付款、财务规则 |
| `marketing` | 官网获客、campaign、线索分发 | 访问、线索、campaign、邮件任务 | 创建 campaign、分发/跟进线索 | 报价成本、订单费用、财务 |
| `ops` | 订单履约、供应商协同、异常处理 | 订单、供应商基础、任务、附件 | 订单状态、任务节点、异常、POD/附件 | 收付款核销、财务规则 |
| `finance` | 应收应付、开票、付款、导出 | 订单财务、应收应付、供应商账务 | 收款、付款、核销、财务规则、外部导出 | 修改销售报价和营销线索 |
| `viewer` | 只读审计或老板查看 | 看板、统计、只读列表 | 无 | 任何写入动作 |
| `anon` | 官网访客 | 公开路线、公开报价入口 | 提交询盘、创建公开访问记录 | 后台系统数据 |

权限实现原则：

- RLS 只能使用 `app_metadata.role`，不能使用用户可编辑的 `user_metadata.role`。
- 新表必须显式 `GRANT`，再启用 RLS 和策略。
- 报价、费率、客户合并、财务导出等关键动作必须有审计事件。
- 客户、报价、订单、财务之间的深链允许跨模块查看，但写入权限仍由角色和所属关系控制。

## 5. 验证要求

每个迭代必须运行至少以下检查：

- `npm run check:system-readiness`
- `npm run check:business-flow`
- `npm run check:quote-pricing`
- `npm run check:order-lifecycle`
- `npm run check:supplier-health`
- `npm run check:finance-aging`
- `npm run check:finance-governance`
- `npm run check:delivery`

上线前必须再运行：

- `npm run check:core`
- `npm run check:release`
- 远端迁移部署后运行 `npm run check:release:strict`
