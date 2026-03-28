# EpicPoet 🎭

**A CLI tool for AI-assisted novel writing with structured worldbuilding and information visibility tracking.**

Writing a long-form novel with AI is hard. Characters accidentally know things they shouldn't, events contradict each other, and worldbuilding details get lost in sprawling chat histories. EpicPoet solves this by giving your story a structured backbone — a **git-friendly, YAML-based worldbuilding database** with a built-in **information visibility engine** that tracks exactly what each character knows at any point in time.

## ✨ Core Features

- **Information Visibility Engine** — Track what each character knows and when they learned it. POV-aware writing prompts ensure characters never "know" things they shouldn't.
- **Structured Worldbuilding** — Characters, events, locations, concepts, and items stored as human-readable YAML files. Edit them in any text editor.
- **Git-Friendly** — All data is plain text. Branch your story, diff worldbuilding changes, merge timelines. Your novel is version-controlled.
- **SQLite Index** — Fast queries over your worldbuilding data. Synced automatically from YAML source files.
- **AI Writing Prompts** — Generate context-rich prompts that include only the information your POV character would know, plus scene structure and style guidance.
- **Chapter Assembly** — Organize scenes into chapters, reorder them freely, and export assembled chapters.

## 📦 Installation

```bash
# Global install
npm install -g epicpoet

# Or use directly with npx
npx epicpoet
```

**Requirements:** Node.js 18+

## 🚀 Quick Start

### 1. Initialize a project

```bash
mkdir my-novel && cd my-novel
epicpoet init
```

Follow the interactive prompts to set up your universe — name, description, time system, writing style, and language.

### 2. Add characters

```bash
epicpoet add character --name "Aila" --description "A brave adventurer" --traits "courage,wit" --status alive
epicpoet add character --name "艾拉" --description "一位勇敢的冒险家" --traits "勇敢,聪明"
```

Works with any language — Chinese, Japanese, Korean, and more are transliterated into clean file slugs.

### 3. Add events

```bash
epicpoet add event \
  --name "The Great Sundering" \
  --time 100 \
  --location "crystal-palace" \
  --participants "aila,kael" \
  --visibility participants \
  --description "The world splits in two"
```

Participants are automatically linked — their character files get `learns` entries recording they witnessed the event.

### 4. Add locations, concepts, and items

```bash
epicpoet add location --name "Crystal Palace" --description "A palace made of living crystal"
epicpoet add location --name "Throne Room" --parent "crystal-palace" --description "The heart of power"

epicpoet add concept --name "Source Magic" --category "Magic System" --description "Power drawn from the world's source"
epicpoet add item --name "Skyblade" --description "A legendary sword" --owner "aila"
```

### 5. Write a scene

```bash
epicpoet write \
  --time 100 \
  --pov "aila" \
  --location "crystal-palace" \
  --participants "aila,kael" \
  --synopsis "Aila witnesses the Sundering"
```

This generates a structured AI writing prompt that includes:
- What Aila knows at epoch 100 (and what she doesn't)
- Scene location and atmosphere
- Present characters and their relationships
- Writing style from your universe config

### 6. Manage chapters

```bash
epicpoet chapter create --name "Chapter 1: The Beginning" --scenes "scn-001,scn-002"
epicpoet chapter list
epicpoet chapter show ch-001
```

### 7. Query your world

```bash
# What does Aila know at epoch 150?
epicpoet query knowledge aila --at 150

# Show the timeline
epicpoet query timeline --from 0 --to 200

# Project overview
epicpoet status
```

## 📖 Command Reference

### `epicpoet init`
Initialize a new novel project. Creates `universe.yaml`, directories, and SQLite database.

| Option | Description |
|--------|-------------|
| `--name <name>` | Universe name |
| `--description <desc>` | Universe description |
| `--time-system <type>` | `real` or `fictional` |
| `--epoch-label <label>` | Label for epoch zero (fictional time) |
| `--pov <pov>` | Default POV: `first`, `third-limited`, `third-omniscient`, `narrator` |
| `--tone <tone>` | Writing tone (e.g. "epic fantasy") |
| `--language <lang>` | Language (e.g. "en-US", "zh-CN") |

### `epicpoet add character`
Add a new character to the world.

| Option | Description |
|--------|-------------|
| `--name <name>` | Character name (enables non-interactive mode) |
| `--description <desc>` | Character description |
| `--traits <traits>` | Comma-separated traits |
| `--backstory <text>` | Character backstory |
| `--status <status>` | `alive`, `dead`, or `unknown` |

### `epicpoet add event`
Add a new event to the timeline.

| Option | Description |
|--------|-------------|
| `--name <title>` | Event title |
| `--time <epoch>` | When it happened (epoch number) |
| `--location <id>` | Location id |
| `--participants <ids>` | Comma-separated character names or ids |
| `--visibility <level>` | `public`, `participants`, or `secret` |
| `--description <desc>` | Event description |

### `epicpoet add location`
Add a new location, optionally nested under a parent.

| Option | Description |
|--------|-------------|
| `--name <name>` | Location name |
| `--parent <parentId>` | Parent location id |
| `--description <desc>` | Location description |

### `epicpoet add concept`
Add a worldbuilding concept (magic systems, political structures, etc.).

| Option | Description |
|--------|-------------|
| `--name <name>` | Concept name |
| `--category <cat>` | Category (e.g. "Magic System", "政治制度") |
| `--description <desc>` | Concept description |

### `epicpoet add item`
Add an item to the world.

| Option | Description |
|--------|-------------|
| `--name <name>` | Item name |
| `--description <desc>` | Item description |
| `--owner <owner>` | Owner character id or name |

### `epicpoet write`
Generate a scene skeleton and AI writing prompt based on the current worldbuilding state.

| Option | Description |
|--------|-------------|
| `--time <epoch>` | Narrative time epoch |
| `--pov <character>` | POV character id or `narrator` |
| `--location <id>` | Location id |
| `--participants <ids>` | Comma-separated character ids |
| `--synopsis <text>` | Scene synopsis / direction |
| `--style <text>` | Writing style requirements |
| `--prompt-file <path>` | Output prompt to file |
| `--output <path>` | Output scene file path |

### `epicpoet chapter create`
Create a new chapter from existing scenes.

| Option | Description |
|--------|-------------|
| `--name <name>` | Chapter title |
| `--scenes <ids>` | Comma-separated scene ids |

### `epicpoet chapter list`
List all chapters in order.

### `epicpoet chapter show <chapterId>`
Display a chapter by assembling its scenes.

### `epicpoet query knowledge <character>`
Query what a character knows at a given point in time.

| Option | Description |
|--------|-------------|
| `--at <epoch>` | Query at this epoch |

### `epicpoet query timeline`
View the event timeline.

| Option | Description |
|--------|-------------|
| `--character <id>` | Filter by character |
| `--from <epoch>` | Start epoch |
| `--to <epoch>` | End epoch |

### `epicpoet sync`
Sync YAML files to the SQLite index.

| Option | Description |
|--------|-------------|
| `--force` | Force full rebuild |

### `epicpoet status`
Show project overview — counts of characters, events, scenes, chapters, locations, concepts, and items.

## 📁 Project Structure

```
my-novel/
├── universe.yaml          # World configuration
├── characters/            # Character YAML files
│   ├── aila.yaml
│   └── kael.yaml
├── events/                # Event YAML files (auto-sequenced)
│   └── evt-001-the-great-sundering.yaml
├── locations/             # Location YAML files (nestable)
│   ├── crystal-palace.yaml
│   └── crystal-palace/
│       └── throne-room.yaml
├── concepts/              # Worldbuilding concepts
│   └── source-magic.yaml
├── items/                 # Items and artifacts
│   └── skyblade.yaml
├── scenes/                # Scene markdown files (frontmatter + prose)
│   └── scn-001-aila-witnesses.md
├── chapters/              # Chapter YAML files
│   └── ch-001.yaml
└── .epicpoet/
    └── index.sqlite       # Auto-synced query index
```

## 🤖 Using as an OpenClaw Skill

EpicPoet includes a `skill/SKILL.md` that makes it work as an [OpenClaw](https://openclaw.ai) agent skill. When installed as a skill, your AI assistant can:

- Create and manage novel projects through natural conversation
- Add characters, events, and locations on your behalf
- Generate writing prompts with proper information visibility
- Query your worldbuilding data conversationally

To use it, place the `skill/` directory in your OpenClaw workspace skills folder, or point your skill config to this package.

## 📄 License

[MIT](LICENSE) © 2026
