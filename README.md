# EpicPoet 🎭

**An interactive narrative engine powered by AI agent collaboration.**

EpicPoet turns your IM client (Telegram, Feishu, Discord) into an immersive storytelling experience. Instead of writing novels yourself, you *live* in them — making choices as a character while a team of AI agents (director, playwright, actors, writer) collaborate behind the scenes to weave a coherent, engaging story around you.

## ✨ What Makes It Different

- **You're a participant, not an author** — Choose a character and experience the story from their perspective, or sit back and watch it unfold
- **AI agent ensemble** — A director orchestrates playwright, actors, and writer subagents, each with distinct roles and constraints
- **Information visibility engine** — Characters only know what they've witnessed. No accidental omniscience
- **IM-native** — No separate UI. Stories happen right in your chat app
- **Git-friendly worldbuilding** — All data stored as human-readable YAML/Markdown files

## 🏗️ Architecture

```
User (IM Client)
      │
      ▼
🎬 Director (conductor skill)
   Orchestrates the narrative, manages scenes
      │
      ├→ 📐 Playwright — Writes structured scene scripts
      ├→ 🎭 Actors ×N — Embody characters, deliver lines in-character  
      ├→ ✍️ Writer — Transforms stage interactions into literary prose
      └→ 📖 Lorekeeper — Maintains worldbuilding consistency
```

All agents communicate through the **Stage** (a virtual theater) and query world data via the **epicpoet CLI**. No agent talks directly to another — the file system is the single source of truth.

## 📦 Installation

```bash
npm install -g epicpoet
```

**Requirements:** Node.js 18+, [OpenClaw](https://openclaw.ai) (for the interactive narrative experience)

## 🚀 Quick Start

### As a CLI Tool

EpicPoet works standalone as a worldbuilding and writing assistant:

```bash
# Initialize a project
mkdir my-novel && cd my-novel
epicpoet init

# Add characters, locations, events
epicpoet add character --name "Aila" --description "A brave adventurer"
epicpoet add location --name "Crystal Palace" --description "A palace of living crystal"
epicpoet add event --name "The Sundering" --time 100 --participants "aila"

# Query what a character knows at a point in time
epicpoet query knowledge aila --at 150

# Generate a writing prompt with proper information visibility
epicpoet write --pov aila --time 150 --location crystal-palace
```

### As an Interactive Narrative Engine (with OpenClaw)

Install the skills into your OpenClaw workspace, then just tell your agent you want to experience a story. The conductor skill handles everything — genre selection, world building, character choice, and scene-by-scene narrative.

Two interaction modes:
- **Immersive mode** (default) — You *are* a character. Speak and act in the story world
- **Meta mode** (`/meta`) — God mode. Modify the world, adjust plot direction, add characters

## 📖 CLI Commands

| Command | Description |
|---------|-------------|
| `epicpoet init` | Initialize a new novel project |
| `epicpoet add <type>` | Add character, event, location, concept, or item |
| `epicpoet edit <type> <id>` | Edit an existing entity |
| `epicpoet delete <type> <id>` | Delete an entity |
| `epicpoet show <type> <id>` | Display entity details |
| `epicpoet list <type>` | List all entities of a type |
| `epicpoet query knowledge <char>` | What does a character know? |
| `epicpoet query timeline` | View the event timeline |
| `epicpoet write` | Generate a scene + AI writing prompt |
| `epicpoet chapter create/list/show` | Manage chapters |
| `epicpoet stage open/close/say/act/think/...` | Virtual theater for character interaction |
| `epicpoet sync` | Sync YAML files to SQLite index |
| `epicpoet status` | Project overview |

## 📁 Project Structure

```
my-novel/
├── universe.yaml          # World configuration & style
├── characters/            # Character YAML files
├── events/                # Timeline events
├── locations/             # Locations (nestable)
├── concepts/              # Worldbuilding concepts
├── items/                 # Items and artifacts
├── scenes/                # Scene files (frontmatter + prose)
├── chapters/              # Chapter definitions
└── .epicpoet/
    ├── index.sqlite       # Auto-synced query index
    ├── stage.json         # Virtual theater state
    └── session.json       # Conductor session state
```

## 🎭 Agent Skill Suite

EpicPoet includes OpenClaw skills for the full interactive experience:

| Skill | Role | Description |
|-------|------|-------------|
| `epicpoet` | Base | CLI usage guide for any agent |
| `epicpoet-conductor` | 🎬 Director | Scene lifecycle, user interaction, subagent orchestration |
| `epicpoet-playwright` | 📐 Playwright | Query lore, write structured scene scripts |
| `epicpoet-actor` | 🎭 Actor | Load character profile, deliver lines in-character via Stage |
| `epicpoet-writer` | ✍️ Writer | Read Stage log, produce literary narrative output |

## 🔐 Permission Model

| Action | 🎬 Director | 📐 Playwright | 🎭 Actor | ✍️ Writer |
|--------|------------|--------------|---------|----------|
| add/edit/delete entities | via Lorekeeper | ❌ | ❌ | ❌ |
| show/query world data | ✅ | ✅ | Own character only | ✅ |
| stage open/close | ✅ | ❌ | ❌ | ❌ |
| stage say/act/think | ❌ | ❌ | ✅ | ❌ |
| stage log | ✅ | ❌ | ❌ | ✅ |

## 📊 Project Status

**Current: v0.1.0** — CLI core complete, interactive narrative skills in development

- ✅ CLI core (12 commands + Stage system)
- ✅ Data schema (YAML/SQLite)
- ✅ Information visibility engine
- ✅ Stage virtual theater
- ✅ Base skill (epicpoet)
- 🔲 Conductor skill (Phase 1)
- 🔲 Playwright skill (Phase 1)
- 🔲 Actor skill (Phase 1)
- 🔲 Writer skill (Phase 1)
- 🔲 World templates (xianxia, sci-fi, fantasy)
- 🔲 Lorekeeper skill (Phase 2)

## 📄 License

[MIT](LICENSE) © 2026
