# 项目路线图与 SecondMe 兼容扩展点

## 结论

先按当前路线图推进，不会和 SecondMe 产生实质冲突。

真正需要控制边界的是 `Phase 4: A2A 协议适配`。这里如果把 A2A 直接做成业务核心，后面接 SecondMe 会增加返工；如果把 A2A 只做成协议适配层，SecondMe 可以在同一套业务能力之上并行接入。

一句话原则：

- 业务核心保持不变
- A2A 是一层适配器
- SecondMe OAuth / MCP 也是一层适配器
- 两层都不要反向污染核心模型和 service

## 与路线图的关系

### 可以直接继续推进的阶段

- `v0.2` 宠物生存系统
- `v0.2.5` 站内社交引擎
- `v0.3` 2D 家庭场景
- `v0.5` 社区扩展
- `v0.6` 家具系统
- `v1.0` WebSocket、worker、部署

这些阶段主要在补产品能力，本身就是 SecondMe 未来要调用的真实功能面。

### 需要特别注意的阶段

- `v0.4` A2A 协议适配

这里不是不能做，而是要按“协议边界清晰”来做。

## 风险等级

| 阶段 | 与 SecondMe 的冲突风险 | 原因 |
|------|------------------------|------|
| `v0.2` | 低 | 纯业务能力建设 |
| `v0.2.5` | 低 | 纯业务能力建设 |
| `v0.3` | 低 | 纯前端交互与场景层 |
| `v0.4` | 中 | 容易把 A2A 结构误做成核心领域模型 |
| `v0.5` | 低 | 社区能力可被 SecondMe 工具复用 |
| `v0.6` | 低 | 家具系统不影响协议接入 |
| `v1.0` | 低 | 公网、HTTPS、worker 反而更利于接入 SecondMe |

## 当前仓库里最重要的扩展点

### 1. 用户身份模型

当前用户模型在 [models.py](C:/Users/hu/Desktop/pet-agent-social/api/app/models.py) 里只有：

- `email`
- `password_hash`

这对本地登录足够，但对 SecondMe 不够。

后续接 SecondMe 时，不建议直接把现有本地登录删掉，建议二选一：

1. 在 `users` 表上增加可空的 `secondme_user_id`
2. 单独新增 `user_identities` 或 `oauth_accounts` 表，存第三方身份绑定

更稳的是第 2 种，因为它天然支持：

- 本地邮箱密码
- SecondMe OAuth
- 未来其他第三方身份

不建议做的事：

- 把 `email` 直接当作 SecondMe 唯一身份
- 用 `AuthSession.token` 直接保存上游 OAuth token

## 2. 认证与登录路由

当前认证路由在 [auth.py](C:/Users/hu/Desktop/pet-agent-social/api/app/api/routes/auth.py)。

建议未来保持两套入口并存：

- 本地登录：继续保留 `/auth/register`、`/auth/login`
- SecondMe 登录：新增独立入口，例如 `/auth/secondme/start`、`/auth/secondme/callback`

这样不会阻塞你先完成路线图，也能让后续联调按增量方式接入。

不建议做的事：

- 把 SecondMe OAuth 逻辑硬塞进现有邮箱密码接口
- 让前端页面直接依赖 SecondMe token 交换细节

## 3. 协议适配层

这是最关键的一点。

当前项目已经有可复用的宠物与社交能力：

- [pets.py](C:/Users/hu/Desktop/pet-agent-social/api/app/api/routes/pets.py)
- [social.py](C:/Users/hu/Desktop/pet-agent-social/api/app/api/routes/social.py)

这些能力以后既可以被：

- 站内 REST 页面调用
- A2A 路由调用
- MCP / SecondMe Integration 调用

建议未来保持这样的结构：

```text
core services
  -> local REST routes
  -> A2A adapter routes
  -> MCP adapter routes
```

也就是说：

- `A2A` 负责 JSON-RPC / Agent Card / Task 映射
- `MCP` 负责 tool schema / bearer token / endpoint 暴露
- 核心业务只负责“列宠物、读状态、聊天、触发社交”

不建议做的事：

- 在 service 里直接写死 A2A JSON-RPC 结构
- 在 service 里直接写死 MCP manifest 或 tool payload

## 4. 任务模型

当前 `PetTask` 在 [models.py](C:/Users/hu/Desktop/pet-agent-social/api/app/models.py) 里是站内任务模型，这很好。

如果后续进入 `Phase 4`，建议只给它增加可空扩展字段，而不是重做状态机：

- `external_protocol`
- `external_task_id`
- `source_agent_url`

这样：

- 站内任务仍然是站内任务
- A2A 任务只是“附带外部协议映射信息”
- 不会妨碍后续再接 SecondMe MCP

不建议做的事：

- 把 `PetTask.state` 改成完全跟 A2A 一模一样的状态集合
- 为了协议兼容把本地任务语义搞复杂

## 5. 面向 SecondMe 的最小能力面

以当前仓库来看，最先能被 SecondMe 复用的能力是：

1. `list_my_pets`
2. `get_pet_status`
3. `chat_with_pet`
4. `run_social_round`

这些都已经能从现有接口导出，不需要等全部路线图完成。

所以路线图优先级可以继续按原计划走，因为你不是“做完路线图才能接 SecondMe”，而是“路线图每推进一阶段，SecondMe 可接入能力就更完整一层”。

## 6. 前端环境配置

当前 Web 端把 API 地址写死在 [constants.ts](C:/Users/hu/Desktop/pet-agent-social/web/lib/constants.ts)：

```ts
export const API_BASE_URL = "http://localhost:8000";
```

这在本地开发阶段没问题，但后面接：

- SecondMe OAuth 回调
- 公网部署
- Integration 审核

时会变成障碍。

建议在接 OAuth 前改成环境变量，例如：

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_BASE_URL`

这不是现在必须做，但最好在 `v0.4` 前完成。

## 7. 公网与审核前置条件

SecondMe 真正进入联调和审核时，通常需要：

- 可访问的 HTTPS 域名
- 可用的 OAuth callback
- 可访问的 MCP endpoint

这意味着：

- `v0.2` 到 `v0.6` 可以先在本地继续推进
- 真正提交 SecondMe Integration 审核，通常要等到 `v1.0` 的部署条件更完整

所以路线图和 SecondMe 不是冲突关系，而是前后依赖关系。

## 推荐推进方式

建议按下面的顺序执行：

1. 继续收口 `v0.2.5` 和 `v0.3`
2. 进入 `v0.4` 时，把 A2A 实现成“协议适配层”，不要污染核心业务
3. 在 `v0.4` 或 `v0.5` 期间，为用户体系预留 SecondMe OAuth 绑定能力
4. 在 `v1.0` 附近再正式接入 SecondMe OAuth、MCP endpoint 和审核提交流程

## 你现在不用担心的事

下面这些当前不用因为 SecondMe 而暂停：

- 宠物状态系统
- 站内社交逻辑
- 2D 家庭场景
- 家具系统
- worker 之前的手动社交回合

## 你现在要提前避免的事

下面这些如果做了，后面才真的容易冲突：

- 把 A2A 当成唯一外部协议
- 把协议字段硬编码进核心 service
- 把本地账号体系改成只能依赖上游 OAuth
- 把工具名、manifest 字段、JSON-RPC 结构直接写进领域模型

## 最短判断

路线图可以继续做，不需要为接 SecondMe 停工。

真正的工程约束只有一条：

到 `Phase 4` 开始写 A2A 时，务必按“核心业务 + 协议适配层”分层。
