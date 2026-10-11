# V15 中国大陆上线指南

当前版本 **15.0.1 / V15 Mainland Deployment Preparation**。本项目的国内默认方案为 Linux 服务器 + Docker Compose + PostgreSQL 17 + Caddy HTTPS。当前用户尚无域名、服务器和生产数据库；配置准备及隔离验证不代表网站已经上线。

## 你先准备什么

1. 注册并实名一个国内云账号。可选阿里云或腾讯云，域名与服务器放在同一账号方便管理；当前没有替你购买资源。
2. 注册自己喜欢的域名并完成域名实名认证，核对域名持有人与备案主体的要求。不要先绑定尚未备案的域名公开网站。
3. 选择中国大陆区域的 Linux x86_64 服务器，建议起步 **2 核 / 4 GB / 50 GB 磁盘、Ubuntu 24.04 LTS**。这是单机功能运行的起步配置，不是并发容量承诺。生产镜像构建需要额外可用内存和磁盘，必要时在受控构建机完成后传入镜像。
4. 购买前确认该实例可用于 ICP 备案、购买时长及实际费用；免费试用或任意按量实例不一定满足备案条件。在服务器接入商提交真实网站信息并完成备案。使用中国内地服务器需要在对应接入商办理备案，换端口不能免除要求。[阿里云服务器备案要求](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-server-access-information-check)、[腾讯云轻量备案说明](https://cloud.tencent.cn/document/product/1207/45756)
5. 备案期间仅进行受限的内部部署验证。正式开放前取得并展示实际备案号及查询链接；本轮没有虚构备案号或擅自填写主体信息。网站是否需要前置审批等以实际业务、所在地与接入商审核结果为准，不能保证任意个人主体都适用。

建议先决定域名，再选择可备案的服务器并开始备案。数据库可以先随服务器运行，无需立即另外购买线上数据库；将来有容量或可靠性需求时可迁移到同区域托管 PostgreSQL。

## 文件与运行边界

| 文件 | 用途 |
| --- | --- |
| `compose.china.yaml` | 应用、数据库及 HTTPS 网关，只有网关发布 80/443 |
| `.env.china.example` | 域名及两份独立随机密钥示例 |
| `deploy/china/Caddyfile` | HTTPS、HTTP 跳转、流式页面及音频代理 |
| `scripts/china-backup.sh` | 私有 PostgreSQL 导出与 SHA-256 校验 |
| `.github/workflows/v15-china.yml` | 隔离 Linux Compose / 本机 TLS / 重建 / 备份恢复验证 |

应用、数据库和 Caddy 分别限制约 1 GB、512 MB、256 MB 内存，合计 2 CPU；额外内存留给系统与构建。所有服务异常退出后可恢复，日志按大小轮转。PostgreSQL 数据及 Caddy 证书保存在 named volumes。**不要删除这些卷，不使用 `down --volumes` 清理真实生产部署。** 单机方案不提供高可用；服务器故障时需要独立备份恢复。

应用 3000 和数据库 5432 不发布到宿主机。安全组仅在准备正式开放后放行 TCP 80/443（可选 UDP 443），SSH 仅允许自己的管理来源；不开放公网 PostgreSQL。网关保留 Host 和正确的 HTTPS 转发信息，避免登录回调使用 HTTP。应用启动验证配置，数据库迁移仍单独执行。

## 首次部署（服务器上的 Linux 命令）

先按 [Docker 官方 Ubuntu 安装指南](https://docs.docker.com/engine/install/ubuntu/) 安装 Docker Engine 与 Compose 插件。Compose 至少 2.24.4，保证 CI override 语法兼容；生产只使用基础 Compose 文件。

从 GitHub 获取 `underfire666/cet-six-daily` 的 `codex/v15-launch-deployment` 分支并进入项目目录。复制示例后，编辑自己的真实域名和密钥：

```sh
cp .env.china.example .env.china.local
chmod 600 .env.china.local
openssl rand -hex 32
openssl rand -hex 32
```

两次结果分别填入 `POSTGRES_PASSWORD` 和 `AUTH_SECRET`，都必须是 64 位十六进制且相互独立。`SITE_DOMAIN` 只填一个真实域名，不带协议、端口或路径。不要将实际结果发到聊天、截图或 GitHub。`.env.china.local` 和 `backups/` 已排除在 Git 与镜像构建上下文之外。普通重启保持密钥不变；改数据库密码不能只改环境文件，要另外制定密码轮换步骤。

以下步骤检查格式、构建、预检、单独迁移，再启动服务；迁移失败不能跳过：

```sh
docker compose --env-file .env.china.local -f compose.china.yaml config --quiet
docker compose --env-file .env.china.local -f compose.china.yaml build app
docker compose --env-file .env.china.local -f compose.china.yaml run --rm --no-deps app npm run deploy:check
docker compose --env-file .env.china.local -f compose.china.yaml up -d --wait db
docker compose --env-file .env.china.local -f compose.china.yaml run --rm app npm run db:migrate
docker compose --env-file .env.china.local -f compose.china.yaml up -d --wait --wait-timeout 180 app gateway
```

这套网关使用真实域名签发证书，应在备案通过、DNS A 记录指向服务器、80/443 可访问且服务器可连接证书机构后启动公开入口；只配置实际可用的 AAAA 记录。[Caddy 自动 HTTPS 要求](https://caddyserver.com/docs/automatic-https)

备案前不要执行公开入口启动步骤。应用和数据库可以先在隔离环境测试。仓库的 `deploy/china/compose.ci.yaml` **只用于临时 CI 的 localhost TLS**，不能带到公网服务器，也不能把 `--allow-local` 当成公网部署配置。生产不关闭证书校验。

### 国内网络与镜像传输

应用页面、脚本、字体样式及现有听力 MP3 随程序部署，不需要浏览器向国外字体或音频站点下载。构建和运维仍需要 GitHub、npm、基础镜像仓库以及证书机构的出站访问；这不保证每个国内机房都顺畅。

若国内服务器构建或拉取失败，在自己的受控 Linux 构建机生成并验证镜像，将应用及已核对的 PostgreSQL/Caddy 镜像通过自己管理的阿里云 ACR、腾讯云 TCR 或加密传输送到服务器；按云官方说明完成私有仓库登录。不要使用来历不明的镜像源或分享登录凭据。设置 `CET_IMAGE` 为已验证的应用镜像，然后 `pull app` 或 `docker load`，跳过本机 `build app`；其他步骤不变。镜像同步、真实大陆机房连通及公网证书签发仍待实际资源验证。

## 备份与恢复验证

在更新或迁移前执行：

```sh
bash scripts/china-backup.sh
cd backups
sha256sum --check ./cet6-指定时间.dump.sha256
```

将校验命令中的名字换成实际生成文件；备份脚本默认读取 `.env.china.local`，导出到项目 `backups/`，不打印秘密。可通过 `--env-file PATH --output-dir PATH` 指定受控路径。导出失败不发布空文件，文件权限仅限当前用户读取。导出含账号和学习数据，不上传 Git 或公开 Release。

建议每天备份，并将加密备份存到独立于服务器的受控位置；本轮没有在尚不存在的服务器安装定时任务。仅留在同一磁盘不能抵御整机损坏。上线前将备份恢复到新的隔离数据库，用 `pg_restore --exit-on-error` 验证账号、学习数据和迁移结构；不要直接覆盖生产数据库。CI 使用临时数据库实测导出和隔离恢复，不接触用户数据库。

## 正式上线验收、更新与回退

在实际备案域名通过 HTTPS 检查首页、题库、关于页版本 **15.0.1**，`/api/health` 与 `/api/ready` 都为 200。用专用验收账号检查注册/登录、刷新/重新登录后同步数据、音频暂停续播及倍速、真题练习与返回记录，再清理验收数据。补齐实际备案展示，并记录真实部署提交和结果后才能标记 LIVE。

后续发布先备份、验证新镜像并单独运行已提交迁移，再更新 app。保持同一 Compose 项目名和卷，不把生产数据库复制到应用镜像。应用回退只切换到兼容当前数据库的已验证旧镜像，不降级 schema 或删表。新的公网域名不会自动搬迁本地地址下的浏览器存档。

本机测试、GitHub CI、本机证书和公网验收分别记录。本轮未创建云资源、未注册域名、未申请备案，也未提供经过验证的公网访问地址。
