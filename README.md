# Pet Agent Social

一个宠物 Agent 社交网页项目。

## 项目目标

这个项目希望实现：

- 每个用户一开始拥有 1 只宠物
- 每只宠物本质上是一个 Agent
- 用户可以和自己的宠物聊天
- 宠物之间可以互相交流、讨论、社交
- 后期支持一个用户拥有多只宠物
- 后期支持更具体的宠物外貌展示，例如颜色、品种、大小和个体特征

## 第一阶段目标

第一阶段先完成：

- 项目基础骨架
- 前端和后端项目初始化
- 用户可以创建一只宠物
- 宠物有基础资料
- 宠物可以和主人聊天

## 当前进度

- 已创建项目目录
- 已初始化 Git
- 已创建 web / api / docs 基础结构

## 后端本地启动

后端当前是最小 FastAPI 骨架，并已准备好 PostgreSQL 和 Redis 的本地开发环境。

1. 在项目根目录执行 `docker compose up --build`
2. 打开 `http://localhost:8000/health` 查看后端健康状态
3. 打开 `http://localhost:8000/docs` 查看 FastAPI 自动文档
4. 在 `/docs` 里直接测试 `POST /pets`、`GET /pets/{pet_id}`、`PUT /pets/{pet_id}`
