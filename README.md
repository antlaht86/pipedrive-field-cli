# pipedrive-field-cli

Interactive CLI tool for browsing and copying custom fields between Pipedrive instances. Browse fields from one or more source accounts, select the ones you need, and copy them to a target account — or just browse and generate env variables without a target.

```
  ╔═══════════════════════════════════════╗
  ║  ●●●═══► FIELD CLI ◄═══●●●►         ║
  ╠═══════════════════════════════════════╣
  ║    Copy fields between Pipedrive     ║
  ║         instances with ease          ║
  ╚═══════════════════════════════════════╝
```

## Features

- **Browse & copy** custom fields (Deal, Person, Organization, Product) between Pipedrive instances
- **Optional target account** — browse fields and generate env variables without a target token; copy is disabled with clear messaging
- **Multiple source accounts** — read from many, write to one (or none)
- **Source/target toggle** — switch between viewing source fields and target fields
- **Interactive field selection** with text filtering, multi-select, and Ctrl+A toggle all
- **Env variable generation** — selected fields automatically appear in the Envs tab as ready-to-use env variables
- **Copy history** — persisted to `~/.pipedrive-field-cli/history.json` across sessions
- **Duplicate detection** — skips fields that already exist in the target
- **Dry-run mode** — preview what would happen without making changes
- **Token verification** — validates all API tokens before proceeding
- **Keyboard shortcuts** — Ctrl+D deselect all, Ctrl+A toggle all visible, Tab/Arrow switch tabs, q exit
- Animated terminal UI built with React Ink

## Installation

### From source

Requires [Bun](https://bun.sh) v1.3.0 or later.

```bash
git clone https://github.com/your-username/pipedrive-field-cli.git
cd pipedrive-field-cli
bun install
```

### Build standalone binary

```bash
bun run build
```

This produces a single `pipedrive-field-cli` executable that runs without Bun installed.

## Usage

```bash
# Full mode: browse + copy fields to target
bun run start -- \
  --read-only-api-tokens="TOKEN1,TOKEN2" \
  --target-api-token="TARGET_TOKEN"

# Browse-only mode: no target, copy disabled
bun run start -- \
  --read-only-api-tokens="TOKEN1,TOKEN2"

# Or with the compiled binary
./pipedrive-field-cli \
  --read-only-api-tokens="TOKEN1,TOKEN2" \
  --target-api-token="TARGET_TOKEN"
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--read-only-api-tokens` | Yes | Comma-separated Pipedrive API tokens for source accounts (read-only access) |
| `--target-api-token` | No | Pipedrive API token for the target account (needs write access). If omitted, the app runs in browse-only mode. |
| `--dry-run` | No | Preview mode — shows what would be copied without making API calls |

### Getting API tokens

1. Log in to your Pipedrive account
2. Go to **Settings** > **Personal preferences** > **API**
3. Copy your API token

### Examples

```bash
# Copy fields from two source accounts to a target account
./pipedrive-field-cli \
  --read-only-api-tokens="abc123def456,xyz789ghi012" \
  --target-api-token="target456abc789"

# Browse fields without copying (no target)
./pipedrive-field-cli \
  --read-only-api-tokens="abc123def456,xyz789ghi012"

# Preview what would be copied (no changes made)
./pipedrive-field-cli \
  --read-only-api-tokens="abc123def456" \
  --target-api-token="target456abc789" \
  --dry-run
```

## How it works

1. **Token verification** — Validates all API tokens in parallel and shows account owner names
2. **Field loading** — Fetches all fields from every account (source + target if provided) in parallel
3. **Tabbed browsing** — Browse Deal, Person, Organization, and Product fields in tabs
4. **Source/target toggle** — Switch between viewing source custom fields and target fields (when target provided)
5. **Multi-select fields** — Select fields with Space, filter by typing, toggle all with Ctrl+A, deselect all with Ctrl+D
6. **Env variables** — The Envs tab shows env variable mappings for all selected fields in real-time
7. **Confirm & copy** — Review selected fields before copying (only available with a target token)
8. **Copy** — Creates fields in the target account one by one, skipping duplicates
9. **History** — Copy results are persisted and visible in the History tab across sessions

Only custom fields from source accounts are shown — system fields (like Title, Value, Owner) already exist in every Pipedrive instance.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Tab / Arrow keys | Switch between tabs |
| Space | Toggle field selection |
| Type any text | Filter fields by name |
| Escape | Clear filter |
| Ctrl+A | Select/deselect all visible fields |
| Ctrl+D | Deselect all fields across all tabs |
| Enter | Confirm selection and proceed to copy |
| q | Exit the app |

## Development

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Regenerate Pipedrive SDK from OpenAPI spec
bun run openapi-ts
```

### Project structure

```
src/
├── cli/           # CLI argument parsing
├── api/           # Pipedrive API calls (neverthrow ResultAsync)
├── domain/        # Pure business logic (filtering, grouping, env name generation, payload building)
├── history/       # Copy history persistence (~/.pipedrive-field-cli/history.json)
├── ui/            # React Ink components (App, FieldBrowser, FieldMultiSelect, EnvOutput, CopyHistory, etc.)
├── types.ts       # Shared type definitions
├── errors.ts      # Error types and formatting
└── index.tsx      # Entry point
```

## Tech stack

- [Bun](https://bun.sh) — Runtime and test runner
- [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) — Terminal UI
- [@inkjs/ui](https://github.com/vadimdemedes/ink-ui) — Select, Spinner components
- [ink-tab](https://github.com/jdeniau/ink-tab) — Tab navigation
- [ink-gradient](https://github.com/sindresorhus/ink-gradient) — Gradient text rendering
- [neverthrow](https://github.com/supermacro/neverthrow) — Type-safe error handling

## License

MIT
