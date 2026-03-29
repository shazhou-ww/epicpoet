# EpicPoet 🎭 — 交互式叙事引擎 · 需求文档 v0.2

> 状态：草案 | 作者：小橘 🍊 | 日期：2026-03-29
> v0.1 → v0.2 变更：从"写作辅助 CLI"升级为"交互式叙事引擎"，新增 Stage 虚拟舞台系统、Subagent 小队分工、楚门模式

## 1. 概述

### 1.1 一句话描述
一个交互式叙事引擎（CLI + Skill 套件），通过结构化世界观管理、时间-信息可见性引擎和虚拟舞台系统，让 AI Agent 小队与用户协作创作具有复杂世界观的长篇小说。

### 1.2 核心痛点
- AI 的 session 记忆是线性的，无法处理倒叙、插叙
- 角色会"知道"不该知道的信息（未来的、未经历的）
- 世界观越写越乱，设定前后矛盾
- AI 写的对话千人一面，缺乏角色区分度
- 现有 AI 写故事工具只能流水账，无法系统性管理复杂叙事

### 1.3 解决方案
- **结构化世界观数据**：角色、地点、事件、概念等以文件形式管理，git 版本控制
- **时间-信息可见性引擎**：基于 epoch 时间系统，精确推算每个角色在每个时间点"知道什么"
- **虚拟舞台系统（Stage）**：消息路由总线，多个 AI Agent 各自扮演角色进行即兴交互，信息分发由确定性脚本逻辑控制
- **Skill 套件**：一组 OpenClaw Skill，分别服务导演（协调者）、演员（Subagent）等不同角色
- **楚门模式**：用户可沉浸在世界中作为角色行动，也可随时跳出调整设定和方向

### 1.4 是什么 / 不是什么
- ✅ 是一个 CLI 工具（epicpoet）— 世界观管理和虚拟舞台的底层基础设施
- ✅ 是一组 OpenClaw Skill — 指导不同 AI 角色如何使用工具
- ✅ 是一个交互式叙事引擎 — 支持"演"出故事而不仅仅是"写"
- ❌ 不是一个新的 AI Agent
- ❌ 不是一个独立的写作 APP
- ❌ 不是一个游戏引擎（没有图形/物理/战斗系统）

### 1.5 目标用户
- 会使用 AI 工具的写作者（不需要技术背景）
- AI Agent 协调者（如 OpenClaw 主 agent）
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
│   ├── 时间、地点、POV、参与角色
│   └── 正文（markdown）
├── Chapter（章节）= 情节的有序组合
│   └── scenes: [scn-005, scn-001, scn-003]  # 叙事顺序≠时间顺序
└── Stage（虚拟舞台）= 实时交互场景
    ├── 场景参数（时间、地点、演员及空间关系）
    ├── 消息日志（say/whisper/act/think）
    └── 消息路由规则（确定性逻辑）
```

### 2.2 关键关系

```
Event ──0..n──→ Scene（一个事件可被多个情节从不同视角叙述）
Scene ──1──→ Event（每个情节对应一个事件）
Chapter ──n──→ Scene（章节是情节的编排）
Character ──knows──→ Event（角色的信息可见性）
Stage ──produces──→ Scene（舞台交互可转化为情节）
Stage ──updates──→ Character.knows（舞台交互自动更新角色认知）
```

### 2.3 时间系统

- 使用 **epoch 秒**作为统一时间格式
- 每个 Universe 定义一个 `epoch_zero`：
  - 写实风格：Unix epoch（1970-01-01T00:00:00Z）
  - 虚构风格：自定义零点（如"灵历元年"= epoch 0）
- 提供人类可读的时间显示转换
- 精确到秒

### 2.4 信息可见性模型

角色在时间 T 知道事件 E 的条件（满足任一）：
1. **公开事件**：`E.visibility == "public"` 且 `E.time <= T`
2. **参与者**：角色是 `E.participants` 之一 且 `E.time <= T`
3. **显式指定**：存在记录 `Character.learns(E, at_time)`
4. **舞台交互**：角色在 Stage 中收到了包含该信息的消息（stage close 时自动记录）

### 2.5 虚拟舞台（Stage）模型

#### 消息类型与路由

| 类型 | 语义 | 路由规则 |
|------|------|---------|
| say (normal) | 正常说话 | 面对面 ✓、同区域 ✓、暗处旁观 ✓、远处 ✗、隔墙 ✗ |
| say (loud) | 大声喊话 | 所有位置 ✓ |
| say (quiet) | 低声说话 | 面对面 ✓、暗处旁观 ✓，其他 ✗ |
| whisper | 耳语 | 仅指定对象 |
| act | 动作 | 面对面 ✓、同区域 ✓、暗处旁观 ✓、远处 ✗、隔墙 ✗ |
| think | 内心独白 | 无人感知 |

#### 空间关系标签
- `面对面` — 可见可听
- `同区域` — 可听，动作可见
- `暗处旁观` — 可听可见，但其存在不被他人感知
- `远处` — 仅能听到大声喊话
- `隔墙` — 只能听到声音，看不到动作

#### 关键原则
- **消息路由是确定性脚本逻辑**，不是 AI 判断
- 演员 agent 只能通过 stage 命令交互，不能直接对话
- stage close 自动将交互结果写入 events/learns 系统

## 3. 项目文件结构

```
my-novel/
├── universe.yaml              # 宇宙元数据
├── characters/                # 文件名直接用原始名称（中文OK）
│   ├── 慕容轩.yaml
│   └── 林雪瑶.yaml
├── locations/
│   └── 玄冰宗.yaml
├── concepts/
│   └── 修炼境界.yaml
├── items/
│   └── 寒冰剑.yaml
├── events/
│   ├── evt-001-九州大战.yaml
│   └── evt-002-密林相遇.yaml
├── scenes/
│   └── scn-001-密林相遇.md    # frontmatter + 正文
├── chapters/
│   └── ch-01-第一章.yaml       # 情节编排
└── .epicpoet/                  # gitignore
    ├── index.sqlite            # 索引数据库
    ├── index.version           # git commit hash
    └── stage.json              # 当前舞台状态（临时）
```

## 4. Subagent 小队分工

EpicPoet 设计为由多个 AI Agent 协作使用，各司其职：

| 角色 | 职责 | Spawn 方式 | 模型偏好 | 对应 Skill |
|------|------|-----------|---------|-----------|
| 🎬 **导演** | 接收用户意图、调度其他角色、运行 Stage、最终审核 | 协调者自己 | — | epicpoet-conductor |
| 📖 **设定师** | 世界观构建和维护，Story Bible 守护者 | 按需 spawn | 知识型（Opus） | epicpoet（标准） |
| 📐 **编剧** | 剧情结构、事件链、人物弧光、伏笔回收 | 按需 spawn | 逻辑型（Opus/Sonnet） | epicpoet（标准） |
| 🎭 **演员 × N** | 代入角色，通过 Stage 即兴交互 | 每角色一个，动态 spawn | 角色扮演型 | epicpoet-actor |
| ✍️ **写手** | 把 Stage 日志/write prompt 整理成文学正文 | 按需 spawn | 创作型（Sonnet） | epicpoet（标准） |
| 🔍 **审校** | 一致性检查，设定矛盾检测，信息可见性违规检测 | 按需 spawn | 严谨型（Opus） | epicpoet（标准） |

### 灵感来源
- TV 编剧室：Showrunner → Head Writer → Story Editor → Staff Writer → Script Coordinator
- 游戏叙事团队：Narrative Director → Lore Master → Quest Designer → Game Writer
- 即兴剧场 / TTRPG：GM 设定场景 → 玩家扮演角色推动剧情

## 5. 用户体验模式

### 5.1 楚门模式（沉浸式）

用户作为一个角色沉浸在世界中，导演在幕后编排：

```
用户（沉浸中）："前面那个老头是谁？"
  → 演员 agent 基于角色已知信息回应

用户（跳出来）："/meta 让那个老头其实是主角失散多年的师父"
  → 导演收到指令，更新设定，通知相关演员调整

用户（回去沉浸）："老人家，你看起来很面熟..."
  → 演员按新设定演绎
```

### 5.2 导演模式（传统创作）

用户作为导演，直接指挥创作：

```
用户："写一场慕容轩和林雪瑶在密林中的相遇"
  → 编剧设计场景大纲
  → 导演开启 Stage，spawn 演员
  → 演员即兴交互
  → 写手整理成正文
  → 审校检查一致性
  → 展示给用户审核
```

### 5.3 世界观构建模式

用户和设定师协作搭建世界：

```
用户："借鉴凡人修仙传的世界观"
  → 设定师（大模型）基于知识，分批调用 epicpoet add 录入
  → 每批展示给用户确认/调整
  → 逐步细化直到用户满意
```

## 6. EPIC 分解

### EPIC 1：CLI 基础设施（已完成 ✅）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R1.1 | `epicpoet init` 初始化项目 | Must | ✅ |
| R1.2 | `epicpoet status` 项目概览 | Should | ✅ |
| R1.3 | 纯文件存储（YAML + MD），文件名用原始名称 | Must | ✅ |
| R1.4 | SQLite 索引，CLI 无状态 | Must | ✅ |
| R1.5 | `epicpoet sync` 文件 → SQLite 同步 | Must | ✅ |
| R1.6 | `epicpoet show/list` 查看实体 | Must | ✅ |
| R1.7 | `epicpoet edit/delete` 修改/删除实体 | Must | ✅ |

### EPIC 2：世界观管理（已完成 ✅）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R2.1 | `epicpoet add character` 角色管理 | Must | ✅ |
| R2.2 | `epicpoet add location` 地点管理（支持嵌套） | Must | ✅ |
| R2.3 | `epicpoet add event` 事件管理（时间、地点、参与者、可见性） | Must | ✅ |
| R2.4 | `epicpoet add concept` 概念/设定管理 | Should | ✅ |
| R2.5 | `epicpoet add item` 事物/道具管理 | Should | ✅ |
| R2.6 | 角色关系网络 | Should | 未开始 |
| R2.7 | 信息可见性管理（learns 记录，自动+手动） | Must | ✅ |

### EPIC 3：创作引擎（已完成 ✅）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R3.1 | `epicpoet write` 生成带信息约束的 AI prompt | Must | ✅ |
| R3.2 | 创作前自动推算 POV 角色已知信息 | Must | ✅ |
| R3.3 | 支持指定梗概和文风 | Should | ✅ |
| R3.4 | `epicpoet chapter` 章节编排 | Must | ✅ |

### EPIC 4：查询与一致性（大部分完成）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R4.1 | `epicpoet query knowledge` 角色信息可见性查询 | Must | ✅ |
| R4.2 | `epicpoet query timeline` 时间线查询 | Should | ✅ |
| R4.3 | 按角色过滤时间线 | Should | ✅ |
| R4.4 | 一致性检查（信息可见性违规检测） | Could | 未开始 |

### EPIC 5：虚拟舞台系统（已完成 ✅）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R5.1 | `epicpoet stage open/close` 场景生命周期管理 | Must | ✅ |
| R5.2 | `epicpoet stage say/whisper/act/think` 消息类型 | Must | ✅ |
| R5.3 | 确定性消息路由（基于空间关系和消息类型） | Must | ✅ |
| R5.4 | `epicpoet stage inbox` 角色视角查询 | Must | ✅ |
| R5.5 | `epicpoet stage log` 全知视角日志 | Must | ✅ |
| R5.6 | `epicpoet stage move` 演员位置变更 | Should | ✅ |
| R5.7 | stage close 自动生成 learns 记录 | Should | 未验证 |
| R5.8 | 场景中途加入/退出演员 | Could | 未开始 |

### EPIC 6：Skill 套件（新增）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R6.1 | `epicpoet` Skill — 标准 CLI 使用指南（给所有 agent 用） | Must | ✅ 基础版 |
| R6.2 | `epicpoet-conductor` Skill — 导演专用，定义何时 spawn 哪种 subagent、用什么模型、楚门模式编排逻辑 | Must | 未开始 |
| R6.3 | `epicpoet-actor` Skill — 演员专用，定义如何加载角色、只通过 stage 交互、不越界 | Must | 未开始 |
| R6.4 | 世界观快速构建工作流（"借鉴XX作品"→ 设定师 subagent 提取 → 用户审核） | Should | 未开始 |

### EPIC 7：楚门模式（新增）

| 需求 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| R7.1 | 沉浸/上帝模式切换机制（如 `/meta` 前缀跳出） | Must | 未开始 |
| R7.2 | 用户作为角色加入 Stage | Must | 未开始 |
| R7.3 | 导演幕后自动编排（演员登场、退场、场景转换） | Should | 未开始 |
| R7.4 | 写手实时记录，Stage 结束后自动整理成正文 | Should | 未开始 |

## 7. 用户故事（新增/更新）

### 虚拟舞台

**US-5.1** 作为导演，我想开启一个虚拟舞台让演员 agent 即兴交互，这样对话比"写"出来的更自然。
```
Given 导演设定场景参数（时间、地点、演员及空间关系）
When 演员 agent 通过 epicpoet stage say/whisper/act/think 交互
Then 每个演员只收到自己能感知的信息
And 全知日志记录一切（包括内心独白）
```

**US-5.2** 作为演员 agent，我只能知道角色该知道的，不能"穿帮"。
```
Given 演员被分配扮演慕容轩
When 演员查询 epicpoet stage inbox
Then 只看到慕容轩能感知的消息（看不到 whisper 给别人的、看不到别人的 think）
And 不能直接读取其他角色文件或全知日志
```

### 楚门模式

**US-7.1** 作为创作者，我想沉浸在世界里作为角色行动，就像玩无限自由度的文字 RPG。
```
Given 用户选择以某角色身份进入世界
When 用户说话或行动
Then 导演通过 Stage 路由给在场演员
And 演员基于各自的人设和已知信息做出反应
```

**US-7.2** 作为创作者，我想随时跳出沉浸模式补充设定或调整方向。
```
Given 用户在沉浸模式中
When 用户输入 "/meta 让这个老头是失散多年的师父"
Then 导演收到元指令，更新设定
And 后续交互按新设定继续
And 用户回到沉浸模式
```

## 8. 技术约束

| 项目 | 选择 | 原因 |
|------|------|------|
| 语言 | Node.js (TypeScript) | 与 OpenClaw 生态一致 |
| 存储 | 纯文件（YAML + MD），文件名用原始名称 | Git 友好，中文直观 |
| 索引 | SQLite（.gitignore），CLI 无状态 | 高效查询，可随时重建 |
| 舞台状态 | .epicpoet/stage.json | 场景运行期间的临时状态 |
| 消息路由 | 确定性脚本逻辑 | 不依赖 AI 判断，可预测可调试 |
| 发布 | npm 包 | `npx epicpoet init` 即可使用 |
| Skill | OpenClaw AgentSkill 格式 | 多个 Skill 服务不同角色 |

## 9. 未来扩展（不在 v1 范围）

- 多 Universe 支持（共享世界观的系列作品）
- 角色性格模型（AI 扮演角色时的个性约束）
- 冲突检测引擎（自动发现时间线矛盾、设定冲突）
- 导出 epub/pdf
- Web UI 可视化时间线
- 协作模式（多人共建世界观）
- 场景模板库（战斗、谈判、追逐等预设场景类型）
- 多 Stage 并行（不同地点同时发生的事件）

## 10. 命名

**EpicPoet** — 史诗诗人 🎭

## 附录 A：已实现的 CLI 命令清单

```
epicpoet init          初始化项目
epicpoet status        项目概览
epicpoet add           添加实体（character/event/location/concept/item）
epicpoet edit          修改实体
epicpoet delete        删除实体
epicpoet show          查看实体详情
epicpoet list          列出某类实体
epicpoet sync          文件 → SQLite 同步
epicpoet query         查询（knowledge/timeline）
epicpoet write         生成创作 prompt
epicpoet chapter       章节编排（create/list/show）
epicpoet stage         虚拟舞台（open/close/say/whisper/act/think/move/inbox/log）
```

---

*v0.2 | 2026-03-29 | 基于主人与小橘的讨论更新*
