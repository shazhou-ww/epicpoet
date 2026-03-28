# EpicPoet 🎭

A CLI tool for AI-assisted novel writing with structured worldbuilding and information visibility tracking.

## Core Features

- **Structured worldbuilding**: Characters, events, locations, concepts as YAML files
- **Information visibility engine**: Track what each character knows at any point in time
- **Scene-based writing**: Write scenes with proper POV constraints
- **Non-linear narrative**: Arrange scenes into chapters in any order
- **Git-friendly**: All data in files, SQLite is just an index

## Quick Start

```bash
npx epicpoet init
npx epicpoet add character
npx epicpoet add event
npx epicpoet sync
npx epicpoet query knowledge <character> --at <epoch>
```

## Commands

| Command | Description |
|---------|-------------|
| `epicpoet init` | Initialize a new novel project |
| `epicpoet add <type>` | Add character/event/location/concept/item |
| `epicpoet query knowledge` | Query character knowledge at a time |
| `epicpoet query timeline` | View event timeline |
| `epicpoet write` | Create a new scene |
| `epicpoet chapter` | Manage chapters |
| `epicpoet sync` | Sync files to SQLite index |
| `epicpoet status` | Project overview |

## License

MIT
