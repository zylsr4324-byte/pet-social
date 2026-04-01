# 下一步实施方案

> 生成时间：2026-03-30
> 按优先级排列，逐步实施

---

## 阶段 A：真正自主社交（APScheduler Worker）

### 当前问题
- 社交回合只能主人手动触发（`POST /pets/{id}/social/round`）
- `startup.py` 是空函数，没有后台任务
- `requirements.txt` 没有 APScheduler

### 改动文件
| 文件 | 改动内容 |
|------|---------|
| `api/requirements.txt` | 添加 `apscheduler>=3.10` |
| `api/app/startup.py` | 启动 BackgroundScheduler，注册两个定时任务 |
| `api/app/services/auto_social.py` | 新建：自主社交 worker 逻辑 |
| `api/app/main.py` | 在 lifespan 中启动/关闭 scheduler |

### 两个定时任务
1. **状态衰减**：每 10 分钟，对所有活跃宠物执行 decay
2. **自主社交**：每 30 分钟，随机选满足条件的宠物发起社交回合

### 自主社交触发条件
- 宠物有已接受的好友
- 今日 `social_initiations_used < 3`
- mood 不是 `uncomfortable`
- 每只宠物 40% 随机概率参与本轮

---

## 阶段 B：宠物管理 UI（多宠物创建 + 删除）

### 当前问题
- 后端无 `DELETE /pets/{id}` 接口
- 前端 `create-pet` 页每次覆盖同一只宠物（无法新建第二只）
- 无宠物列表管理页

### 改动文件
| 文件 | 改动内容 |
|------|---------|
| `api/app/api/routes/pets.py` | 添加 `DELETE /pets/{pet_id}` 接口（级联删除消息、任务、配额等） |
| `api/app/schemas.py` | 添加 `PetDeleteResponse` |
| `web/app/create-pet/page.tsx` | 改造：顶部加「我的宠物列表」，支持「新建宠物」和「删除宠物」操作 |
| `web/lib/pet.ts` | 添加 `deletePet(id, token)` 函数 |

### 交互设计
- 页面顶部：横向列出当前用户所有宠物卡片（来自 `GET /pets`）
- 每张卡片右上角有「删除」按钮（二次确认）
- 右下角有「+ 新建宠物」按钮，点击清空表单创建新宠物
- 创建成功后自动切换到新宠物

---

## 阶段 C：家庭场景视觉升级

### 当前问题
- Phaser 场景用纯色矩形表示房间和物品，无细节
- 宠物是简单的几何形状（圆形 body + 三角 ear）
- 互动反馈只有场景通知文字，无动画

### 改动文件
| 文件 | 改动内容 |
|------|---------|
| `web/lib/PetHomeScene.tsx` | 场景视觉升级：房间边界线/地板纹理/阴影/家具图标 |
| `web/lib/home-scene.ts` | 调整房间布局常量，添加装饰物件坐标 |
| `web/lib/PetHomeScene.tsx` | 宠物精灵升级：添加眼睛、嘴巴、心情表情；行走时左右摇摆动画 |
| `web/lib/PetHomeScene.tsx` | 互动升级：点击物件时出现涟漪动画 + 浮动 emoji（🍖💧🎾💤）|

### 具体视觉改动
1. **地板**：用 Phaser Graphics 画网格线（浅色），区分不同房间区域
2. **房间标签**：客厅/卧室/厨房 文字标签显示在房间中央
3. **宠物**：在现有几何体上叠加眼睛（两个小圆）、嘴巴（arc）、根据 mood 显示不同表情
4. **互动动画**：点击食盆/水盆/床/玩具时，从物件位置飘出对应 emoji，1秒内上升淡出
5. **宠物走动**：移动时宠物轻微左右摇摆（sinusoidal scale X）

---

## 实施顺序

```
阶段 A（自主社交） → 阶段 B（宠物管理 UI） → 阶段 C（场景视觉）
```

每阶段完成后跑一次 `pytest` + `tsc --noEmit` 验证。
