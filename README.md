# 六级日常 · V15 上线准备

六级日常是一个提供每日学习、历年真题选练、学习记录和私有内容学习的网站。

当前应用版本为 **15.0.1**，阶段为 **V15 Mainland Deployment Preparation**。V14 功能已完成验收，V15 默认按中国大陆服务器上线准备，提供 Docker Compose、PostgreSQL 和 HTTPS 配置。**部署检查通过不等于网站已上线**：当前还没有域名、服务器或经过验证的公网访问地址。

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

国内默认方案为中国大陆 Linux 服务器 + Docker Compose，应用、PostgreSQL 和 HTTPS 网关同机运行。按 [国内上线指南](./DEPLOYMENT_CHINA.md) 准备域名、可备案服务器与 ICP 备案，再部署和验证。配置在 `codex/v15-launch-deployment` 分支，当前未替用户购买任何资源。原 Render Singapore 模板作为海外替代方案保留，见 [通用部署指南](./DEPLOYMENT.md)。

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
- [中国大陆部署、域名与备案、备份指南](./DEPLOYMENT_CHINA.md)
- [通用部署、环境配置和回退指南](./DEPLOYMENT.md)
- [V14.10.2 返回修补验收报告](./V14_CET6_PRACTICE_RECORDS_RETURN_FIX_REPORT.md)

```sh
npm test
npm run typecheck
npm run lint -- --max-warnings 0
npm run build
```

V14 基线验收为 1340 项自动测试及 116 项 Chrome 浏览器检查通过。V15 最终验证：1364 项自动测试、58 项生产浏览器检查、Linux Docker + 全新隔离 PostgreSQL 的 48 项部署检查通过；[对应 GitHub Actions](https://github.com/underfire666/cet-six-daily/actions/runs/38016686720) 验证迁移、健康接口、注册登录、同步、音频与重启后数据保留。该验证不使用生产秘密或线上用户数据，不自动部署网站。

应用生产依赖和镜像迁移工具审计均为 0 项；开发期 ESLint 的一条未修补 braces 告警仍存在，细节见部署指南。V15 本地、Linux 镜像及公网验收分别记录，当前尚未完成公网部署。

V15.0.1 国内部署补充：1369 项自动测试、类型检查、零警告 lint 和生产构建通过；Compose、HTTPS 与备份恢复的实际 Linux 验证另行记录。真实大陆服务器、域名备案及公网业务验收仍待资源开通。
