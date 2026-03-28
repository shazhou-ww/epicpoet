# EpicPoet — Technical Design Document

> Version: 0.1 | Date: 2026-03-28

## Table of Contents

1. [Data Schema](#1-data-schema)
2. [SQLite Table Design](#2-sqlite-table-design)
3. [CLI Command Structure](#3-cli-command-structure)

---

## 1. Data Schema

### 1.1 universe.yaml

```yaml
name: string              # Universe name
description: string       # Brief description
time_system:
  type: 'real' | 'fictional'  # real = Unix epoch, fictional = custom
  epoch_zero_label: string     # Human-readable label for epoch 0
  epoch_zero_date: string      # ISO 8601 date for real type, omitted for fictional
  units:                       # Display units (fictional only)
    - name: string             # e.g. 'year', 'month', 'day'
      seconds: number          # How many epoch seconds per unit
style:
  default_pov: 'first' | 'third-limited' | 'third-omniscient' | 'narrator'
  tone: string                 # e.g. 'epic fantasy', 'noir', 'literary'
  language: string             # e.g. 'zh-CN', 'en-US'
created_at: string             # ISO 8601
```

### 1.2 characters/*.yaml

```yaml
id: string                    # Unique slug, e.g. 'harry-potter'
name: string                  # Display name
aliases: string[]             # Alternative names/titles
description: string           # Brief character summary
traits: string[]              # Key personality traits
backstory: string             # Background info
affiliations: string[]        # Groups/factions
relationships:
  - target: string            # Character id
    type: string              # e.g. 'friend', 'enemy', 'mentor', 'sibling'
    description: string
    since_epoch: number        # When relationship started
learns:                        # ★ Knowledge records — WHERE visibility tracking lives
  - event: string             # Event id
    at_epoch: number           # When character learned about this event
    method: string             # 'witnessed' | 'told_by' | 'discovered' | 'rumor' | 'letter'
    source: string             # Optional: who told them
    notes: string              # Optional context
status: 'alive' | 'dead' | 'unknown'
first_appearance_epoch: number
created_at: string
```

> **Key Design Decision:** The `learns` array lives in character files. Each character tracks WHAT events they know and WHEN they learned about them. This enables the core query: *"What does character X know at time T?"*

### 1.3 events/*.yaml

```yaml
id: string                    # e.g. 'evt-001-sorting-ceremony'
title: string                 # Human-readable title
description: string           # What happened
epoch: number                 # When it happened (epoch seconds)
end_epoch: number             # Optional: for events with duration
location: string              # Location id
participants: string[]        # Character ids involved
visibility: 'public' | 'participants' | 'secret'
  # public      → all characters know after event time
  # participants → only participants know
  # secret      → only explicitly learned (via character.learns)
tags: string[]
consequences: string[]        # Optional: follow-up event ids
created_at: string
```

### 1.4 scenes/*.md (frontmatter + prose)

```yaml
---
id: string                    # e.g. 'scn-001-harry-sorting'
title: string
event: string                 # Event id this scene depicts
epoch: number                 # Narrative time
location: string
pov: string                   # Character id or 'narrator'
characters: string[]          # Characters present in scene
summary: string               # Brief scene summary
word_count: number            # Auto-calculated
status: 'draft' | 'review' | 'final'
created_at: string
---

(scene prose in markdown below frontmatter)
```

### 1.5 chapters/*.yaml

```yaml
id: string                    # e.g. 'ch-01'
title: string
number: number                # Chapter number
summary: string
scenes: string[]              # Ordered scene ids (narrative order ≠ chronological)
status: 'draft' | 'review' | 'final'
created_at: string
```

### 1.6 locations/*.yaml

```yaml
id: string
name: string
description: string
parent: string                # Parent location id (for nesting)
tags: string[]
created_at: string
```

### 1.7 concepts/*.yaml

```yaml
id: string
name: string
category: string              # e.g. 'magic', 'politics', 'culture'
description: string
tags: string[]
created_at: string
```

### 1.8 items/*.yaml

```yaml
id: string
name: string
description: string
owner: string                 # Character id (optional)
location: string              # Location id (optional)
tags: string[]
created_at: string
```

---

## 2. SQLite Table Design

### 2.1 Tables

```sql
-- Core entity tables

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT,              -- JSON array
  description TEXT,
  traits TEXT,               -- JSON array
  status TEXT DEFAULT 'alive',
  first_appearance_epoch INTEGER,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  epoch INTEGER NOT NULL,
  end_epoch INTEGER,
  location TEXT,
  participants TEXT,         -- JSON array
  visibility TEXT DEFAULT 'participants',
  tags TEXT,                 -- JSON array
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  title TEXT,
  event_id TEXT,
  epoch INTEGER,
  location TEXT,
  pov TEXT,
  characters TEXT,           -- JSON array
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  file_path TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  title TEXT,
  number INTEGER,
  summary TEXT,
  scenes TEXT,               -- JSON array of scene ids in narrative order
  status TEXT DEFAULT 'draft',
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE character_knowledge (
  character_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  at_epoch INTEGER NOT NULL,
  method TEXT,
  source TEXT,
  notes TEXT,
  PRIMARY KEY (character_id, event_id),
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent TEXT,
  tags TEXT,                 -- JSON array
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  tags TEXT,                 -- JSON array
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  location TEXT,
  tags TEXT,                 -- JSON array
  file_path TEXT NOT NULL,
  updated_at TEXT
);

-- Sync state metadata
CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### 2.2 Index Strategy

```sql
-- Event time queries (timeline)
CREATE INDEX idx_events_epoch ON events(epoch);

-- Knowledge queries: "what does character X know at time T?"
CREATE INDEX idx_knowledge_character_epoch ON character_knowledge(character_id, at_epoch);

-- Event visibility for bulk knowledge resolution
CREATE INDEX idx_events_visibility ON events(visibility, epoch);

-- Scene lookups by event
CREATE INDEX idx_scenes_event ON scenes(event_id);

-- Scene lookups by epoch (timeline view)
CREATE INDEX idx_scenes_epoch ON scenes(epoch);

-- Chapter ordering
CREATE INDEX idx_chapters_number ON chapters(number);

-- Location hierarchy
CREATE INDEX idx_locations_parent ON locations(parent);
```

### 2.3 Knowledge Query Logic

To answer *"What events does character C know at epoch T?"*:

```sql
-- 1. Public events that happened before T
SELECT e.*, 'public' as know_method, e.epoch as know_at
FROM events e
WHERE e.visibility = 'public' AND e.epoch <= :T

UNION

-- 2. Events where character was a participant, happened before T
SELECT e.*, 'witnessed' as know_method, e.epoch as know_at
FROM events e, json_each(e.participants) je
WHERE je.value = :character_id AND e.epoch <= :T

UNION

-- 3. Explicitly learned events (learned before T)
SELECT e.*, ck.method as know_method, ck.at_epoch as know_at
FROM events e
JOIN character_knowledge ck ON ck.event_id = e.id
WHERE ck.character_id = :character_id AND ck.at_epoch <= :T

ORDER BY know_at;
```

---

## 3. CLI Command Structure

### 3.1 Command Overview

| Command | Description | Key Options |
|---------|-------------|-------------|
| `epicpoet init` | Initialize a new novel project | `--name`, `--time-system` (interactive if omitted) |
| `epicpoet add character` | Add a new character | Interactive prompts for name, description, traits |
| `epicpoet add event` | Add a new event | Interactive prompts for title, epoch, visibility |
| `epicpoet add location` | Add a new location | Interactive prompts |
| `epicpoet add concept` | Add a new concept | Interactive prompts |
| `epicpoet add item` | Add a new item | Interactive prompts |
| `epicpoet query knowledge <character>` | Query character knowledge at a point in time | `--at <epoch>` (required) |
| `epicpoet query timeline` | View event timeline | `--character <name>`, `--from <epoch>`, `--to <epoch>` |
| `epicpoet write` | Create a new scene | `--event`, `--pov`, `--epoch`, `--location` |
| `epicpoet chapter` | Manage chapters | Subcommands: `create`, `list`, `show` |
| `epicpoet sync` | Sync files to SQLite index | `--force` (full rebuild) |
| `epicpoet status` | Show project overview | Counts of all entities, word count |

### 3.2 Command Flow Details

#### `epicpoet init`

1. Prompt for universe name
2. Prompt for time system type (real / fictional)
3. If fictional: prompt for epoch zero label and time units
4. Prompt for style preferences (tone, language, default POV)
5. Create directory structure:
   ```
   characters/ events/ scenes/ chapters/
   locations/ concepts/ items/ .epicpoet/
   ```
6. Write `universe.yaml`
7. Initialize `.epicpoet/index.sqlite` with schema

#### `epicpoet sync`

1. Check `.epicpoet/index.version` against current git HEAD
2. If no version file or `--force`: full rebuild (drop + recreate all tables)
3. Otherwise: use `git diff` to find changed files since last sync
4. Parse changed YAML/MD files
5. Upsert into SQLite tables
6. Rebuild `character_knowledge` from all character `learns` arrays
7. Update `.epicpoet/index.version` with current git HEAD

#### `epicpoet add character`

1. Prompt: name, description, traits (comma-separated), status
2. Generate slug id from name
3. Write `characters/<slug>.yaml`
4. Run incremental sync for new file

#### `epicpoet add event`

1. Prompt: title, description, epoch, location, visibility
2. Prompt: participants (comma-separated character ids)
3. Generate id: `evt-NNN-<slug>`
4. Write `events/<id>.yaml`
5. If visibility is 'participants': auto-add `learns` entries to each participant's character file
6. Run incremental sync

#### `epicpoet query knowledge <character> --at <epoch>`

1. Look up character in SQLite
2. Run the 3-part UNION query (public + participant + explicit learns)
3. Sort results by event epoch
4. Display table: event title, epoch, how known (public/witnessed/told_by/etc), notes
5. Summary line: "Character X knows N events at epoch T"

#### `epicpoet query timeline`

1. Query events table, optionally filtered by character and epoch range
2. Sort by epoch ascending
3. Display: epoch → event title → participants → visibility

#### `epicpoet status`

1. Count all entities (characters, events, scenes, chapters, locations, concepts, items)
2. Calculate total word count from scenes
3. Show sync status (last sync time, version match)
4. Display summary table

---

## 4. Design Principles

1. **Files are truth, SQLite is cache**: All data lives in YAML/MD files. SQLite is a derived index that can be rebuilt anytime.
2. **Git-native**: Every change is a file change. No hidden state except `.epicpoet/`.
3. **Epoch-centric**: All time references use epoch seconds internally. Human-readable display is a formatting concern.
4. **Knowledge = explicit tracking**: The `learns` array in character files is the single source of truth for what characters know.
5. **Scenes ≠ Events**: Events are facts about the world. Scenes are narrative depictions of events from a specific POV.
6. **Chapters = curation**: Chapters impose narrative order on scenes, which may differ from chronological order.
