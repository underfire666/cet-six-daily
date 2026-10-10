# 六级日常 · V15 上线准备

六级日常是一个提供每日学习、历年真题选练、学习记录和私有内容学习的网站。

当前应用版本为 **15.0.0**，阶段为 **V15 Deployment Preparation**。V14 的功能与返回修补已完成验收；V15 正在准备 Node.js、Docker 和 Render 部署。**本地构建或部署检查通过不等于网站已上线**：当前尚未创建 Render 服务或生产数据库，也没有经过验证的线上访问地址。

## 已有功能

- 每日学习任务、词汇复习、生词本、学习记录与 XP。
- 2022—2026 年 33 套六级真题目录，支持年份、考期、套卷和听力/阅读/翻译/写作选练；包含 311 个独立题组/任务、1381 道题/任务。
- 133 个真题听力音频篇章，支持原文、答案、解析、暂停续播和倍速切换。
- 统一真题学习记录：继续原未完成练习、只读查看已完成答案与作答历史，返回时保留原列表筛选。
- 翻译、写作草稿与参考内容，沿用规则估分。
- 账号功能与已有云端数据同步；PRIVATE JSON 导入、本人访问隔离、受支持的阅读选择题学习、错题手动复习及进度同步。

访客存档与未完成真题选练仍以当前浏览器、当前网站地址的本地记录为主；更换地址不会自动搬迁本地数据。功能范围和历史验收以 [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) 为准。

## 本地开发

使用 Node.js 24.15.0、npm 11 和 PostgreSQL。Next.js、React 与其他依赖版本由 `package-lock.json` 固定。

1. 将 `.env.example` 复制为项目根目录的 `.env`，填入开发数据库连接和本地专用 `AUTH_SECRET`。开发时设置 `NODE_ENV=development`、`AUTH_TRUST_HOST=true`，并将 `AUTH_URL` 设为终端显示的本地地址，例如 `http://127.0.0.1:3000`；环境文件不提交到 Git。
2. 在项目目录安装依赖并准备开发数据库：

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

按终端显示的本地地址访问，默认是 `http://127.0.0.1:3000`。上面的迁移命令用于你配置的数据库；开发和生产使用独立数据库。

## 准备上线

无需自行购买服务器的推荐路径是 Render Docker Web Service + Render PostgreSQL。仓库提供 `render.yaml` 模板；按 [DEPLOYMENT.md](./DEPLOYMENT.md) 连接 GitHub，选择 `codex/v15-launch-deployment` 分支，并在创建页面确认服务、数据库及实际费用。

生产环境需要独立的 `DATABASE_URL`、`AUTH_SECRET` 和正确的 HTTPS 登录来源。项目支持以下命令：

| 命令 | 用途 |
| --- | --- |
| `npm run deploy:check` | 检查生产环境配置 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | 应用已提交的数据库迁移 |
| `npm run build` | 构建生产应用 |
| `npm run deploy:prepare` | 补齐 standalone 包中的静态文件及音频 |
| `npm run start:production` | 启动生产服务 |

生产脚本从进程环境读取变量，不会自行导入 `.env`。自托管从 `.env.production.example` 创建不提交 Git 的 `.env.production.local`；按部署指南通过 `node --env-file` 显式加载。`start:production` 使用 standalone 运行服务。

`/api/health` 检查服务存活；`/api/ready` 检查数据库及必要表是否就绪。线上发布后还要验证注册登录、数据保存恢复、真题音频和练习返回流程。

## 项目说明与检查

- [项目当前状态与功能边界](./PROJECT_CONTEXT.md)
- [部署、环境配置、备份和回退指南](./DEPLOYMENT.md)
- [V14.10.2 返回修补验收报告](./V14_CET6_PRACTICE_RECORDS_RETURN_FIX_REPORT.md)

```sh
npm test
npm run typecheck
npm run lint -- --max-warnings 0
npm run build
```

V14 基线验收为 1340 项自动测试及 116 项 Chrome 浏览器检查通过。V15 分支的 GitHub Actions 另提供 Linux Docker 与全新隔离 PostgreSQL 验证入口，检查迁移、健康接口、注册登录和音频；查看实际运行结果后再记录为通过。该验证不使用生产秘密或线上用户数据，不自动部署网站。V15 本地、Linux 镜像及公网验收结果分别记录，不能沿用本地结果宣称已上线。
