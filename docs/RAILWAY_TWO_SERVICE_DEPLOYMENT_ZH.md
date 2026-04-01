# Railway 两服务部署

更新时间：2026-04-01

这个方案专门给 Railway 当前只能开 2 个服务的情况。

只用这两个服务：

1. `postgres`
2. `app`

其中：

- `postgres` 是 Railway 托管数据库
- `app` 是一个合并服务，同时跑：
  - Next.js 前端
  - FastAPI 后端

不要再建：

- `web`
- `api`
- `redis`

---

## 1. 当前方案和旧方案的区别

旧方案是：

- `web`
- `api`
- `postgres`
- `redis`

现在额度不够，所以改成：

- `postgres`
- `app`

技术实现已经在仓库里补好了：

- 根目录 [Dockerfile](/C:/Users/hu/Desktop/pet-agent-social/Dockerfile)
- 根目录 [railway.json](/C:/Users/hu/Desktop/pet-agent-social/railway.json)
- 启动脚本 [start-app.sh](/C:/Users/hu/Desktop/pet-agent-social/deploy/start-app.sh)
- Next 同域代理配置 [next.config.ts](/C:/Users/hu/Desktop/pet-agent-social/web/next.config.ts)
- 联动健康检查 [route.ts](/C:/Users/hu/Desktop/pet-agent-social/web/app/api/deploy-health/route.ts)

---

## 2. Railway 里该怎么建

### 服务 1：`postgres`

在 Railway Project 里：

1. 点 `New`
2. 选 `Database`
3. 选 `PostgreSQL`
4. 把服务名改成 `postgres`

### 服务 2：`app`

如果你已经把代码推到 GitHub：

1. 点 `New`
2. 选 `GitHub Repo`
3. 选你的仓库
4. 把服务名改成 `app`

然后在 `Settings` 里确认：

- Root Directory: `/`

如果界面里有 Config as Code File，可以填：

- `/railway.json`

---

## 3. `app` 服务要填的变量

打开 `app` -> `Variables` -> `RAW Editor`，粘贴：

```env
APP_ENV=production
DATABASE_URL=${{postgres.DATABASE_URL}}
CORS_ALLOWED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}}

NEXT_PUBLIC_APP_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_API_BASE_URL=/api/backend
API_BASE_URL=http://127.0.0.1:8000

SECONDME_CLIENT_ID=<填你的 SecondMe Client ID>
SECONDME_CLIENT_SECRET=<填你的 SecondMe Client Secret>
SECONDME_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/secondme/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh

LLM_BASE_URL=https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1
LLM_API_KEY=<填你的 LLM Key>
LLM_MODEL=qwen-flash
```

关键点只有 3 个：

1. `DATABASE_URL` 直接引用 `postgres`
2. 浏览器侧 API 走 `NEXT_PUBLIC_API_BASE_URL=/api/backend`
3. Next 服务端调用后端走 `API_BASE_URL=http://127.0.0.1:8000`

---

## 4. `app` 服务要开公网域名

打开 `app` -> `Settings` -> `Networking` -> `Public Networking`

点击：

- `Generate Domain`

你会拿到一个：

- `https://xxxxx.up.railway.app`

这个域名后面同时给：

- 网站首页
- SecondMe 登录回调
- 同域 API 代理

---

## 5. Railway 怎么判断服务健康

这个两服务方案里，Railway 健康检查已经写在根目录 `railway.json` 里了：

- healthcheck path: `/api/deploy-health`

这个地址不是只看前端，它会顺带检查内部 FastAPI `/health`。

也就是说：

- 如果 Next.js 活着但 FastAPI 死了
- Railway 也会把这个服务看成不健康

---

## 6. 部署顺序

按这个顺序走：

1. 建 `postgres`
2. 建 `app`
3. 给 `app` 粘贴变量
4. 给 `app` 生成公网域名
5. 部署 `app`
6. 打开 `https://<app-domain>/api/deploy-health`
7. 确认返回 `status: ok`
8. 再打开：
   - `https://<app-domain>/`
   - `https://<app-domain>/support`
   - `https://<app-domain>/privacy`
   - `https://<app-domain>/login`

---

## 7. SecondMe callback 怎么填

部署成功后，把 SecondMe External App 的 callback 改成：

```text
https://<app-domain>/api/auth/secondme/callback
```

注意：

- 这里不再有单独的 `web-domain`
- 只有一个 `app-domain`

---

## 8. 验证顺序

验证时按这个顺序最稳：

1. `https://<app-domain>/api/deploy-health`
2. `https://<app-domain>/`
3. `https://<app-domain>/login`
4. 点 SecondMe 登录
5. 完成授权
6. 返回站点后确认登录态正常

---

## 9. 跑通后再做什么

跑通后再回填：

- `websiteUrl`
- `supportUrl`
- `privacyPolicyUrl`
- `iconUrl`
- `redirectUri`

建议直接填：

```text
websiteUrl=https://<app-domain>/
supportUrl=https://<app-domain>/support
privacyPolicyUrl=https://<app-domain>/privacy
iconUrl=https://<app-domain>/secondme/pet-agent-social-icon.svg
redirectUri=https://<app-domain>/api/auth/secondme/callback
```

然后再：

1. 按 `docs/SECONDME_REVIEW_ASSETS.md` 截图
2. 回填 `docs/SECONDME_APP_LISTING_DRAFT.md`
3. 检查 `docs/SECONDME_SUBMISSION_CHECKLIST.md`
4. 最后提交 SecondMe `App` listing
