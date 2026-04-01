# SecondMe 提审准备清单

更新时间：2026-04-01

## 1. 目的

这份清单只用于明确当前项目在 SecondMe 上的提审准备状态，分为两部分：

- `App 审核`
- `Integration 审核`

文档中的状态分为三类：

- `已确认`：已经在平台或仓库中确认存在
- `缺失`：当前没有，缺了就不能顺利提审
- `待补动作`：后续需要执行的具体动作

---

## 2. App 审核

### 2.1 已确认

- 已存在可复用的 External App
  - `appId`: `534fd830-773a-4876-b825-ee6343c154c8`
  - `appName`: `Pet Agent Social`
- 当前 `App Description` 已存在
  - `An AI pet social card built with SecondMe ecosystem APIs. Users can create AI pets, view pet status, chat with pets, and trigger pet-to-pet social interactions.`
- 当前本地 OAuth 回调地址已存在
  - `http://localhost:3000/api/auth/secondme/callback`
- 当前平台侧 scope 已存在
  - `userinfo`
  - `chat.read`
  - `chat.write`
- 当前平台状态已确认
  - `listingStatus = not_applied`
  - `publishStatus = unpublished`
- 项目代码中已接入 SecondMe 登录能力
  - 已去除本地邮箱注册/登录入口
  - 已完成 SecondMe 登录回调
  - 已完成 refresh token 自动续期
  - 已在 `/auth/me` 返回 `authProvider`

### 2.2 缺失

- 线上 HTTPS 站点地址
- 线上回调地址
- `websiteUrl`
- `supportUrl`
- `privacyPolicyUrl`
- `iconUrl`
- `screenshots`
- 是否保留当前三项 scope，还是缩到最小集，尚未最终确认

### 2.3 待补动作

1. 确认是否保留当前 scope
   - 方案 A：保留 `userinfo + chat.read + chat.write`
   - 方案 B：缩到最小集 `userinfo`
2. 提供一个稳定可访问的公网 HTTPS 地址
3. 提供线上 OAuth 回调地址
4. 准备审核素材
   - icon
   - 截图
   - 官网
   - 支持页
   - 隐私政策页
5. 在平台补齐 listing 信息后，再执行 `apply-listing`

### 2.4 当前建议

- 当前可以继续整理草稿
- 当前不建议正式提交 `App 审核`
- 原因不是代码没接好，而是审核资料和线上地址还不完整

---

## 3. Integration 审核

### 3.1 已确认

- 当前平台中没有已有 Integration
  - `total = 0`
- 当前仓库已经有对外能力基础
  - `GET /.well-known/agent.json`
  - `GET /a2a/pets/{pet_id}/agent.json`
  - `POST /a2a/pets/{pet_id}`
- 已整理出一版 Integration 草案文案
  - `skill.key = pet-agent-social`
  - `skill.displayName = Pet Agent Social`
  - 已有可用的 prompt 草案
  - 已有候选 action 草案
    - `list_my_pets`
    - `get_pet_status`
    - `chat_with_pet`
    - `run_social_round`

### 3.2 缺失

- 公网可访问的 `mcp.endpoint`
- 公网可访问的 `release endpoint`
- 真正可提交的 MCP-compatible tool surface
- MCP tool 名称与真实实现的一一映射
- Integration validate 结果
- Integration release 审核提交流程

### 3.3 关键说明

- 当前项目已经有 A2A 路由，但这不等于已经具备可审的 MCP Integration
- 当前对外公开的是 A2A 接口，不是正式的 MCP endpoint
- 因此当前最多只能整理 Integration 草稿，不能直接走正式审核提交

### 3.4 待补动作

1. 确认最终要暴露的 MCP tools
   - `list_my_pets`
   - `get_pet_status`
   - `chat_with_pet`
   - `run_social_round`
2. 为这些能力提供一个真正可访问的 `mcp.endpoint`
3. 确认 `authMode = bearer_token` 的真实运行链路
4. 补齐 `envBindings.release.endpoint`
5. 创建 Integration 草稿
6. 先执行 `validate`
7. validate 通过后，再决定是否 `release`

### 3.5 当前建议

- 当前不要正式提交 `Integration 审核`
- 当前只能先做 Integration 草稿
- 真正进入提审前，必须先有公网 HTTPS 的 MCP 入口

---

## 4. 当前最现实的推进顺序

1. 先不提审，先把 `App` 和 `Integration` 的草稿信息固定下来
2. 先补一个公网 HTTPS 地址
3. 先补 `App` 所需的官网、支持页、隐私政策、icon、截图
4. 先完成 `App 审核`
5. 再补 MCP endpoint 和 Integration validate
6. 最后再做 `Integration 审核`

---

## 5. 当前结论

### 5.1 App 审核

- 当前状态：`可整理草稿`
- 当前结论：`暂不正式提交`

### 5.2 Integration 审核

- 当前状态：`可整理草稿`
- 当前结论：`暂不正式提交`

---

## 6. 参考

- SecondMe OAuth2 文档
  - <https://develop-docs.second.me/en/docs/authentication/oauth2>
- 当前项目对接说明
  - `docs/SECONDME_GUIDE.md`
- 当前项目 SecondMe 扩展分析
  - `docs/SECONDME_EXTENSION_POINTS.md`

---

## 2026-04-01 Public Page Draft Update

- Local public pages now exist in `web`:
  - `/`
  - `/support`
  - `/privacy`
- Local icon asset now exists:
  - `web/public/secondme/pet-agent-social-icon.svg`
- Screenshot shot list now exists:
  - `docs/SECONDME_REVIEW_ASSETS.md`
- Final listing draft now exists:
  - `docs/SECONDME_APP_LISTING_DRAFT.md`
- These pages are enough to prepare listing copy locally, but the following
  fields are still missing until a production HTTPS deployment exists:
  - `websiteUrl`
  - `supportUrl`
  - `privacyPolicyUrl`
  - `iconUrl`
  - deployed screenshot URLs or uploaded screenshot files
- Current conclusion remains unchanged:
  - do not submit `App` review yet
  - deploy first, then backfill public URLs into the listing
