# Skills Directory

This directory contains application-level Skills MCP extensions.

## Directory Structure

```
skills/
├── builtin/       # Built-in skills (read-only, managed by the application)
├── user/          # User-installed skills (managed by users via UI)
└── README.md      # This file
```

## Skill Format

Each skill is a directory containing:

```
skill-name/
├── SKILL.md       # Skill definition with YAML frontmatter
├── scripts/       # Optional executable scripts
├── references/    # Optional reference documents
└── assets/        # Optional static assets
```

### SKILL.md Format

```markdown
---
name: "Skill Name"
description: "A brief description of what this skill does"
author: "Author Name"
version: "1.0.0"
license: "MIT"
compatibility: ">=1.0.0"
dependencies:
  - mcp-server-name
allowedTools:
  - tool1
  - tool2
---

# Skill Name

Detailed description of the skill...

## Usage

How to use this skill...
```

## Adding Skills

### Built-in Skills

Add built-in skills to the `builtin/` directory. These are managed by the application.

### User Skills

Users can install skills via the UI, which will be placed in the `user/` directory.

## Global MCP Skills

The application can also read skills from the global MCP directory:

- `~/.claude/skills/` on Unix-like systems
- `%APPDATA%\claude\skills\` on Windows

These are read-only and can be enabled/disabled but not modified.

## Development

For more information on developing skills, refer to the MCP documentation.
