---
name: epicpoet
description: "辅助 AI 创作长篇小说。当用户想要创作故事、管理世界观、添加角色/事件、查询角色已知信息时使用。"
---

# EpicPoet 🎭 — 长篇小说辅助创作

## 何时使用
- 用户说"我想写个故事/小说"
- 用户说"加个角色/事件/地点"
- 用户说"从XX的视角写一段"
- 用户说"XX在这个时间点知道什么"

## 工作流

### 开始新项目
1. 运行 `epicpoet init` 初始化
2. 通过对话采集世界观设定，使用 `epicpoet add` 命令录入

### 管理世界观
- 添加角色：`epicpoet add character --name "名字" --description "描述" --traits "特征"`
- 添加事件：`epicpoet add event --name "事件名" --time <epoch> --location "地点" --participants "角色1,角色2" --visibility public|participants --description "描述"`
- 添加地点：`epicpoet add location --name "地点名" --description "描述"`
- 嵌套地点：`epicpoet add location --name "子地点" --parent "父地点id" --description "描述"`

### 创作情节
1. 用户指定时间、地点、视角角色
2. 运行 `epicpoet write --time <epoch> --location "地点" --pov "角色" --participants "角色列表" --synopsis "梗概"`
3. 工具输出：角色已知信息 + 结构化 prompt
4. AI 基于此 prompt 生成情节正文
5. 将正文写入场景文件

### 章节编排
- 创建章节：`epicpoet chapter create --name "第一章" --scenes scn-001,scn-003,scn-002`
- 列出章节：`epicpoet chapter list`
- 展示章节：`epicpoet chapter show <chapter-id>`

### 查询
- 角色知识：`epicpoet query knowledge <角色> --at <epoch>`
- 时间线：`epicpoet query timeline [--character <角色>] [--from <epoch>] [--to <epoch>]`
- 项目状态：`epicpoet status`

## 重要规则
- 写作时必须遵守信息可见性约束
- POV 角色只能知道和表达他已知的信息
- narrator（全知视角）可以知道所有已发生的事件
- 不要让角色"预知"未来事件
