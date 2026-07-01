# TXMH Eurasia Logistics System MVP

这是一个“官网 + 物流业务系统工作台”二合一项目，不再只是 landing page 原型。

当前已具备的主链路：

- 官网展示与公开询价入口
- 线索池与二次跟进
- 客户与联系人管理
- 报价中心
- 订单管理
- 财务结算工作台

## 技术栈

- `Vite`
- `React 18`
- `Tailwind CSS`
- `@tanstack/react-query`
- `React Router`
- `Supabase`

说明：当前已接入 `React Router`，官网和系统模块都支持 URL 访问。下一阶段继续把订单、报价、客户详情拆成更细的详情深链。

## 先看什么

如果你第一次接手这个仓库，建议按下面顺序阅读：

1. [项目框架与开发文档](./docs/PROJECT_FRAMEWORK_AND_DEVELOPMENT.md)
2. [系统架构](./docs/SYSTEM_ARCHITECTURE.md)
3. [当前框架与业务流](./docs/CURRENT_FRAMEWORK_AND_FLOW.md)
4. [优化方向与路线图](./docs/OPTIMIZATION_ROADMAP.md)
5. [项目系统审计](./docs/PROJECT_SYSTEM_AUDIT.md)
6. [交付检查清单](./docs/DELIVERY_CHECKLIST.md)
7. [Supabase 说明](./supabase/README.md)

完整文档导航见：[docs/README.md](./docs/README.md)

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认开发地址会绑定到 `http://localhost:3000`，同时监听 `0.0.0.0` 方便局域网联调。

最低建议环境变量：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
APP_ALLOWED_HOSTS=
```

说明：

- 只做前端界面开发时，可以先不连 Supabase
- 做真实业务验证时，需要配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` 默认为 `/api/v1`，用于未直连 Supabase 时的 HTTP fallback
- 如果通过内网域名、反向代理或隧道访问开发环境，把额外主机名写进 `APP_ALLOWED_HOSTS`，多个值用逗号分隔

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run check:delivery
npm run check:delivery:build
npm run check:supabase:schema
npm run check:supabase
npm run check:supabase:write
npm run build:supabase:sql
npm run deploy:supabase
npm run deploy:supabase:dry-run
npm run deploy:supabase:verify
```

## 项目结构

```text
src/
├── api/                 # 数据访问层，封装 Supabase 与 HTTP fallback
├── components/          # 页面组件与系统模块
├── data/                # i18n 与静态文案
├── hooks/               # React Query hooks 与业务 hooks
├── lib/                 # QueryClient / Supabase client
├── page/                # 页面级组件
├── store/               # 本地 store
├── system/              # mock 数据与系统演示数据
└── types/               # 类型辅助

scripts/                 # 交付检查、Supabase 检查、bundle/deploy 脚本
supabase/                # migration、seed、smoke test、deploy bundle
docs/                    # 工程文档、业务架构文档、交付文档
```

工程层更详细的说明见：[docs/PROJECT_FRAMEWORK_AND_DEVELOPMENT.md](./docs/PROJECT_FRAMEWORK_AND_DEVELOPMENT.md)

## 数据库部署

推荐直接参考：

- [supabase/README.md](./supabase/README.md)

当前关键文件：

- schema: `supabase/migrations/20260527_000001_mvp_logistics_system.sql`
- rpc: `supabase/migrations/20260527_000002_mvp_rpc_workflows.sql`
- rls: `supabase/migrations/20260528_000003_mvp_rls_policies.sql`
- hardening: `supabase/migrations/20260528105246_harden_rls_roles_and_api_grants.sql`
- order detail: `supabase/migrations/20260530_000004_order_detail_operational_tables.sql`
- lead scoring: `supabase/migrations/20260531_000005_lead_scoring_and_followups.sql`
- public intake security: `supabase/migrations/20260531_000006_public_intake_security_hardening.sql`
- RPC/policy hardening: `supabase/migrations/20260531_000007_rpc_and_authenticated_policy_hardening.sql`
- email task updates: `supabase/migrations/20260601_000008_email_task_update_policy.sql`
- transactional payment RPC: `supabase/migrations/20260602021157_transactional_payment_rpc.sql`
- pricing recalculation RPC: `supabase/migrations/20260602041708_pricing_recalculation_rpc.sql`
- order status update RPC: `supabase/migrations/20260602062921_order_status_update_rpc.sql`
- order task RPC and list view: `supabase/migrations/20260602063911_order_task_rpc_and_list_view.sql`
- dashboard summary RPC: `supabase/migrations/20260602073915_dashboard_summary_rpc.sql`
- auto lead follow-up trigger: `supabase/migrations/20260602075118_auto_lead_followup_trigger.sql`
- seed: `supabase/seed.sql`
- smoke test: `supabase/smoke_test.sql`

当前项目已在 Supabase 项目 `hcorkkudgicarsmexnqf` 部署并通过：

- `npm run check:supabase:schema`
- `npm run check:supabase`
- `npm run check:supabase:write`

如果要在 Supabase SQL Editor 一次执行，可以先运行：

```bash
npm run build:supabase:sql
```

然后执行生成的 `supabase/deploy_bundle.sql`。

## 当前工程特点

- 应用入口在 `src/App.jsx`
- 当前已使用 `React Router`，支持 `/`、`/about`、`/quote`、`/system/overview`、`/system/leads`、`/system/customers`、`/system/quotes`、`/system/cost-center`、`/system/orders`、`/system/finance`
- 系统工作台入口在 `src/components/system/SystemWorkspace.jsx`
- 数据访问优先走 Supabase，未配置时再回退到 HTTP 或本地草稿
- 首页已提供快速询盘表单，`/quote` 公开报价页也会把访客询盘写入 `leads`，并采集 UTM、referrer、落地页和 visitor/session 归因信息，自动关联匹配到的 campaign/source
- 所有公开页面底部提供可展开的 30 秒迷你询盘；线路页自动预填路线，访客无需跳转即可直接写入线索池，失败时保留邮件与复制兜底
- 公开页面按会话和路径去重记录真实访问，询盘复用访问 ID；营销看板可对比页面访问、独立会话、线索和访问→询盘转化率
- 匿名用户只允许读取获客来源/活动，并提交网站访客与线索；客户、报价、订单和财务操作需要登录角色

## 认证与角色

系统注册流程只会写入 `requested_role`。真正的权限需要管理员在 Supabase `app_metadata.role` 或 `app_metadata.app_role` 中分配。

当前约定角色：

- `sales`
- `ops`
- `finance`
- `marketing`
- `manager`
- `admin`

## 交付前建议

正式交付前至少执行：

```bash
npm run check:delivery
npm run check:delivery:build
npm run check:supabase:schema
npm run check:supabase
```

如果要验证匿名询盘写入，再执行：

```bash
npm run check:supabase:write
```

## 后续优化方向

下一阶段建议优先做五件事：

1. 拆出订单、客户、报价详情页，让 `/system/orders/:id` 这类深链承接真实业务详情
2. 成本中心继续补费率导入、版本、生效审批和供应商报价附件
3. 报价继续补版本管理、审批人流转、真实邮件发送追踪和低毛利控制
4. 财务补齐账单、发票、税率、账期、核销和外部系统推送状态
5. 将财务核销、报价审批、成本确认等敏感写操作迁到 RPC 或 Edge Functions

完整路线见：[docs/OPTIMIZATION_ROADMAP.md](./docs/OPTIMIZATION_ROADMAP.md)
