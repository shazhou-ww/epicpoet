# 长篇小说辅助创作工具 — 需求文档 v0.1

> 状态：草案 | 作者：小橘 🍊 | 日期：2026-03-28

## 1. 概述

### 1.1 一句话描述
一个 CLI 工具 + OpenClaw Skill，帮助 AI Agent 与用户协作创作具有复杂世界观的长篇小说，解决 AI 线性记忆无法支撑非线性叙事的核心问题。

### 1.2 核心痛点
- AI 的 session 记忆是线性的，无法处理倒叙、插叙
- 角色会"知道"不该知道的信息（未来的、未经历的）
- 世界观越写越乱，设定前后矛盾
- 现有 AI 写故事工具只能流水账，无法系统性管理复杂叙事

### 1.3 解决方案
- **结构化世界观数据**：角色、地点、事件、概念等以文件形式管理，可 git 版本控制
- **时间-信息可见性引擎**：基于 epoch 时间系统，精确推算每个角色在每个时间点"知道什么"
- **Skill 集成**：作为 OpenClaw Skill，让 AI Agent 在创作时自动查询世界观、遵守信息约束

### 1.4 不是什么
- ❌ 不是一个新的 AI Agent
- ❌ 不是一个独立的写作 APP
- ✅ 是一个 CLI 工具 + Skill，辅助现有 AI（如 OpenClaw）进行创作

### 1.5 目标用户
- 会使用 AI 工具但没有技术背景的写作者
- 先自用，后开源

## 2. 核心概念模型

### 2.1 实体层级

```
Universe（宇宙/作品集）
├── Setting（世界设定）
│   ├── TimeSystem（时间体系）
│   ├── Location（地点，可嵌套）
│   ├── Concept（概念：魔法体系、政治制度...）
│   └── Item（重要事物：神器、飞船...）
├── Character（角色）
│   ├── 基本信息（名字、描述、特征）
│   ├── 关系网络（与其他角色的关系）
│   └── 知识状态（在某时间点知道哪些事件）
├── Event（事件）
│   ├── 时间（epoch）
│   ├── 地点
│   ├── 参与者
│   ├── 可见性（public / participants / custom）
│   └── 描述
├── Scene（情节）= 原子叙事单元
│   ├── 对应事件
│   ├── 时间
│   ├── 地点
│   ├── POV（视角：角色名 或 narrator）
│   ├── 参与角色
│   └── 正文（markdown）
└── Chapter（章节）= 情节的有序组合
    └── scenes: [scene-001, scene-003, scene-002]  # 叙事顺序≠时间顺序
```

### 2.2 关键关系

```
Event ──0..n──→ Scene（一个事件可被多个情节从不同视角叙述）
Scene ──1──→ Event（每个情节对应一个事件）
Chapter ──n──→ Scene（章节是情节的编排）
Character ──knows──→ Event（角色的信息可见性）
```

### 2.3 时间系统

- 使用 **epoch 秒**作为统一时间格式
- 每个 Universe 定义一个 `epoch_zero`：
  - 写实风格：Unix epoch（1970-01-01T00:00:00Z）
  - 虚构风格：自定义零点（如"太阳纪元元年"= epoch 0）
- 提供人类可读的时间显示转换
- 精确到秒

### 2.4 信息可见性模型

角色在时间 T 知道事件 E 的条件（满足任一）：
1. **公开事件**：`E.visibility == "public"` 且 `E.time <= T`
2. **参与者**：角色是 `E.participants` 之一 且 `E.time <= T`
3. **显式指定**：存在记录 `Character.learns(E, at_time)`（某人在某时刻得知了某事）

## 3. 项目文件结构

```
my-novel/
├── universe.yaml              # 宇宙元数据（名称、时间体系、简介）
├── characters/
│   ├── harry-potter.yaml
│   ├── hermione.yaml
│   └── dumbledore.yaml
├── locations/
│   ├── hogwarts.yaml
│   └── hogwarts/
│       ├── great-hall.yaml
│       └── chamber-of-secrets.yaml
├── concepts/
│   ├── magic-system.yaml
│   └── houses.yaml
├── items/
│   └── elder-wand.yaml
├── events/
│   ├── evt-001-sorting-ceremony.yaml
│   ├── evt-002-troll-attack.yaml
│   └── ...
├── scenes/
│   ├── scn-001-harry-sorting.md      # 情节文件（frontmatter + 正文）
│   ├── scn-002-troll-in-dungeon.md
│   └── ...
├── chapters/
│   ├── ch-01.yaml                    # 章节 = 情节编排
│   └── ch-02.yaml
└── .epicpoet/                         # gitignore
    ├── index.sqlite                   # 索引数据库
    └── index.version                  # 对应的 git commit hash
```

## 4. EPIC 分解

### EPIC 1：项目管理（CLI 基础）

| 需求 | 描述 | 优先级 |
|------|------|--------|
| R1.1 | `novel init` 初始化项目，交互式设定时间体系 | Must |
| R1.2 | `novel status` 查看项目概览（角色数、事件数、情节数、字数） | Should |
| R1.3 | 纯文件存储，git 友好 | Must |
| R1.4 | SQLite 索引：基于 git diff 增量更新，与 commit 版本对应，remote pull 后自动同步差异 | Must |

### EPIC 2：世界观管理

| 需求 | 描述 | 优先级 |
|------|------|--------|
| R2.1 | 角色 CRUD（对话式采集 + 文件存储） | Must |
| R2.2 | 地点管理（支持嵌套层级） | Must |
| R2.3 | 事件管理（时间、地点、参与者、可见性） | Must |
| R2.4 | 概念/设定管理（魔法体系、种族、制度等） | Should |
| R2.5 | 事物/道具管理 | Should |
| R2.6 | 角色关系网络 | Should |
| R2.7 | 信息可见性管理：显式指定"角色X在时间T得知事件E" | Must |

### EPIC 3：创作引擎

| 需求 | 描述 | 优先级 |
|------|------|--------|
| R3.1 | 创作新情节：指定时间、地点、角色、POV | Must |
| R3.2 | 创作前自动推算 POV 角色已知信息，展示给 AI 和用户确认 | Must |
| R3.3 | 用户提供梗概/方向，AI 生成情节正文 | Must |
| R3.4 | 用户可指定文风要求 | Should |
| R3.5 | 情节生成后自动创建对应事件（如果还没有） | Should |
| R3.6 | 章节编排：将情节组合成章节 | Must |

### EPIC 4：查询与一致性

| 需求 | 描述 | 优先级 |
|------|------|--------|
| R4.1 | 查询角色在指定时间点的已知信息 | Must |
| R4.2 | 按时间线查看所有事件 | Should |
| R4.3 | 按角色查看其经历的事件 | Should |
| R4.4 | 一致性检查：检测情节中是否有角色"知道"不该知道的信息 | Could |

### EPIC 5：OpenClaw Skill 集成

| 需求 | 描述 | 优先级 |
|------|------|--------|
| R5.1 | SKILL.md：定义 AI 何时/如何使用此工具 | Must |
| R5.2 | AI 对话式世界观录入（"我要加个角色"→ AI 采集信息 → CLI 录入） | Must |
| R5.3 | AI 创作时自动调用 CLI 查询上下文 | Must |
| R5.4 | AI 创作完成后自动保存情节文件 | Must |

## 5. 用户故事

### 世界观管理

**US-2.1** 作为创作者，我想通过跟 AI 对话来添加角色，这样我不用自己写 YAML 文件。
```
Given 用户说"我想加一个新角色"
When AI 通过对话采集角色信息（名字、背景、特征等）
Then CLI 生成 characters/xxx.yaml 文件
```

**US-2.3** 作为创作者，我想记录一个世界观事件（还没写成情节），这样后续创作时 AI 知道发生过什么。
```
Given 用户说"在太阳纪元第3年，南方爆发了瘟疫"
When AI 采集事件细节（时间、地点、参与者、可见性）
Then CLI 生成 events/xxx.yaml 文件
```

**US-2.7** 作为创作者，我想指定某个角色在某个时间得知了某件事，这样 AI 写他的视角时会知道这个信息。
```
Given 用户说"艾拉在第5年通过信使得知了南方瘟疫"
When CLI 记录 learns(艾拉, evt-瘟疫, time=第5年)
Then 之后以艾拉视角写第5年之后的故事时，AI 知道她已知道瘟疫
```

### 创作

**US-3.1** 作为创作者，我想写一段新情节，AI 应该在正确的信息约束下帮我写。
```
Given 用户指定时间=第3年春, 地点=北方要塞, POV=艾拉
When CLI 查询艾拉在第3年春已知的所有信息
Then AI 展示信息列表，用户确认后，AI 基于此背景和用户的梗概生成情节
And 情节保存为 scenes/xxx.md，对应事件保存为 events/xxx.yaml
```

**US-3.6** 作为创作者，我想把写好的情节编排成章节，叙事顺序可以和时间顺序不同。
```
Given 存在多个已完成的情节
When 用户指定 "第一章包含 scn-005, scn-001, scn-003"
Then CLI 生成 chapters/ch-01.yaml，按用户指定顺序编排
```

## 6. 技术约束

| 项目 | 选择 | 原因 |
|------|------|------|
| 语言 | Node.js (TypeScript) | 与 OpenClaw 生态一致 |
| 存储 | 纯文件（YAML 元数据 + Markdown 正文） | Git 友好，可版本控制 |
| 索引 | SQLite（.gitignore），基于 git diff 增量更新 | 高效查询 + git 友好 |
| 发布 | npm 包 | `npx epicpoet init` 即可使用 |
| Skill | OpenClaw AgentSkill 格式 | SKILL.md + references/ |

## 7. 未来扩展（不在 v1 范围）

- 多 Universe 支持（共享世界观的系列作品）
- 角色性格模型（AI 写对话时保持角色一致性）
- 冲突检测（自动发现时间线矛盾）
- 导出 epub/pdf
- Web UI 可视化时间线
- 协作模式（多人共建世界观）

## 8. 命名

**EpicPoet** — 史诗诗人 🎭

---

*下一步：主人确认/修改此文档后，开始技术设计 + 原型开发*
