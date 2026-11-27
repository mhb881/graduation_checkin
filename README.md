# 毕业典礼 QR Code 签到及舞台管理系统（Event Check-in & Stage Management System）

一套支持电脑与手机浏览器的毕业典礼现场管理系统，为每位毕业生生成带 HMAC 签名的专属二维码，提供入场扫码签到、舞台队列调度、全屏舞台大屏实时同步及现场数据统计看板，通过本地 PostgreSQL 事务锁与数据库唯一约束确保多设备并发操作的数据一致性。

---

## 技术栈

- **前端 & 全栈框架**：Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Lucide Icons
- **数据库 & ORM**：PostgreSQL 17 + Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`)
- **身份认证 & 权限**：Better Auth（Email + Password，基于 `admin` 插件区分 `admin` / `staff` 角色）
- **参数校验**：Zod
- **二维码能力**：`qrcode`（服务端生成 PNG / SVG）+ `html5-qrcode`（手机浏览器摄像头扫码 & 图片识别）
- **实时同步**：Server-Sent Events (`/api/stage/stream`) + 兜底同步
- **测试**：Vitest（核心业务逻辑、并发防重签到/入队、状态机与 API 权限集成测试）

---

## 功能模块与页面路由

| 页面路由 | 模块名称 | 权限要求 | 核心功能 |
| --- | --- | --- | --- |
| `/` | 现场工作台首页 | 公开入口 | 各端快捷导航 |
| `/login` | 登录页 | 公开 | 管理员 / 工作人员登录（含演示账号快捷填入） |
| `/admin` | 管理后台 | 仅 `admin` | 新增/编辑/查询参与者、状态筛选、生成/下载二维码、打印名单 |
| `/entry` | 手机扫码签到（Entry Counter） | `staff` / `admin` | 手机摄像头扫码或手动输入编号、核对资料后确认签到、防重复签到、无效码拦截 |
| `/stage` | 舞台管理（Stage Counter） | `staff` / `admin` | 扫码入队（仅限已签到）、FIFO 队列、呼叫下一位、确认完成上台 |
| `/display` | 舞台显示（Stage Display） | 公开全屏 | 实时展示当前上台毕业生姓名与编号，控台切换后自动更新，无需手动刷新 |
| `/dashboard` | 数据统计看板 | `staff` / `admin` | 实时统计 6 项核心指标 + 进度条 + 最近操作审计日志 |

---

## 本地安装与运行指南

### 1. 环境前置要求
- Node.js >= 20（当前验证版本：`v24.21.0`）
- pnpm >= 10（当前验证版本：`12.23.0`）
- 本地 PostgreSQL（推荐 15+，当前验证版本：PostgreSQL 17）

### 2. 安装依赖
```bash
pnpm install
```

### 3. 配置环境变量
复制 `.env.example` 为 `.env`，并按本机 PostgreSQL 账号密码修改 `DATABASE_URL`：
```bash
cp .env.example .env
```
示例 `.env`：
```env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/graduation_checkin"
TEST_DATABASE_URL="postgresql://postgres:123456@localhost:5432/graduation_checkin_test"
BETTER_AUTH_SECRET="grad-stage-2026-super-secret-key-change-in-production-32bytes"
BETTER_AUTH_URL="http://localhost:3000"
QR_SIGNING_SECRET="grad-qr-hmac-2026-secret-key"
```

### 4. 创建数据库、同步表结构并导入测试数据
```bash
# 确保已在 PostgreSQL 中创建 graduation_checkin（及测试库 graduation_checkin_test）
pnpm run db:push
pnpm run db:seed
```
> 如需重置测试数据，可执行：`pnpm exec tsx --env-file=.env src/db/seed.ts --reset`

### 5. 启动系统
```bash
# 开发模式
pnpm dev

# 或生产构建并启动
pnpm run build
pnpm start
```
访问 `http://localhost:3000`。

---

## 预置测试账号与测试数据

执行 `pnpm run db:seed` 后自动生成以下账号（可通过 `/login` 页面底部快捷按钮一键填入）：

| 角色 | 邮箱 | 密码 | 权限说明 |
| --- | --- | --- | --- |
| 管理员 (`admin`) | `admin@grad.edu` | `Admin123!` | 全部权限（含管理后台 CRUD、二维码、签到、舞台、统计） |
| 工作人员 1 (`staff`) | `staff1@grad.edu` | `Staff123!` | 扫码签到、舞台控台、数据统计（不可访问管理后台增删改） |
| 工作人员 2 (`staff`) | `staff2@grad.edu` | `Staff123!` | 扫码签到、舞台控台、数据统计 |

预置 16 名模拟毕业生（`GRAD-2026-001` ~ `GRAD-2026-016`），覆盖已完成、正在上台、等候上台、已签到未入队、未签到全部状态。

---

## 手机真机扫码说明（HTTPS 提示）

现代手机浏览器（iOS Safari / Android Chrome）在访问非 `localhost` 地址时，**仅在 HTTPS 安全上下文下允许调用摄像头**：
- 本机调试可直接打开 `http://localhost:3000/entry` 测试。
- 如需同局域网手机真机测试摄像头，请使用 `pnpm exec next dev --experimental-https` 或反向代理 / 内网穿透（如 `cloudflared`、`ngrok`）提供 HTTPS 访问。
- 同时系统在签到页与舞台页均内置了**二维码图片识别上传**与**手动输入唯一编号**作为无缝兜底方案。

---

## 测试与质量验证

```bash
# 类型检查
pnpm run typecheck

# 代码规范检查
pnpm run lint

# 运行后端核心逻辑、多设备并发锁与权限测试（使用 TEST_DATABASE_URL）
pnpm test

# 生产构建检查
pnpm run build
```

---

## 项目文档

更多开发过程、架构与接口细节见 `docs/` 目录：
- [系统架构与数据库设计](docs/architecture.md)
- [API 接口说明](docs/api-reference.md)
- [开发实施记录](docs/development-log.md)
