# Railway 控制台逐项填写版

更新时间：2026-04-01

这份文档只做一件事：

- 把你在 Railway 控制台里要填的内容，按服务拆开写死

配合下面这些文档一起看：

- `docs/RAILWAY_DEPLOYMENT_ZH.md`
- `docs/SECONDME_DEPLOYMENT_HANDOFF.md`
- `docs/SECONDME_APP_LISTING_DRAFT.md`

---

## 1. 先建 4 个服务

在同一个 Railway Project 里，确保有这 4 个服务：

1. `web`
2. `api`
3. `postgres`
4. `redis`

服务名尽量不要改，这样变量引用可以直接复制。

---

## 2. `web` 服务怎么填

### 2.1 Settings

- Root Directory: `/web`
- Config as Code File: `/web/railway.json`

如果 Railway 没显示 Config as Code File 输入框，也没关系。
因为文件已经在仓库里了，只要 Root Directory 对了，通常会自动读取。

### 2.2 Variables

进入 `Variables`，用 `RAW Editor` 粘贴：

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

### 2.3 Networking

进入 `Networking`:

- 打开 `Public Networking`
- 点击 `Generate Domain`

生成后你会拿到一个 `https://xxxxx.up.railway.app`

---

## 3. `api` 服务怎么填

### 3.1 Settings

- Root Directory: `/api`
- Config as Code File: `/api/railway.json`

### 3.2 Variables

进入 `Variables`，用 `RAW Editor` 粘贴：

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

### 3.3 Networking

进入 `Networking`:

- 打开 `Public Networking`
- 点击 `Generate Domain`

生成后你会拿到一个 `https://yyyyy.up.railway.app`

---

## 4. `postgres` 服务怎么填

这是 Railway 托管数据库，通常不需要你手填连接串。

你只要：

1. 创建 Railway Postgres 服务
2. 服务名设成 `postgres`
3. 等它显示 Running / Healthy

后面 `api` 会直接引用：

```text
${{postgres.DATABASE_URL}}
```

---

## 5. `redis` 服务怎么填

也是 Railway 托管 Redis。

你只要：

1. 创建 Railway Redis 服务
2. 服务名设成 `redis`
3. 等它显示 Running / Healthy

后面 `api` 会直接引用：

```text
${{redis.REDIS_URL}}
```

---

## 6. 推荐操作顺序

按这个顺序最省事：

1. 建 `postgres`
2. 建 `redis`
3. 建 `api`
4. 给 `api` 配 Variables
5. 给 `api` 生成公网域名
6. 部署 `api`
7. 打开 `https://<api-domain>/health`
8. 确认返回 `status: ok`
9. 建 `web`
10. 给 `web` 配 Variables
11. 给 `web` 生成公网域名
12. 部署 `web`

---

## 7. 部署后立刻验什么

### `api`

先验：

- `https://<api-domain>/health`

至少应该看到：

- `status = ok`
- `environment = production`

### `web`

再验：

- `https://<web-domain>/`
- `https://<web-domain>/support`
- `https://<web-domain>/privacy`
- `https://<web-domain>/login`
- `https://<web-domain>/robots.txt`
- `https://<web-domain>/sitemap.xml`
- `https://<web-domain>/secondme/pet-agent-social-icon.svg`

---

## 8. 然后做 SecondMe 回填

在 SecondMe External App 里，把生产 callback 填成：

```text
https://<web-domain>/api/auth/secondme/callback
```

然后测试：

1. 打开 `/login`
2. 点击 SecondMe 登录
3. 能跳转到授权页
4. 授权后能回到站点
5. 登录态能保住

---

## 9. 最后才提审

上线跑通后，再做这三件事：

1. 回填 `docs/SECONDME_APP_LISTING_DRAFT.md`
2. 按 `docs/SECONDME_REVIEW_ASSETS.md` 截图
3. 检查 `docs/SECONDME_SUBMISSION_CHECKLIST.md`

都完成后，再提交 SecondMe `App` listing。
