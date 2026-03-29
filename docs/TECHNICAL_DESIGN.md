# EpicPoet — Technical Design v0.2

> 状态：草案 | 日期：2026-03-29
> v0.1 → v0.2 变更：从 CLI 工具升级为互动式叙事引擎，新增 Conductor/Actor/Writer/Playwright/Lorekeeper Skill 设计

## 1. 系统架构

### 1.1 总体架构

```
┌─────────────────────────────────────────────────────┐
│                    用户（IM 客户端）                    │
│            飞书 / Telegram / Discord / ...             │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                 OpenClaw Gateway                      │
│              （消息路由 + Session 管理）                 │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│          主 Agent（装载 epicpoet-conductor Skill）      │
│                    = 🎬 导演                           │
│                                                       │
│  识别用户意图 → 编排 subagent → 控制场景生命周期          │
│  处理 /meta 指令 → 管理沉浸/上帝模式切换                 │
│                                                       │
│  Spawn:                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │📖 设定师  │ │📐 编剧   │ │🎭 演员×N │ │✍️ 写手   │ │
│  │lorekeeper│ │playwright│ │ actor    │ │ writer   │ │
│  │一次性任务 │ │一次性任务 │ │一次性任务│ │一次性任务 │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                  epicpoet CLI                         │
│            （数据引擎 + Stage 消息总线）                  │
│                                                       │
│  数据层：YAML/MD 文件 ←→ SQLite 索引                    │
│  舞台层：stage.json（场景状态 + 消息日志）                │
└─────────────────────────────────────────────────────┘
```

### 1.2 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 导演角色 | 主 Agent 自己扮演 | 避免多层嵌套，减少延迟 |
| 其他角色 | 一次性 subagent（mode="run"） | 无需常驻，降低资源占用 |
| 演员工作模式 | 编剧写剧本，演员润色台词 | 效率高、质量可控、剧情不跑偏 |
| UI | 无独立 UI，纯 IM | 利用 OpenClaw 多端能力 |
| 选项呈现 | 自适应（按钮/数字降级） | 兼容所有平台 |
| 数据共享 | 全部通过文件（epicpoet CLI） | 角色间不直接通信 |
| 设定写权限 | 仅设定师 | 保证数据一致性 |

## 2. 消息流

### 2.1 总体流向

```
用户 → 导演 → ┬→ 设定师（写设定）  ──┐
              └→ 编剧（出剧本）    ──┤
                                     ↓
                                 演员×N（润色各自台词）
                                     ↓
                                 写手（整理叙事输出）
                                 ┌───┴───┐
                                 ↓       ↓
                               用户   设定师（自动跟进新设定）
```

### 2.2 场景级工作流

一个完整场景的生命周期：

```
1. 导演 → 判断需要新场景
2. 导演 → spawn 编剧
3. 编剧 → 查设定（epicpoet show/query）
         → 输出完整剧本（JSON 格式）
         → 包含：节拍列表、每个角色的对话/动作/内心
         → 退出
4. 导演 → epicpoet stage open（开场）
5. 导演 → spawn 演员A、演员B、...（并行）
6. 每个演员 → 加载角色设定（epicpoet show character）
             → 查已知信息（epicpoet query knowledge）
             → 按角色风格润色自己的台词
             → epicpoet stage say/act/think（写入 stage）
             → 退出
7. 导演 → epicpoet stage close（收场）
8. 导演 → spawn 写手
9. 写手 → 读 stage log
         → 整理成文学叙事
         → 输出给用户
         → 退出
10. 导演 → spawn 设定师（跟进）
11. 设定师 → 读 stage log
            → 提取新设定补录
            → 退出
```

### 2.3 沉浸模式下的用户交互轮次

用户在沉浸模式说了一句话（非 /meta）：

```
1. 用户："前面那个老头是谁？"
2. 导演 → 识别为角色行为
3. 导演 → epicpoet stage say --actor "用户角色" "前面那个老头是谁？"
4. 导演 → spawn 编剧（快速版）
5. 编剧 → 根据当前场景状态 + 用户输入
         → 输出 NPC 的回应剧本（1-2 个节拍）
         → 退出
6. 导演 → spawn 对应 NPC 演员
7. 演员 → 润色台词 → epicpoet stage say
         → 退出
8. 导演 → spawn 写手
9. 写手 → 读最新的 stage 消息
         → 整理输出给用户
         → 退出
```

### 2.4 /meta 模式

```
1. 用户："/meta 让那个老头是主角失散的师父"
2. 导演 → 识别 /meta 前缀 → 进入上帝模式
3. 导演 → spawn 设定师
4. 设定师 → epicpoet edit character（更新角色关系）
           → 退出
5. 导演 → 通知用户"已更新"
6. 导演 → 回到沉浸模式
```

## 3. Skill 套件设计

### 3.1 epicpoet-conductor（导演 Skill）

装载于：主 Agent
触发条件：用户表达想体验故事 / 已在 EpicPoet session 中

**核心逻辑：**

```yaml
状态机:
  IDLE:        # 等待用户触发
    → GENRE_SELECT（用户想开始故事）
    
  GENRE_SELECT:  # 选类型
    → WORLD_BUILD（用户选了类型）
    
  WORLD_BUILD:   # 建世界（后台）
    → spawn 设定师（批量创建）
    → CHAR_SELECT（建完）
    
  CHAR_SELECT:   # 选角色/视角
    → PLAYING_IMMERSIVE（选"我来演"）
    → PLAYING_SPECTATOR（选"我来看"）
    
  PLAYING_IMMERSIVE:  # 沉浸模式
    → 用户正常发言 → 走交互轮次
    → /meta → META_MODE
    → 场景结束 → SCENE_TRANSITION
    
  PLAYING_SPECTATOR:  # 旁观模式
    → 自动推进场景
    → /meta → META_MODE
    
  META_MODE:     # 上帝模式
    → 处理完 → 回到 PLAYING_*
    
  SCENE_TRANSITION:  # 场景切换
    → 展示回顾 + 选项
    → PLAYING_*
```

**Conductor 需要维护的状态：**

```json
{
  "mode": "immersive|spectator|meta",
  "userCharacter": "陈朴",
  "currentScene": "密林相遇",
  "novelPath": "/path/to/novel/",
  "stageOpen": true,
  "sceneCount": 3
}
```

存储位置：小说项目目录 `.epicpoet/session.json`

### 3.2 epicpoet-playwright（编剧 Skill）

运行方式：一次性 subagent（mode="run"）
输入：导演给的场景需求
输出：结构化剧本（JSON）

**剧本格式：**

```json
{
  "scene": "密林相遇",
  "time": 1000,
  "location": "中州密林",
  "beats": [
    {
      "beat": 1,
      "description": "相遇，互相警惕",
      "actions": [
        {
          "character": "慕容轩",
          "type": "act",
          "content": "听到声响，手按剑柄，警惕地望向前方"
        },
        {
          "character": "林雪瑶",
          "type": "say",
          "to": "慕容轩",
          "content": "你是谁？为何在此？"
        },
        {
          "character": "慕容轩",
          "type": "say",
          "to": "林雪瑶",
          "content": "我还想问你。这片林子可不太平。"
        },
        {
          "character": "慕容轩",
          "type": "think",
          "content": "这女子气息不弱，不像普通人。"
        }
      ]
    },
    {
      "beat": 2,
      "description": "冲突升级"
    }
  ]
}
```

**编剧的工作流程：**

```
1. 读场景需求（导演传入）
2. epicpoet query knowledge <各角色> --at <当前时间>
3. epicpoet show character <各角色>
4. epicpoet show location <地点>
5. 基于设定 + 信息可见性约束 → 编写剧本
6. 输出 JSON 剧本 → 退出
```

### 3.3 epicpoet-actor（演员 Skill）

运行方式：一次性 subagent（mode="run"）
输入：角色名 + 剧本中属于该角色的台词/动作
输出：润色后的台词/动作，写入 stage

**演员的工作流程：**

```
1. epicpoet show character <自己的角色>（加载人设）
2. epicpoet query knowledge <自己> --at <当前时间>（加载已知信息）
3. 读取编剧给的台词/动作
4. 按角色性格、说话风格润色
5. epicpoet stage say/act/think（写入 stage）
6. 退出
```

**演员的约束：**
- 只能修改自己角色的台词风格，不能改剧情走向
- 只能调用 stage say/whisper/act/think（写入自己的内容）
- 只能 show/query 自己的角色信息
- 不能读 stage log（不能看到全知视角）

### 3.4 epicpoet-writer（写手 Skill）

运行方式：一次性 subagent（mode="run"）
输入：stage log
输出：文学叙事文本

**写手的工作流程：**

```
1. epicpoet stage log（读全知日志）
2. epicpoet show location <地点>（环境描写素材）
3. 将 stage 消息转化为文学叙事：
   - say → 对话描写
   - act → 动作描写
   - think → 心理描写（仅当用户角色 or 旁观模式）
   - 补充环境描写、氛围渲染
4. 输出叙事文本 → 退出
```

**写手的输出控制：**
- 沉浸模式：只描写用户角色能感知的内容（用 inbox 而非 log）
- 旁观模式：全知视角，可描写所有内容
- 风格遵循 universe.yaml 的 style 配置

### 3.5 epicpoet-lorekeeper（设定师 Skill）

运行方式：一次性 subagent（mode="run"）
输入：创建任务（批量建世界 / 补录设定）
输出：epicpoet add/edit 命令执行结果

**两种工作模式：**

```
模式 A：批量创建（新故事）
  输入："仙侠修真类型"
  → epicpoet init
  → epicpoet add concept × N
  → epicpoet add location × N
  → epicpoet add character × N
  → epicpoet add event（开场事件）
  → 退出

模式 B：跟进补录（场景结束后）
  输入：stage log 内容
  → 分析日志中出现的新地名/概念/物品
  → epicpoet add/edit（补录新设定）
  → 退出
```

## 4. 预设世界模板

### 4.1 目录结构

```
~/.openclaw/workspace/novels/templates/
├── xianxia/           # 仙侠修真
│   ├── universe.yaml
│   ├── characters/    # 3-5 预设角色
│   ├── locations/     # 5-10 地点
│   ├── concepts/      # 核心设定（修炼体系、灵气等）
│   └── events/        # 开场事件
├── scifi/             # 科幻太空
├── fantasy/           # 西方奇幻
├── mystery/           # 悬疑推理
└── romance/           # 都市言情
```

### 4.2 使用方式

```bash
# 导演选择模板后
cp -r templates/xianxia/ novels/new-story/
cd novels/new-story/
epicpoet sync --force
# 世界就绪，可以开始
```

### 4.3 模板 vs 现场生成

| 方式 | 速度 | 质量 | 适用场景 |
|------|------|------|---------|
| 预设模板 | 秒级 | 通用但完整 | 快速开始，体验为主 |
| 现场生成（设定师） | 30-60秒 | 定制化 | 用户有特定需求 |
| 混合：模板 + 用户微调 | 10-20秒 | ✅ 最佳 | 推荐默认方案 |

## 5. 数据流详解

### 5.1 文件系统是唯一真相

```
所有持久化数据 → YAML/MD 文件
所有查询 → SQLite 索引（epicpoet sync 自动维护）
场景临时状态 → .epicpoet/stage.json
导演 session 状态 → .epicpoet/session.json
```

### 5.2 权限矩阵

| 命令 | 🎬 导演 | 📐 编剧 | 📖 设定师 | 🎭 演员 | ✍️ 写手 |
|------|--------|--------|----------|--------|--------|
| add/edit/delete | ❌ | ❌ | ✅ | ❌ | ❌ |
| show/list/query | ✅ | ✅ | ✅ | ✅（仅自己角色） | ✅ |
| stage open/close | ✅ | ❌ | ❌ | ❌ | ❌ |
| stage say/act/think | ❌ | ❌ | ❌ | ✅ | ❌ |
| stage inbox | ❌ | ❌ | ❌ | ✅（仅自己） | ❌ |
| stage log | ✅ | ❌ | ✅（跟进时） | ❌ | ✅ |
| init/sync | ✅ | ❌ | ✅ | ❌ | ❌ |

### 5.3 Subagent Spawn 参数

```javascript
// 编剧
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  task: "你是编剧。[场景需求]。用 epicpoet CLI 查询设定，输出 JSON 剧本。",
  runTimeoutSeconds: 120
})

// 演员
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  task: "你是演员，扮演[角色名]。润色以下台词并写入 stage。[剧本片段]",
  runTimeoutSeconds: 60
})

// 写手
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  task: "你是写手。读 stage log，整理成文学叙事输出。",
  runTimeoutSeconds: 120
})

// 设定师
sessions_spawn({
  runtime: "subagent",
  mode: "run",
  task: "你是设定师。[创建/跟进任务描述]。通过 epicpoet add/edit 录入。",
  runTimeoutSeconds: 180
})
```

## 6. 延迟预估

### 6.1 各环节耗时

| 环节 | 预估耗时 | 说明 |
|------|---------|------|
| 编剧出剧本 | 10-20s | 一次性，含查设定 |
| 演员润色（并行） | 5-10s | N 个演员同时执行 |
| 写手整理输出 | 5-15s | 取决于场景长度 |
| 设定师跟进 | 5-10s | 后台执行，不阻塞用户 |

### 6.2 用户感知延迟

| 场景 | 用户等待 | 优化方式 |
|------|---------|---------|
| 新故事开始 | 30-60s | 展示进度条/加载文案 |
| 正常对话轮次 | 15-30s | 流式输出（如平台支持） |
| /meta 操作 | 5-15s | 直接反馈 |
| 场景切换 | 20-40s | 展示过渡文案 |

### 6.3 优化方向

- **编剧预生成**：当前场景进行时，编剧可预生成下一场景的剧本
- **设定师异步**：跟进补录不阻塞用户
- **批量演员**：多个演员的 subagent 并行 spawn
- **缓存角色信息**：演员不需要每次都 query，可在 task 中直接传入

## 7. 实现优先级

### Phase 1：最小可玩版本（MVP）

```
目标：一个完整的沉浸模式体验流程

1. epicpoet-conductor Skill（导演状态机）
2. epicpoet-playwright Skill（编剧出剧本）
3. epicpoet-actor Skill（演员润色）
4. epicpoet-writer Skill（写手输出）
5. 一个预设世界模板（仙侠修真）
6. /meta 基础支持（暂停/修改设定/继续）

验证：用户在飞书/Telegram 上完整体验一个仙侠故事的第一场景
```

### Phase 2：完善体验

```
1. epicpoet-lorekeeper Skill（设定师）
2. 更多预设模板（科幻、奇幻、悬疑）
3. 旁观模式
4. 场景模板（战斗、谈判、追逐等预设节拍）
5. 时间跳转推演
```

### Phase 3：打磨

```
1. 一致性检查（审校逻辑）
2. 存档/读档（中断后继续）
3. 故事导出（整理成完整小说文本）
4. 多平台选项适配优化
```

## 8. 已有组件状态

| 组件 | 状态 | 备注 |
|------|------|------|
| epicpoet CLI 核心 | ✅ 完成 | 12 命令 + stage 系统 |
| 数据 Schema (YAML/SQLite) | ✅ 完成 | |
| Stage 消息路由 | ✅ 完成 | 空间可见性矩阵 |
| epicpoet Skill（基础版） | ✅ 完成 | CLI 使用指南 |
| epicpoet-conductor Skill | ❌ 待做 | **Phase 1 核心** |
| epicpoet-playwright Skill | ❌ 待做 | Phase 1 |
| epicpoet-actor Skill | ❌ 待做 | Phase 1 |
| epicpoet-writer Skill | ❌ 待做 | Phase 1 |
| epicpoet-lorekeeper Skill | ❌ 待做 | Phase 2 |
| 预设世界模板 | ❌ 待做 | Phase 1（至少一个） |

---

*v0.2 | 2026-03-29 | 基于主人与小橘在飞书+Telegram 的讨论*
