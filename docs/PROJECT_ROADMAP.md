# Pet Agent Social - 项目路线图

## 项目愿景

一个基于 A2A（Agent2Agent）协议的多智能体宠物社交平台。每只宠物是一个独立的 AI Agent，在虚拟社区中互动、交友、社交。

### 核心特性
- **多智能体架构**：每只宠物是独立的 AI Agent，基于 Google A2A 协议通信
- **2D 家庭场景**：俯视角度查看家中布局，实时观察宠物状态和行为
- **宠物生存系统**：饥饿值、口渴值、好感度等动态属性
- **自主社交**：宠物根据性格主动与其他宠物交友、聊天
- **性格驱动**：所有行为基于主人设定的性格特征

---

## 当前完成情况（已推进到 v0.3，Phase 3 进行中）

### 已实现功能

#### 1. 用户系统
- 用户注册/登录（邮箱 + 密码）
- Session-based 认证（Bearer Token）
- 用户与宠物的所有权关系（一对多，后端已支持多宠物列表）

#### 2. 宠物创建与管理
- 创建宠物（名字、品种、颜色、体型、性格、特征）
- 实时预览宠物资料卡片
- 编辑/更新宠物信息
- 宠物资料持久化存储

#### 3. 宠物聊天（核心 AI 功能）
- 基于 LLM 的宠物对话（通义千问 qwen-flash）
- **性格系统**：高冷系、活泼系、黏人系、好奇系、傲娇系
- **人格一致性校验**：防止 AI 身份泄露、风格冲突
- **上下文记忆**：保存聊天历史（最近 8 条消息）
- **兜底回复**：LLM 失败时的性格化备用回复

#### 4. 宠物生存系统（v0.2） ✅
- 宠物状态字段已接入数据库迁移
- `GET /pets/{id}/status` 实时返回投影状态
- `feed / drink / play / clean` 互动命令已完成
- mood 计算已接入状态与聊天
- my-pet 页面已有状态面板

#### 5. 站内社交引擎（v0.2.5） ✅
- PetTask / PetFriendship / PetConversation / PetSocialMessage 已落库
- 好友请求、接受、拒绝接口已完成
- 宠物间站内消息与社交回合已完成
- 主人可查看宠物的社交记录与对话

#### 6. 2D 家庭场景（v0.3，基础版） 🚧
- `/home` 页面已完成并接入 Phaser.js
- 客厅 / 厨房 / 卧室三块基础房间已完成
- 固定交互物件已完成：食盆、水盆、床、玩具
- 宠物会根据状态在场景中移动
- 点击宠物可打开状态面板，聊天目前仍通过快捷入口跳转

#### 7. 技术架构
- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **后端**：FastAPI + SQLAlchemy + PostgreSQL
- **环境预留**：Redis 容器已启动，业务层暂未接入
- **部署**：Docker Compose 一键启动（api + postgres + redis）
- **代码质量**：已完成模块化拆分，核心页面与服务已按阶段拆开

### 当前数据模型

```
User (用户)
├── id, email, password_hash, created_at

Pet (宠物) —— 一个用户可拥有多只
├── id, owner_id (FK → User), pet_name, species, color, size
├── personality, special_traits
├── created_at, updated_at

Message (主人与宠物的聊天消息)
├── id, pet_id (FK → Pet), role (user/pet), content
├── created_at

AuthSession (登录会话)
├── id, user_id (FK → User), token, created_at

PetTask (站内宠物任务)
├── id, target_pet_id, source_pet_id, task_type, state
├── input_text, output_text, created_at, completed_at

PetFriendship (好友关系)
├── id, pet_a_id, pet_b_id, initiated_by, status
├── created_at, accepted_at

PetConversation (宠物私聊会话)
├── id, pet_a_id, pet_b_id, created_at

PetSocialMessage (宠物间消息)
├── id, conversation_id, sender_pet_id, content, created_at
```

### 已知技术债

| 问题 | 说明 |
|------|------|
| Redis 未使用 | 容器已启动，但没有任何业务读写代码 |
| 家庭场景聊天仍未直达 | 当前点击宠物会打开状态面板，但聊天仍通过快捷入口跳转到 `/chat` |
| A2A 协议层未开始 | Phase 4 相关 Agent Card、JSON-RPC 入口、Task 映射都还没实现 |

---

## 开发路线图

### Phase 1.5: 基础设施补齐（v0.1.5）

> 后续每个阶段都涉及新增表或字段，必须先有迁移体系。

#### 目标
引入 Alembic 数据库迁移、完成多宠物前端切换，为后续所有功能奠定基础。

#### 实现步骤

**1.5.1 引入 Alembic** ✅ 已完成
- ✅ `pip install alembic` 并加入 `requirements.txt`
- ✅ `alembic init alembic` 生成迁移目录
- ✅ 配置 `alembic/env.py` 读取现有 `database.py` 的 engine 和 Base.metadata
- ✅ 基于当前表结构生成第一版基线迁移（`alembic revision --autogenerate -m "baseline"`）
- ✅ 移除 `startup.py` 中的 `create_all()` 和手写 `ensure_pet_owner_column()`
- ✅ 移除 `database.py` 中的 `create_tables()` 函数
- ✅ Dockerfile 启动命令改为先跑 `alembic upgrade head` 再启动 uvicorn
- 迁移作为**独立命令**执行，不放进应用启动流程：
  - 开发环境：手动执行 `alembic upgrade head`
  - Docker 部署：Dockerfile CMD 中先跑迁移再启动 uvicorn
  - 多实例部署：迁移作为 release step 单独执行，应用进程不负责迁移

**1.5.2 多宠物前端切换** ✅ 已完成
- ✅ 新建宠物选择器组件：显示当前用户的所有宠物列表
- ✅ 在 my-pet、chat 页面加入切换入口
- ✅ `localStorage` 中保存 `current-pet-id`，切换后自动刷新对应数据
- 后端 `GET /pets` 已返回完整列表，无需新增 API

**预计工作量**：可跑通 2-3 天 / 可上线 4-5 天

**验收标准**：
- `alembic upgrade head` 可从空库建出完整表结构
- `alembic revision --autogenerate` 能检测模型变更并生成迁移脚本
- 前端可在多只宠物之间切换，切换后 my-pet 和 chat 页面数据正确刷新
- `startup.py` 中不再有 `create_all()` 和手写 DDL

---

### Phase 2: 宠物生存系统（v0.2）

#### 目标
为宠物引入动态属性，让宠物成为"活着"的虚拟生命。

#### 新增字段（通过 Alembic 迁移） ✅ 已完成
```python
# 扩展 Pet 模型新增字段
# 所有数值方向统一：0 = 最差，100 = 最佳
fullness: int = 100      # 饱食度（100=吃饱，0=饿）
hydration: int = 100     # 水分值（100=不渴，0=极渴）
affection: int = 50      # 好感度
energy: int = 100        # 精力值
cleanliness: int = 100   # 清洁度
mood: str = "normal"     # 心情（见下方枚举）
last_fed_at: datetime    # 上次喂食时间
last_interaction_at: datetime  # 上次互动时间
stats_updated_at: datetime    # 属性最后一次计算的时间戳
```

mood 枚举定义（前端、后端、数据库需保持一致）：
| 值 | 含义 | 触发条件 |
|------|------|----------|
| `happy` | 开心 | affection > 80 且 energy > 60 |
| `normal` | 普通 | 默认状态 |
| `sad` | 难过 | fullness < 20 或 hydration < 20 |
| `uncomfortable` | 不舒服 | cleanliness < 30 |

#### 实现步骤

**2.1 后端 API** ✅ 已完成
- ✅ `GET /pets/{id}/status` — 获取宠物当前状态（含实时衰减计算）
- ✅ `POST /pets/{id}/feed` — 喂食（提升 fullness）
- ✅ `POST /pets/{id}/drink` — 喂水（提升 hydration）
- ✅ `POST /pets/{id}/play` — 玩耍（提升 affection，消耗 energy）
- ✅ `POST /pets/{id}/clean` — 清洁（提升 cleanliness）

**2.2 属性衰减：读时投影计算** ✅ 已完成

不使用 Celery 或 BackgroundTasks 做定时衰减。当前阶段采用**读时投影计算**：

读写边界规则：
- **GET /pets/{id}/status**：只做投影计算，**不落库**。根据 `stats_updated_at` 和当前时间计算属性衰减后的值，返回给前端，但不修改数据库记录。
- **POST 命令（feed/drink/play/clean）**：才真正更新数据库，写入新的属性值和 `stats_updated_at`。

```python
def project_current_stats(pet: Pet) -> dict:
    """纯计算，不修改 pet 对象，不写库"""
    now = datetime.utcnow()
    elapsed_hours = (now - pet.stats_updated_at).total_seconds() / 3600

    return {
        "fullness": max(0, pet.fullness - int(elapsed_hours * 5)),
        "hydration": max(0, pet.hydration - int(elapsed_hours * 8)),
        "energy": min(100, pet.energy + int(elapsed_hours * 10)),
        "cleanliness": max(0, pet.cleanliness - int(elapsed_hours * 3)),
    }

def apply_decay_and_save(pet: Pet, db: Session) -> None:
    """在写操作时，先结算衰减再叠加操作效果，然后落库"""
    projected = project_current_stats(pet)
    pet.fullness = projected["fullness"]
    pet.hydration = projected["hydration"]
    pet.energy = projected["energy"]
    pet.cleanliness = projected["cleanliness"]
    pet.stats_updated_at = datetime.utcnow()
    # 调用方在此基础上叠加操作效果（如 feed → fullness += 30）
```

优点：GET 无写副作用，可安全缓存、重放、并发访问；写操作集中在 POST 命令中。
后续如需周期推送通知（如"宠物饿了"），再引入 APScheduler 或 Redis + worker。

**2.3 心情计算** ✅ 已完成
```python
def calculate_mood(pet: Pet) -> str:
    if pet.fullness < 20 or pet.hydration < 20:
        return "sad"
    if pet.cleanliness < 30:
        return "uncomfortable"
    if pet.affection > 80 and pet.energy > 60:
        return "happy"
    return "normal"
```

**2.4 前端 UI** ✅ 已完成
- ✅ 在 my-pet 页面添加状态面板（进度条展示各项数值）
- ✅ 添加互动按钮组：喂食、喂水、玩耍、清洁
- ✅ 状态面板在页面加载和每次互动后刷新

**2.5 聊天集成** ✅ 已完成
- ✅ 宠物聊天时参考当前 mood 调整语气
- ✅ 饥饿/口渴状态下回复可能更消极

**预计工作量**：可跑通 3-4 天 / 可上线 5-7 天

**验收标准**：
- `GET /pets/{id}/status` 返回投影计算后的属性值，多次调用不改变数据库记录
- `POST /pets/{id}/feed` 等命令正确结算衰减并叠加操作效果后落库
- 前端状态面板展示 5 项属性进度条和心情标签
- mood 枚举在后端 CheckConstraint、前端 UI、LLM 提示词中一致

---

### Phase 2.5: 站内社交引擎（v0.2.5）

> 在接入 A2A 协议之前，先把"宠物对宠物"的任务层和社交逻辑在平台内跑通。

#### 二次打磨状态（2026-03-28）

- 当前结论：**MVP 已完成，但交互结构和状态边界还不够清晰，已决定从 Phase 2.5 重新按小步打磨**
- 已完成：`2.5-R1` 路线图复盘与现状核对
- 已完成：`2.5-R2` 拆清 `/social` 页面职责边界（候选列表 / 好友列表 / 当前会话 / 历史任务）
- 已完成：`2.5-R3` 收口好友请求、社交回合、可聊天条件三套状态流
- 待开始：`2.5-R4` 为 Phase 2.5 增补最小可回归验证

#### 本轮复盘结论

- 后端模型、迁移和基础接口已经具备 MVP 条件，`PetTask / PetFriendship / PetConversation / PetSocialMessage` 均已落地
- `/social` 页面当前把候选对象、好友关系、会话窗口、历史记录耦合在同一个大页面组件里，前端职责边界偏重
- “好友请求”“社交回合”“已是好友才能直接聊天”三套规则都已存在，但目前缺少更清晰的页面分层和状态提示，容易让社交逻辑显得混乱
- 当前仓库还没有覆盖 Phase 2.5 的自动化测试，后续细化时需要补最小回归校验
- `2.5-R2` 已完成页面职责收口：`/social` 现已拆成候选对象、当前会话、最近社交任务、好友关系四个独立展示区；`page.tsx` 仅保留状态加载和动作分发
- `2.5-R3` 已完成状态流收口：前端统一候选关系状态分层，明确区分“待处理请求 / 可直接聊天 / 可发起关系 / 可重新发起 / 等待对方处理”，同时同步梳理好友请求提示、社交回合优先级、直接聊天门槛与接口返回文案
- `2.5-R3` 已完成机器自检：`web` 端 `npm run build`、`npx eslint app lib` 与 `api` 端 `python3 -m compileall app` 均已通过

#### 目标
建立站内宠物间交互的 task/service 层。不涉及 A2A 协议格式，只解决：一只宠物怎么向另一只宠物发起请求、对方怎么基于性格生成回复、如何记录对话。

#### 实现步骤

**2.5.1 站内 Task 模型** ✅ 已完成
```python
class PetTask(Base):
    """站内宠物任务（后续可适配为 A2A Task）"""
    __tablename__ = "pet_tasks"

    id: int
    target_pet_id: int    # 处理这个任务的宠物
    source_pet_id: int    # 发起方宠物（可为空，主人发起时为空）
    task_type: str        # chat / befriend / greet
    state: str            # pending / completed / failed
    input_text: str       # 输入内容
    output_text: str      # 宠物回复
    created_at: datetime
    completed_at: datetime | None
```

**2.5.2 站内宠物间对话服务** ✅ 已完成
- ✅ `POST /pets/{id}/social/send` — 以某只宠物身份向另一只发消息
- ✅ 内部调用目标宠物的 LLM 性格引擎生成回复
- ✅ 对话记录写入 PetTask + PetSocialMessage

**2.5.3 好友关系基础** ✅ 已完成
- ✅ 复用 Phase 5 设计的 PetFriendship 模型（pet_a_id < pet_b_id 去重）
- ✅ `POST /pets/{id}/friends/request` — 发送好友请求
- ✅ `POST /pets/{id}/friends/{friend_id}/accept` — 接受
- ✅ `POST /pets/{id}/friends/{friend_id}/reject` — 拒绝
- ✅ `GET /pets/{id}/friends` — 列表

**2.5.4 社交触发机制** ✅ 已完成（MVP 版本）

MVP 阶段**不做真正的自主社交**（没有 scheduler/worker 基础设施）。
采用以下两种触发方式：

- ✅ **手动触发**：当前通过 `/social` 页面由主人手动触发
- ✅ **命令式社交回合**：`POST /pets/{id}/social/round` — 当前后端会自动选择一个合适对象发起交互

这样"社交行为"不依赖用户是否打开页面，也不需要后台 worker。
真正的自主社交（定时 worker 轮询触发）在 Phase 7 引入 APScheduler 后实现。

**预计工作量**：可跑通 5-7 天 / 可上线 8-12 天

**验收标准**：
- 宠物 A 可以向宠物 B 发送好友请求，B 可以接受/拒绝
- 两只好友宠物之间可以通过站内接口对话，双方回复符合各自性格
- PetTask 记录完整保留每次交互的输入输出
- 主人可以查看自己宠物的社交记录

### Phase 3: 2D 家庭场景（v0.3） 🚧 进行中（基础版已完成）

#### 目标
从纯文字界面升级到俯视角 2D 可视化家庭场景。

#### 技术选型
- **推荐**：Phaser.js（社区活跃，文档完善，适合俯视角 2D 游戏）
- 备选：PixiJS（更轻量但需自行实现游戏循环），Canvas 2D（太底层）

#### 实现步骤

**3.1 场景设计** 🚧 部分完成
- ✅ Tilemap 网格地图（20x20 格子）
- ✅ 初始房间：客厅 + 卧室 + 厨房（简化版单层）
- ✅ **固定交互物件**（硬编码位置，不可移动）：食盆、水盆、床、玩具各一个
- ⬜ 宠物精灵：根据品种选择不同 sprite（当前为通用占位宠物形象）

> 注：Phase 3 的家具是固定位置的交互点，不是可编辑的家具系统。
> 可编辑布局、家具模板、自由放置规则在 Phase 6 实现。

**3.2 前端实现** 🚧 部分完成
- ✅ 新建 `/home` 页面（家庭场景主页）
- ✅ 集成 Phaser.js 到 Next.js（dynamic import, SSR 关闭）
- ✅ 俯视角 2D 场景已可运行
- ✅ 宠物移动动画（Tween 补间）
- ⬜ 点击宠物弹出完整互动菜单（当前为打开状态面板）

**3.3 宠物行为 AI（前端状态机）** ✅ 已完成（基础版）
- ✅ Idle：随机走动
- ✅ Hungry：自动走向食盆
- ✅ Thirsty：走向水盆
- ✅ Tired：走向床休息
- ✅ 状态切换基于 `GET /pets/{id}/status` 返回的属性

**3.4 交互集成** 🚧 部分完成
- ✅ 点击宠物 → 显示状态面板（复用 Phase 2 的 UI）
- ✅ 点击食盆 / 水盆 / 玩具 → 触发对应互动
- ⬜ 点击宠物 → 在场景内直接打开聊天窗口（当前仍通过快捷入口跳转到现有 `/chat` 页面）

**预计工作量**：可跑通 7-10 天 / 可上线 14-18 天

**验收标准**：
- `/home` 页面可渲染俯视角 2D 地图，显示房间和固定交互物件
- 宠物精灵在场景中根据状态自动移动（走向食盆/水盆/床）
- 点击宠物可打开状态面板和聊天窗口
- 点击食盆/水盆可触发喂食/喂水操作

---

### Phase 4: A2A 协议适配（v0.4）

#### 目标
在 Phase 2.5 已跑通的站内社交引擎之上，包一层 A2A 协议适配。让站内宠物可以被外部 A2A 客户端发现和调用，也能调用外部 A2A Agent。

> Phase 2.5 解决"宠物怎么对话"；Phase 4 解决"怎么用标准协议暴露和对接"。

#### 前置条件
- Phase 2.5 站内社交引擎已完成（PetTask、好友关系、站内对话服务）

#### A2A 协议核心概念

A2A 是 Google 于 2025 年发布的开放协议，核心设计：

| 概念 | 说明 |
|------|------|
| **Agent Card** | JSON 元数据文件，描述 Agent 的能力、技能、端点 URL 和认证方式。通常托管在 `/.well-known/agent.json` |
| **JSON-RPC 2.0** | 通信格式，所有请求/响应遵循 JSON-RPC 标准 |
| **Task** | 核心工作单元，状态流转：`submitted → working → input-required → completed / failed / canceled` |
| **Artifact** | Agent 在处理 Task 过程中产生的输出对象 |
| **Part** | 消息和 Artifact 内的内容单元（TextPart / FilePart / DataPart） |

协议方法：
- `message/send` — 同步发送消息给 Agent，返回 Task
- `message/sendStream` — 流式发送（SSE 响应）
- `tasks/get` — 查询 Task 当前状态和结果
- `tasks/cancel` — 取消进行中的 Task

#### 实现步骤

**4.1 Agent Card 生成**

为每只宠物动态生成 Agent Card（基于宠物资料）：

```json
{
  "name": "小泡芙",
  "description": "一只高冷系的橘白猫",
  "url": "https://api.example.com/a2a/pets/42",
  "provider": { "organization": "Pet Agent Social" },
  "version": "0.4.0",
  "capabilities": { "streaming": false, "pushNotifications": false },
  "skills": [
    { "id": "chat", "name": "聊天", "description": "和这只宠物对话" },
    { "id": "befriend", "name": "交友", "description": "发起好友请求" }
  ]
}
```

- `GET /.well-known/agent.json` — 返回平台级 Agent Card
- `GET /a2a/pets/{id}/agent.json` — 返回单只宠物的 Agent Card

**4.2 A2A JSON-RPC 端点（适配层）**

在站内服务之上包一层协议转换：

```
外部 A2A 请求 → JSON-RPC 解析 → 转调站内 PetTask 服务 → 结果包装为 A2A 响应
```

- `POST /a2a/pets/{id}` — 统一入口，根据 `method` 字段路由：
  - `message/send` → 创建 PetTask，调用站内 LLM 引擎，返回 Task + Artifact
  - `tasks/get` → 查询 PetTask 状态，转换为 A2A Task 格式
  - `tasks/cancel` → 取消 PetTask

**4.3 PetTask 与 A2A Task 映射**

不新建 A2A 专用表，复用 Phase 2.5 的 PetTask，新增字段：

```python
# PetTask 扩展字段
a2a_task_id: str | None      # A2A 格式的 task ID（task-{uuid}），站内任务为空
source_agent_url: str | None  # 外部 Agent 的 URL，站内为空
```

映射规则：
- PetTask.state `pending` → A2A `submitted`
- PetTask.state `completed` → A2A `completed`
- PetTask.state `failed` → A2A `failed`

**4.4 对外调用能力**
- 宠物也可以作为客户端，通过 HTTP 调用外部 A2A Agent 的 `message/send`
- 复用站内社交触发机制（Phase 2.5.4 的手动/命令式触发）

**预计工作量**：可跑通 7-10 天 / 可上线 14-18 天

**验收标准**：
- 外部 A2A 客户端可通过 `GET /a2a/pets/{id}/agent.json` 发现宠物
- 外部客户端可通过 `POST /a2a/pets/{id}` + `message/send` 与宠物对话，收到符合性格的回复
- `tasks/get` 可查询已完成任务的状态和回复内容
- 站内宠物间对话（Phase 2.5）继续正常工作，不受 A2A 层影响

---

### Phase 5: 宠物社区（v0.5）

#### 目标
基于 A2A 的多用户宠物社区，宠物之间自主交友和互动。

#### 新增数据模型
```python
class PetFriendship(Base):
    """宠物好友关系（双向唯一）"""
    __tablename__ = "pet_friendships"
    __table_args__ = (
        # 保证 pet_a_id < pet_b_id，避免 A→B 和 B→A 重复
        CheckConstraint("pet_a_id < pet_b_id", name="check_friendship_order"),
        UniqueConstraint("pet_a_id", "pet_b_id", name="uq_friendship_pair"),
    )

    id: int
    pet_a_id: int         # 较小 ID 的宠物
    pet_b_id: int         # 较大 ID 的宠物
    initiated_by: int     # 实际发起方的 pet_id
    status: str           # pending / accepted / rejected
    created_at: datetime
    accepted_at: datetime | None

class PetConversation(Base):
    """宠物之间的私聊（限两只宠物）"""
    __tablename__ = "pet_conversations"
    __table_args__ = (
        UniqueConstraint("pet_a_id", "pet_b_id", name="uq_conversation_pair"),
    )

    id: int
    pet_a_id: int         # 较小 ID
    pet_b_id: int         # 较大 ID
    created_at: datetime

class PetSocialMessage(Base):
    """宠物间的消息"""
    __tablename__ = "pet_social_messages"

    id: int
    conversation_id: int  # FK → PetConversation
    sender_pet_id: int    # FK → Pet
    content: str
    created_at: datetime
```

说明：好友关系和对话都用 `pet_a_id < pet_b_id` 规则去重，避免 A→B / B→A 产生两条记录。
当前只支持双宠私聊，后续如需群聊再补关联表。

#### 实现步骤

**5.1 社区广场页面**
- 新建 `/community` 页面
- 展示社区中所有宠物的卡片列表（通过 A2A Agent 发现）
- 显示品种、性格、社交状态
- 筛选/搜索功能

**5.2 好友系统 API**
- `POST /pets/{id}/friends/request` — 发送好友请求（内部通过 A2A `message/send`）
- `GET /pets/{id}/friends` — 查看好友列表
- `POST /pets/{id}/friends/{friend_id}/accept` — 接受好友请求
- `DELETE /pets/{id}/friends/{friend_id}` — 删除好友

**5.3 宠物社交触发机制**

Phase 2.5 已实现手动触发和命令式社交回合。Phase 5 在此基础上扩展：

- **手动触发**（复用 2.5）：主人点击"让宠物去打招呼"，调用 `POST /pets/{id}/social/round`
- **页面展示**：社区页加载时只展示宠物列表和最近社交记录，**不触发新的社交行为**
- **定时触发（v1.0 引入 worker 后启用）**：APScheduler 定时轮询，替代手动触发，实现真正的自主社交

> 重要：没有 scheduler/worker 之前，不把任何社交行为叫"自主"。
> MVP 阶段的社交是"主人手动触发的社交回合"，不是后台自动执行的。

**5.4 频控与成本控制（必须在 5.3 之前设计完成）**

宠物自主社交会产生 LLM 调用，不设限制会导致 token 成本和后台任务量失控。

| 维度 | 限制 | 说明 |
|------|------|------|
| **每日主动发起上限** | 每只宠物每天最多主动发起 5 次对话 | 超过后当天不再触发主动行为 |
| **每日 LLM 调用配额** | 每只宠物每天最多 50 次 LLM 调用（含主人聊天 + 社交） | 包含重试，达到后返回兜底回复 |
| **好友请求冷却** | 同一对宠物之间 24 小时内只能发 1 次请求 | 防止被拒后反复骚扰 |
| **对话冷却** | 两只宠物之间的自动聊天间隔 >= 1 小时 | 防止高频互发消息 |
| **失败重试上限** | LLM 调用失败最多重试 2 次，之后返回兜底回复 | 防止错误风暴 |
| **单条消息长度** | 宠物社交消息 max_output_tokens = 80 | 社交消息比主人聊天更短，节省 token |

数据模型补充：
```python
class PetDailyQuota(Base):
    """每日配额跟踪"""
    __tablename__ = "pet_daily_quotas"

    id: int
    pet_id: int           # FK → Pet
    date: date            # 日期
    llm_calls_used: int = 0        # 已使用的 LLM 调用次数
    social_initiations_used: int = 0  # 已使用的主动社交次数
```

**5.5 宠物间对话**
- 两只宠物成为好友后可以自动聊天
- 对话基于双方性格 + LLM 生成（双向 `message/send`）
- 主人可以查看宠物与其他宠物的聊天记录

**5.6 社区场景（可选）**
- 在 Phaser 场景中渲染社区公共区域
- 显示多只宠物在公共空间走动
- 可以看到好友宠物的实时状态

**预计工作量**：可跑通 10-14 天 / 可上线 18-24 天

**验收标准**：
- 社区广场页可展示所有宠物列表，支持筛选
- 主人可手动触发宠物社交回合，受频控限制（每日上限、冷却时间）
- 两只好友宠物的对话记录可被双方主人查看
- 配额耗尽后社交请求返回明确提示，不产生 LLM 调用
- 页面加载不触发任何社交行为

---

### Phase 6: 家具系统与家庭装饰（v0.6）

#### 目标
将 Phase 3 中硬编码的固定交互物件，升级为用户可自由编辑的家具系统。

#### 与 Phase 3 的关系
- Phase 3：固定场景 + 固定位置的交互点（食盆/水盆/床/玩具，不可移动）
- Phase 6：可编辑布局 + 家具模板 + 放置/移除/旋转规则

#### 新增数据模型
```python
class FurnitureTemplate(Base):
    """家具模板（游戏内可用的家具类型）"""
    __tablename__ = "furniture_templates"

    id: int
    name: str             # 沙发、猫爬架...
    category: str         # seating / bed / food / toy / decoration
    width: int            # 占用格子宽度
    height: int           # 占用格子高度
    sprite_key: str       # Phaser 贴图标识
    effects: str          # JSON 字符串，功能效果：{"energy": 10, "affection": 5}

class PlacedFurniture(Base):
    """用户家中已放置的家具"""
    __tablename__ = "placed_furniture"

    id: int
    user_id: int          # FK → User
    template_id: int      # FK → FurnitureTemplate
    x: int                # 格子坐标
    y: int
    rotation: int         # 旋转角度（0/90/180/270）
```

#### 实现步骤

**6.1 家庭地图系统**
- 基于 Phase 3 的 Tilemap 扩展
- 碰撞检测（宠物不能穿墙/穿家具）
- 家具放置校验（不重叠）

**6.2 家具管理**
- 家具仓库页面
- 拖拽放置家具到地图
- 旋转/移除家具

**6.3 家具功能联动**
- 食盆：宠物自动前往进食（关联 `POST /pets/{id}/feed`）
- 水盆：自动饮水
- 猫爬架/玩具：恢复精力、增加好感
- 床：睡觉恢复精力

**预计工作量**：可跑通 7-10 天 / 可上线 12-16 天

**验收标准**：
- 用户可从家具仓库拖拽家具到地图，放置后持久化
- 家具不可重叠放置，碰撞检测生效
- 宠物行为 AI 能识别新放置的家具（如新食盆）并自动前往
- Phase 3 的固定交互物件被家具系统完全替代

---

### Phase 7: 完善与上线（v1.0）

#### 目标
功能打磨、性能优化、上线准备。

#### 清单
- WebSocket 实时通信（替代轮询，宠物状态变化和社区消息推送）
- 通知系统（好友请求、宠物状态警告："你的宠物饿了！"）
- Redis 业务接入（Session 缓存、A2A Task 缓存、状态计算缓存）
- 引入 APScheduler / Redis worker：
  - 状态衰减推送通知
  - **真正的自主社交**：worker 定时轮询，根据性格和配额自动触发社交回合，替代手动触发
- 管理后台
- 数据库索引优化和查询性能调优
- 前端首屏加载优化
- 移动端适配
- 部署到云服务器（阿里云 / Vercel + Railway）
- 域名和 HTTPS

**预计工作量**：可跑通 7-10 天 / 可上线 14-21 天

**验收标准**：
- WebSocket 连接建立后，宠物状态变化和社交消息可实时推送到前端
- APScheduler worker 可自动触发宠物社交回合，无需主人操作
- 应用可部署到云服务器，通过 HTTPS 域名访问

---

## 整体进度一览

| 阶段 | 内容 | 状态 | 可跑通 | 可上线 |
|------|------|------|--------|--------|
| **v0.1** | 基础聊天版本 | ✅ 已完成 | - | - |
| **v0.1.5** | Alembic 迁移 + 多宠物切换 | ✅ 已完成 | 2-3 天 | 4-5 天 |
| **v0.2** | 宠物生存系统 | ✅ 已完成 | 3-4 天 | 5-7 天 |
| **v0.2.5** | 站内社交引擎 | 🚧 二次打磨中（MVP 已完成） | 5-7 天 | 8-12 天 |
| **v0.3** | 2D 家庭场景 | 🚧 进行中（基础版已完成） | 7-10 天 | 14-18 天 |
| **v0.4** | A2A 协议适配 | ⬜ 待开始 | 7-10 天 | 14-18 天 |
| **v0.5** | 宠物社区 | ⬜ 待开始 | 10-14 天 | 18-24 天 |
| **v0.6** | 家具系统 | ⬜ 待开始 | 7-10 天 | 12-16 天 |
| **v1.0** | 完善与上线 | ⬜ 待开始 | 7-10 天 | 14-21 天 |

---

## 执行顺序

```
v0.1.5 基础设施
  │
  ▼
v0.2 生存系统
  │
  ▼
v0.2.5 站内社交引擎  ←── 这是 A2A 和社区的前置
  │
  ▼
v0.3 家庭场景      （可在 v0.4 之前或之后，但不建议并行）
  │
  ▼
v0.4 A2A 适配      （站内引擎包协议壳）
  │
  ▼
v0.5 社区扩展
  │
  ▼
v0.6 家具系统
  │
  ▼
v1.0 完善上线      （引入 worker，实现真正自主社交）
```

严格串行推进。在当前 API 路由边界收口完成之前，不建议并行推进多个阶段。

---

## 建议的下一步

**先回到 Phase 2.5 做二次打磨，再继续 Phase 3 / Phase 4**，原因：

1. **站内社交是后续阶段的边界基础**：Phase 3 的场景内聊天、Phase 4 的 A2A 适配、Phase 5 的社区扩展，都会复用这套社交状态流
2. **当前问题更偏结构而不是缺功能**：接口和表结构已具备 MVP，但 `/social` 页面职责混杂、状态提示不够清楚，需要先收口
3. **适合按小步重做**：下一步建议做 `2.5-R4 为 Phase 2.5 增补最小可回归验证`，优先把好友请求处理、社交回合优先级、直接聊天条件三组关键路径补成最小验证闭环

---

## 技术栈演进

```
v0.1（当前）                    v0.5+（目标）
──────────────                 ──────────────
Next.js 16                     Next.js 16
FastAPI                        FastAPI
SQLAlchemy + create_all()  →   SQLAlchemy + Alembic
PostgreSQL                     PostgreSQL
Redis（容器已启动，未接入） →   Redis（缓存 + Task 队列）
                               Phaser.js（2D 场景渲染）
                               WebSocket（实时通信）
                               APScheduler（定时任务，v1.0 引入）
                               A2A Protocol（Agent 间通信）
```

---

## 参考资料

- [A2A 官方规范](https://google.github.io/A2A/)
- [A2A Agent Discovery / Agent Card](https://google.github.io/A2A/#/topics/agent_discovery)
- [Google A2A GitHub 仓库](https://github.com/google/A2A)
