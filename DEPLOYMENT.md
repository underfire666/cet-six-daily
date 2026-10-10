# V15 部署指南

当前应用版本为 **15.0.0 / V15 Deployment Preparation**。本阶段准备运行配置、部署模板和健康检查，保留既有学习功能与界面。**本地准备通过不等于已上线**；当前尚未创建 Render 服务、购买资源或配置生产数据库，也没有经过验证的公网地址。

## 首次上线：Render

Render 可同时托管 Node.js 应用和 PostgreSQL，适合目前没有服务器或线上数据库的情况。本项目需要运行服务端登录、API 和数据库功能，模板使用 Docker Web Service。[Render 的 Next.js 部署说明](https://render.com/docs/deploy-nextjs-app) 将完整应用与静态站点区分开来。

### 模板配置与费用

仓库根目录 `render.yaml` 准备运行 Node/Next.js 的 Docker Web Service `cet-six-daily` 和 PostgreSQL 数据库 `cet-six-daily-db`，均位于 Singapore：

| 资源 | 模板配置 |
| --- | --- |
| Web Service | 收费 `0.5c-512mb`：0.5 CPU、512 MB 内存 |
| PostgreSQL | 收费 `0.1c-256mb`：0.1 CPU、256 MB 内存、1 GB 存储，PostgreSQL 17 |
| 发布方式 | 服务自动部署关闭，数据库迁移在应用启动前执行 |
| 连接与密钥 | 数据库连接由模板绑定，登录密钥独立生成 |

配置字段以 [Render Blueprint 官方规范](https://render.com/docs/blueprint-spec) 为依据。这是收费模板，不是免费试用方案；服务、数据库、存储及可能的流量费用以创建页和 [官方价格页](https://render.com/pricing) 显示为准，请确认后再点击部署。本次开发没有创建或购买这些资源。

免费 PostgreSQL 在创建 30 天后到期，且不提供备份恢复能力，不能替代这里准备的长期生产数据库。[免费实例限制](https://render.com/docs/free)

### 最少操作步骤

1. 注册 [Render](https://dashboard.render.com/) 账号，使用 GitHub 登录或连接 GitHub，授权访问 `underfire666/cet-six-daily` 仓库。当前还未准备 Render 账号。
2. 等待 V15 部署文件提交并上传 GitHub 后，选择 **New → Blueprint**，连接此仓库；分支选择 **`codex/v15-launch-deployment`**，Blueprint 文件使用根目录 `render.yaml`。不要误选仍不含 V15 配置的其他分支。[Blueprint 创建说明](https://render.com/docs/infrastructure-as-code)
3. 查看即将创建的 Web Service、PostgreSQL、Singapore 区域和费用。确认自己接受创建页费用后，再点击 **Deploy Blueprint**。
4. 模板会绑定 `DATABASE_URL`、生成独立 `AUTH_SECRET`，并提供生产运行设置。核对 `AUTH_URL` 使用该服务实际 HTTPS 地址；首次使用 Render 分配的网址即可，无需先购买域名。
5. 等待构建、预部署迁移及服务启动完成。迁移失败时先处理失败原因，不能跳过迁移直接上线。
6. 在 Blueprint 的 Settings 页面将 **Auto Sync** 设为 **No**，后续修改使用 Manual Sync。服务的自动部署关闭与 Blueprint 自动同步是两项设置；Render 默认仍会自动同步 Blueprint 文件的变化。[关闭 Blueprint 自动同步](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync)
7. 保存 Render 分配的公网 HTTPS 地址，并完成下方线上验证。准备好账号或服务后，可继续协作核对配置与线上结果；只有实际验证通过才记录为已上线。

## 生产环境变量

平台部署时在服务环境设置中配置变量；自托管时将 `.env.production.example` 复制为项目根目录的 `.env.production.local`，与开发环境分开。填入实际值，禁止将真实环境文件、密钥或连接字符串提交到仓库，也不要把它们写入部署报告。

`deploy:check` 和生产启动脚本**不会自动读取环境文件**。Render 直接注入进程环境；使用文件时，按下方命令通过 `node --env-file` 或 Docker `--env-file` 显式导入。

| 变量 | 配置要求 |
| --- | --- |
| `DATABASE_URL` | 生产 PostgreSQL 连接字符串；应用与数据库尽量同区域，按数据库提供方要求使用 TLS。Render/容器不能照搬开发机的 `localhost` 地址；同机自托管 PostgreSQL 可使用实际本机地址 |
| `AUTH_SECRET` | 为生产环境独立生成，脚本要求至少 32 个字符，建议使用 32 字节随机内容；保持稳定以保留登录会话，不复用示例值或本地密钥 |
| `NODE_ENV` | `production` |
| `AUTH_URL` | 用户实际访问的 HTTPS 来源，例如 `https://your-service.onrender.com`；变更域名时同步更新 |
| `AUTH_TRUST_HOST` | 在已正确转发 Host/HTTPS 信息的 Render 或自托管代理环境中设为 `true` |
| `HOSTNAME` | 生产容器/平台通常用 `0.0.0.0`；自托管仅供本机反向代理访问时可用 `127.0.0.1` |
| `PORT` | 使用平台分配端口；自托管可用 `3000` |

生产服务位于 HTTPS 代理之后时，代理要传递正确的 Host、`X-Forwarded-Host` 与 `X-Forwarded-Proto`。`AUTH_URL` 是网站地址，不是 `/login` 页面地址；密钥和数据库变量只放服务端，不使用 `NEXT_PUBLIC_` 前缀。

自行生成登录密钥时，在自己的受控终端运行：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

只将结果填入生产秘密配置。Render 模板使用自动生成值时，无需手工生成或复制本地密钥。

## Node.js 自托管

准备 Node.js 24.15.0、npm 11、持久 PostgreSQL 和能转发 HTTPS 请求的反向代理。在服务器项目根目录配置 `.env.production.local`，然后运行：

```sh
npm ci --include=dev
node --env-file=.env.production.local node_modules/prisma/build/index.js generate
node --env-file=.env.production.local scripts/deploy-check.mjs
npm run build
npm run deploy:prepare
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.production.local scripts/start-production.mjs --standalone
```

这些命令显式给 Prisma 和生产脚本加载同一份生产变量；Next.js 的生产构建会读取 `.env.production.local`。如果平台已经注入环境变量，可分别使用 `npm run db:generate`、`npm run deploy:check`、`npm run db:migrate` 和 `npm run start:production`；后者已默认带 `--standalone`。保留安装构建与迁移所需的开发依赖，不能在执行这些任务之前省略 Prisma CLI。

`db:migrate` 对应 **`prisma migrate deploy`**，只应用仓库里已提交的迁移。生产环境不用 `prisma migrate dev`、`prisma db push` 或数据库重置命令。首次部署使用新的专用生产数据库；后续迁移前先确认备份可用。

保持生产进程运行，并通过服务管理器在重启后恢复。将公网 HTTPS 请求经反向代理转发到设置的 `HOSTNAME` / `PORT`；`npm run dev` 用于开发，不作为生产启动命令。

### 仅本机的生产预览

预览环境使用自己的本机 PostgreSQL 和独立密钥，在 `.env.production.local` 设置 `NODE_ENV=production`、`AUTH_TRUST_HOST=true`、`AUTH_URL=http://127.0.0.1:3000`，并设置 `HOSTNAME=127.0.0.1`。检查及启动时显式允许本机 HTTP：

```sh
node --env-file=.env.production.local scripts/deploy-check.mjs --allow-local
node --env-file=.env.production.local scripts/start-production.mjs --standalone --allow-local
```

在启动前仍需完成上方生成客户端、构建和数据库迁移步骤。`--allow-local` 仅允许 localhost、127.0.0.1 或 ::1 的 HTTP 登录来源；不会放宽密钥、数据库格式或可信主机要求，不作为公网部署选项。环境检查验证配置格式，数据库可用性另外由 `/api/ready` 检查。

### 音频与 standalone 包

Next.js 的 standalone 构建默认不包含 `public` 与 `.next/static`。`npm run deploy:prepare` 会把它们补到 `.next/standalone`，其中包含题库听力音频。部署时要携带整个准备后的目录，不能只复制 `server.js` 或漏掉 `public/audio`。[Next.js standalone 官方说明](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

迁移阶段还需要 `prisma/schema.prisma`、`prisma/migrations` 和 Prisma CLI，因此不要把仅有 standalone 服务文件的目录当作迁移工具包。按上面的源码部署步骤运行迁移，或使用下方带迁移工具的 Docker 镜像。

## Docker 部署

Dockerfile 的最终阶段是 `runner`，包含 standalone 应用、静态文件、音频及迁移工具，以非 root 用户运行。配置一个 **不提交 Git** 的 `.env.production.local` 文件，填写上方生产变量。用于 Docker `--env-file` 的文件采用每行 `KEY=value`，不包裹引号；`DATABASE_URL` 必须指向容器可访问的生产 PostgreSQL，而不是容器自己的 `localhost`。

```sh
docker build --target runner -t cet-daily:v15 .
docker run --rm --env-file .env.production.local cet-daily:v15 npm run deploy:check
docker run --rm --env-file .env.production.local cet-daily:v15 npm run db:migrate
docker run --rm --name cet-daily --env-file .env.production.local -p 127.0.0.1:3000:3000 cet-daily:v15
```

以上端口示例使用 `PORT=3000`，容器内监听 `HOSTNAME=0.0.0.0`，外部由同机反向代理提供 HTTPS。生产启动不自动改动数据库；明确执行迁移成功后，再启动应用。通过托管平台部署镜像时，使用平台的预部署任务执行迁移，并使用平台分配的端口。

数据库使用持久托管 PostgreSQL，不能存放在会随应用容器重建而丢失的位置。应用容器可替换，账号和云端学习数据由数据库保存。

## Linux 镜像验证入口

V15 分支的 GitHub Actions 工作流会使用 Linux Docker 和全新隔离 PostgreSQL，验证镜像构建、已提交迁移、`/api/health`、`/api/ready`、注册登录及音频资源。上传 V15 分支后，在仓库 **Actions** 页面查看具体运行及结果；工作流完成前不标记为通过。

此验证使用独立临时数据库和验证用环境设置，不需要生产秘密，不使用用户的本地数据库，也不会创建 Render 资源或自动上线。成功说明对应镜像与隔离环境通过检查，实际 Render 数据库、HTTPS 地址和业务流程仍需要线上验收。

## 线上验证与上线状态

在真实 HTTPS 地址检查：

| 检查 | 预期 |
| --- | --- |
| `/api/health` | HTTP 200，表示应用进程存活 |
| `/api/ready` | HTTP 200，表示数据库查询及必要表检查通过；故障时为 HTTP 503 |
| 首页、题库、关于页 | 可以打开，版本为 15.0.0 |
| 注册、登录、退出 | 真实生产环境可用，HTTPS 与登录来源一致 |
| 数据写入与恢复 | 用专用验收账号检查学习数据写入、刷新恢复及已有同步流程，不使用用户现有数据或公开测试凭据 |
| 真题练习与记录 | 四专项可以进入，退出及完成后保留来源筛选；未完成记录不提前公开答案 |
| 音频 | 文件可访问并正常播放，暂停续播、倍速切换正常 |

健康检查不替代真实业务验收。访客与未完成选练的浏览器存档按网站来源隔离，本地地址的存档不会自动出现在新域名下。只有公网访问、数据库和上述核心操作均验证完成，才能记录“已上线”。此时记录平台、域名、部署提交、检查日期与结果；删除专用验收账号及数据，记录中不包含任何秘密。

## 备份、更新与回退

- PostgreSQL 独立于应用部署持久保存。收费 Render PostgreSQL 提供备份恢复；上线后检查 Recovery 页的可用恢复窗口，并按实际运营需要保留独立数据库导出。[Render 备份恢复说明](https://render.com/docs/postgresql-backups)
- 每次数据库迁移前确认已有备份及恢复方式；备份文件不上传 Git，不作为公开 Release 附件。首次上线不把开发机或测试用户数据库直接复制为生产数据。
- 后续发布保持手动控制：完成构建和检查后，应用已提交迁移，再切换服务版本。
- 需要回退时，先核对旧应用版本兼容当前数据库结构，回退到已验证的应用提交或镜像；**回退应用不降级数据库 schema，不删表、不重置数据库**。如果确实需要恢复数据库，单独制定恢复方案并核对恢复点后的新增数据，不能把它作为普通应用回退步骤。

## 当前阶段的完成条件

V15 的本地交付是可检查的部署配置、生产启动路径、静态音频打包和健康检查。选择 Render 账号、确认费用、创建真实资源及完成公网验收是后续实际上线步骤；本地通过、GitHub 上传和 GitHub Release 均不替代这些步骤。
