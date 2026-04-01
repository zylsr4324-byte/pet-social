# SecondMe 联调与信息提交指南

## 当前状态

已确认：

- SecondMe Skill 已安装到 `C:\Users\hu\.codex\skills\secondme-dev-assistant`
- 当前项目的 Web 端运行在 `http://localhost:3000`
- 当前项目的 API 运行在 `http://localhost:8000`
- 现有登录体系是自建邮箱密码登录，不是 SecondMe OAuth
- 现有接口已经具备宠物列表、宠物聊天、状态读取、社交回合等能力

已推断：

- 本地联调建议使用 `http://localhost:3000/api/auth/secondme/callback` 作为 OAuth 回调地址
- 首批申请作用域建议为 `user.info` 和 `chat`
- 第一版 Integration 最适合暴露 4 个工具：
  - `list_my_pets`
  - `get_pet_status`
  - `chat_with_pet`
  - `run_social_round`

仍缺失：

- `Client ID`
- `Client Secret`
- 线上回调地址
- 可公开访问的 MCP endpoint
- 审核用 icon、截图、官网、隐私政策、支持页等资料

## App Info 草案

把下面这块作为当前项目的最小提交草案：

```text
## App Info
- App Name: Pet Agent Social
- App Description: A social experience where users create AI pets, chat with them, and let pets build relationships with each other.
- Redirect URIs:
  - http://localhost:3000/api/auth/secondme/callback
- Allowed Scopes:
  - user.info
  - chat
```

如果你后面会部署线上版本，再补一条生产回调，例如：

```text
https://<your-domain>/api/auth/secondme/callback
```

## 当前仓库的最小接入面

要把这个项目接到 SecondMe，最小改造面如下：

1. 在 Next.js 侧增加发起 OAuth 的入口页或路由。
2. 在 Next.js 侧增加 `/api/auth/secondme/callback`，用 `application/x-www-form-urlencoded` 调用 token 交换接口。
3. 服务端保存 `accessToken`、`refreshToken`、`expiresIn` 以及稳定的 SecondMe 用户标识。
4. 把 SecondMe 用户映射到当前本地用户体系，决定是替换现有登录还是并行保留。
5. 如果要做 Integration，再把现有 API 暴露为 MCP-compatible tool surface，并保持 `Authorization: Bearer <token>` 透传。

## 必要环境变量

SecondMe 文档与 Skill 当前给出的基础配置如下：

```env
SECONDME_CLIENT_ID=
SECONDME_CLIENT_SECRET=
SECONDME_REDIRECT_URI=http://localhost:3000/api/auth/secondme/callback
SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
```

注意：

- OAuth 地址已经是完整路径，不要再拼 `/authorize`
- token 交换必须用表单编码，不要发 JSON
- SecondMe 返回值要先检查顶层 `code`，真正数据在 `data`

## Integration 草案

当前项目最适合先提交一个最小可用 Integration，清单如下：

```json
{
  "manifest": {
    "schemaVersion": "1",
    "skill": {
      "key": "pet-agent-social",
      "displayName": "Pet Agent Social",
      "description": "Talk to your AI pets and trigger their social interactions."
    },
    "prompts": {
      "activationShort": "Use Pet Agent Social when the user wants to inspect or interact with their AI pets.",
      "activationLong": "Use this skill to list the user's pets, inspect pet status, chat with a selected pet, or trigger a social round between pets.",
      "systemSummary": "Pet Agent Social exposes pet-care and pet-social tools backed by the user's account."
    },
    "actions": [
      {
        "name": "list_my_pets",
        "description": "List the current user's pets",
        "toolName": "list_my_pets",
        "payloadTemplate": {}
      },
      {
        "name": "get_pet_status",
        "description": "Read the status of one pet",
        "toolName": "get_pet_status",
        "payloadTemplate": {
          "pet_id": "{{pet_id}}"
        }
      },
      {
        "name": "chat_with_pet",
        "description": "Send a message to one pet",
        "toolName": "chat_with_pet",
        "payloadTemplate": {
          "pet_id": "{{pet_id}}",
          "message": "{{message}}"
        }
      },
      {
        "name": "run_social_round",
        "description": "Trigger one social round for a pet",
        "toolName": "run_social_round",
        "payloadTemplate": {
          "pet_id": "{{pet_id}}"
        }
      }
    ],
    "mcp": {
      "endpoint": "https://<your-domain>/mcp",
      "authMode": "bearer_token",
      "headersTemplate": {},
      "toolAllow": [
        "list_my_pets",
        "get_pet_status",
        "chat_with_pet",
        "run_social_round"
      ]
    },
    "oauth": {
      "appId": "<fill-after-app-created>",
      "requiredScopes": [
        "user.info",
        "chat"
      ]
    }
  }
}
```

这里还不能直接提交，因为以下字段仍然是缺失值：

- `mcp.endpoint`
- `oauth.appId`
- 真实 MCP tool 名称
- release 环境可访问地址

## 平台提交顺序

建议按这个顺序推进：

1. 确认 `App Name`、`Redirect URI`、`Allowed Scopes`
2. 在 SecondMe Develop 上创建或匹配现有 External App
3. 保存 `Client Secret` 到 `~/.secondme/client_secret`
4. 把 SecondMe OAuth 路由接到当前仓库
5. 本地联调登录、token 交换和用户信息读取
6. 暴露 MCP-compatible endpoint
7. 创建或更新 Integration 草案
8. 先 `validate`，通过后再 `release`
9. 补齐 listing 资料，再提交审核

## 我们下一步最合适的动作

如果你要我继续代你走 SecondMe 控制面流程，下一步只需要两类信息：

- 你确认后的 `App Info`
- 或者你允许我生成 Skills Auth 链接，然后你把一次性授权码贴回终端

拿到这两项中的任意一种后，我就可以继续带你做：

- app 创建或匹配
- 凭据保存
- integration 草案确认
- validate / release 前检查

## 参考来源

- Skill 原文：<https://develop.second.me/skill.md>
- Skill 仓库：<https://github.com/mindverse/second-me-skills/tree/main/skills/secondme-dev-assistant>
- OAuth2 文档：<https://develop-docs.second.me/zh/docs/authentication/oauth2>
- API Reference：<https://develop-docs.second.me/zh/docs/api-reference/secondme>

## 2026-03-31 集成状态

- [x] 已复用现有 SecondMe External App，并对齐 `Redirect URI` 与授权 scope。
- [x] 已移除本地邮箱注册/登录入口，当前项目仅保留 SecondMe 登录。
- [x] 后端已保存 `secondme_user_id`、`secondme_access_token`、`secondme_refresh_token`、`secondme_token_expires_at`。
- [x] 后端已补上 refresh token 自动续期，且在 SecondMe 临时异常时不会直接打断本地登录态。
- [x] `/auth/me` 已返回 `authProvider`，登录页当前会明确显示当前会话来自 SecondMe。
- [ ] 下一步可选：把 SecondMe 已绑定状态继续透出到更多账号相关页面。

## 2026-04-01 Public Page Update

- [x] 已补公开站点草稿页：
  - `/`
  - `/support`
  - `/privacy`
- [x] 已补本地 icon 资产：
  - `web/public/secondme/pet-agent-social-icon.svg`
- [x] 已整理截图拍摄清单：
  - `docs/SECONDME_REVIEW_ASSETS.md`
- [x] 已整理最终 App listing 回填草稿：
  - `docs/SECONDME_APP_LISTING_DRAFT.md`
- [x] 已整理部署交接清单：
  - `docs/SECONDME_DEPLOYMENT_HANDOFF.md`
- [x] 已把 SecondMe 当前会话状态继续透出到更多宠物相关页面。
- [ ] 仍待补生产环境 HTTPS 域名，才能回填：
  - `websiteUrl`
  - `supportUrl`
  - `privacyPolicyUrl`
  - `iconUrl`
