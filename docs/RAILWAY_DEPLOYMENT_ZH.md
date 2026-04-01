# Railway 部署执行单

更新时间：2026-04-01

这份文档是给你直接在 Railway 控制台照着点的。

如果你只想看最短的控制台填写清单，直接看：

- `docs/RAILWAY_CONSOLE_CHECKLIST_ZH.md`

目标很明确：

1. 把 `web`
2. 把 `api`
3. 把 `Postgres`
4. 把 `Redis`

四个服务放到同一个 Railway Project 里。

当前最省事的方案是：

- 先用 Railway 自动分配的 `*.up.railway.app` 域名
- 等 SecondMe `App` 审核通过或你需要正式品牌域名时，再换自定义域名

---

## 0. 开始前准备

请先确认下面这些东西已经有了：

- 仓库代码已经在 GitHub 上
- 现有 SecondMe External App 仍然是 `Pet Agent Social`
- 你手里有：
  - `SECONDME_CLIENT_ID`
  - `SECONDME_CLIENT_SECRET`
- 你后端要用的 LLM Key 已准备好

为了让下面的引用变量可以直接复制，Railway 里的服务名请固定成：

- `web`
- `api`
- `postgres`
- `redis`

如果你已经建过服务，名字不一样也能用，但文档里的 `${{api.xxx}}`、`${{postgres.xxx}}`、`${{redis.xxx}}` 需要跟着改。

---

## 1. 创建 Railway Project

推荐做法：

1. 打开 Railway
2. 新建一个 Project
3. 连接这个仓库
4. 在同一个 Project 里准备 4 个服务：
   - `web`
   - `api`
   - `postgres`
   - `redis`

其中：

- `web` 和 `api` 连接同一个 monorepo
- `postgres` 用 Railway 托管 Postgres
- `redis` 用 Railway 托管 Redis

---

## 2. 配置 `web` 服务

打开 `web` 服务，进入 `Settings`，按下面填：

- Root Directory: `/web`
- Config as Code File: `/web/railway.json`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Watch Paths:
  - `/web/**`

说明：

- 这个仓库是隔离式 monorepo，`web` 和 `api` 不共享根目录构建
- Root Directory 设成 `/web` 后，Railway 会只用这个目录做构建
- `web/railway.json` 已经把 build/start/watch/healthcheck 固定好了，控制台里看到同样内容属于正常

---

## 3. 配置 `api` 服务

打开 `api` 服务，进入 `Settings`，按下面填：

- Root Directory: `/api`
- Config as Code File: `/api/railway.json`
- Watch Paths:
  - `/api/**`

`api` 这边不用再手动填 Build / Start Command，原因是仓库里已经有：

- `api/Dockerfile`
- `api/railway.json`

Railway 会直接用这个 Dockerfile。

---

## 4. 创建托管数据库

在同一个 Project 里新增两个托管服务：

1. `postgres`
2. `redis`

这里先不用手动抄连接串，后面直接用 Railway 的引用变量。

---

## 5. 先给 `web` 和 `api` 生成公网域名

这是最关键的一步，因为后面的环境变量要引用真实域名。

分别打开：

1. `web`
2. `api`

然后都去：

- `Settings`
- `Networking`
- `Public Networking`
- 点击 `Generate Domain`

你会拿到两个 HTTPS 域名，大概长这样：

- `https://xxxxx.up.railway.app`
- `https://yyyyy.up.railway.app`

这两个域名后面分别给：

- `web` 站点
- `api` 接口

如果 Railway 要求服务先成功监听端口后才显示生成域名入口，就先部署一次，再回来点 `Generate Domain`，然后继续下面的变量配置。

---

## 6. 给 `api` 粘贴环境变量

打开 `api` 服务的 `Variables` 页。

推荐直接用 `RAW Editor` 粘贴下面这段：

```env
APP_ENV=production
API_HOST=0.0.0.0
CORS_ALLOWED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}

DATABASE_URL=${{postgres.DATABASE_URL}}
REDIS_URL=${{redis.REDIS_URL}}

SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_CLIENT_ID=<填你的 SecondMe Client ID>
SECONDME_CLIENT_SECRET=<填你的 SecondMe Client Secret>
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh

LLM_BASE_URL=https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1
LLM_API_KEY=<填你的 LLM Key>
LLM_MODEL=qwen-flash
```

这里的重点：

- `DATABASE_URL` 直接引用 `postgres` 服务的连接串
- `REDIS_URL` 直接引用 `redis` 服务的连接串
- `CORS_ALLOWED_ORIGINS` 直接指向 `web` 的公网域名

如果你的数据库服务名不是 `postgres`，或者 Redis 服务名不是 `redis`，把引用里的服务名换掉就行。

---

## 7. 给 `web` 粘贴环境变量

打开 `web` 服务的 `Variables` 页。

同样推荐直接用 `RAW Editor` 粘贴：

```env
NEXT_PUBLIC_APP_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_API_BASE_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
API_BASE_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}

SECONDME_CLIENT_ID=<填你的 SecondMe Client ID>
SECONDME_CLIENT_SECRET=<填你的 SecondMe Client Secret>
SECONDME_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/secondme/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
```

这里的重点：

- `NEXT_PUBLIC_APP_BASE_URL` 直接引用 `web` 自己的公网域名
- `NEXT_PUBLIC_API_BASE_URL` 和 `API_BASE_URL` 都直接引用 `api` 的公网域名
- `SECONDME_REDIRECT_URI` 会自动拼成生产回调地址

---

## 8. 部署顺序

按下面顺序点最稳：

1. 让 `postgres` 就绪
2. 让 `redis` 就绪
3. 部署 `api`
4. 打开 `https://<api-domain>/health`
5. 确认看到 `status = ok`
6. 部署 `web`

如果变量修改后 Railway 出现 staged changes，记得点 Deploy，让变量真正生效。

---

## 9. 部署后先验这几个地址

`web` 先验：

- `https://<web-domain>/`
- `https://<web-domain>/support`
- `https://<web-domain>/privacy`
- `https://<web-domain>/login`
- `https://<web-domain>/robots.txt`
- `https://<web-domain>/sitemap.xml`
- `https://<web-domain>/secondme/pet-agent-social-icon.svg`

`api` 先验：

- `https://<api-domain>/health`

`/health` 至少要看到这些关键信息：

- `status: ok`
- `environment: production`
- `services.postgres.mode`
- `services.redis.mode`

---

## 10. 回填 SecondMe 的生产回调地址

等 `web` 域名稳定后，到 SecondMe External App 里把生产回调地址改成或补成：

```text
https://<web-domain>/api/auth/secondme/callback
```

然后立刻验证：

1. 打开 `https://<web-domain>/login`
2. 点击 SecondMe 登录
3. 能正常跳到 SecondMe 授权页
4. 授权后能跳回你的站点
5. 登录后的页面能继续使用，不会立刻掉会话

---

## 11. 回填 SecondMe App listing

部署成功后，把这些真实地址填回：

- `websiteUrl`
- `supportUrl`
- `privacyPolicyUrl`
- `iconUrl`
- `redirectUri`

建议直接按这个格式填：

```text
websiteUrl=https://<web-domain>/
supportUrl=https://<web-domain>/support
privacyPolicyUrl=https://<web-domain>/privacy
iconUrl=https://<web-domain>/secondme/pet-agent-social-icon.svg
redirectUri=https://<web-domain>/api/auth/secondme/callback
```

---

## 12. 最后再做截图和提交

部署稳定后再做两件事：

1. 按 `docs/SECONDME_REVIEW_ASSETS.md` 截图
2. 把真实 URL 回填到 `docs/SECONDME_APP_LISTING_DRAFT.md`

然后再检查：

- `docs/SECONDME_SUBMISSION_CHECKLIST.md`

确认没问题后，才提交 SecondMe `App` listing。

---

## 13. 当前结论

这一步做完之后，你就不是“还在准备部署”，而是已经有了一份可以直接执行的 Railway 上线清单。

当前最短路径是：

1. 在 Railway 建四个服务
2. 生成 `web` 和 `api` 的公网域名
3. 粘贴文档里的两段变量
4. 先通 `/health`
5. 再测 SecondMe 登录
6. 最后回填 listing 和截图

---

## 14. 参考

这份执行单对齐了 Railway 官方文档里的几个点：

- Monorepo Root Directory
- Variables / RAW Editor / Reference Variables
- Railway-provided domain
- `RAILWAY_PUBLIC_DOMAIN`
- `PORT`
