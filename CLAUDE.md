# Claude Code Web UI

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Code Quality

Automated quality checks ensure consistent code standards:

- **Lefthook**: Git hooks manager running `make check` before commits
- **Quality Commands**: `make check` runs all quality checks manually
- **CI/CD**: GitHub Actions runs quality checks on every push

### Setup for New Contributors

```bash
# Install Lefthook
brew install lefthook  # macOS
# Or download from https://github.com/evilmartians/lefthook/releases

# Install and verify hooks
lefthook install
lefthook run pre-commit
```

## Architecture

### Backend (Deno/Node.js)

- **Location**: `backend/` | **Port**: 8080 (configurable)
- **Technology**: TypeScript + Hono framework with runtime abstraction
- **Purpose**: Executes `claude` commands and streams JSON responses

**Key Features**: Runtime abstraction, modular architecture, structured logging, universal Claude CLI path detection, session continuity, single binary distribution, comprehensive testing, self-healing PDF translation with multi-method extraction.

**API Endpoints**:

- `GET /api/projects` - List available project directories
- `POST /api/chat` - Chat messages with streaming responses (`{ message, sessionId?, requestId, allowedTools?, workingDirectory? }`)
- `POST /api/abort/:requestId` - Abort ongoing requests
- `GET /api/projects/:encodedProjectName/histories` - Conversation histories
- `GET /api/projects/:encodedProjectName/histories/:sessionId` - Specific conversation history
- `POST /api/pdf/translate` - PDF translation with multi-method extraction (`{ pdfFile, targetLanguage, options }`)
- `GET /api/pdf/learning` - Retrieve learning metrics and model statistics
- `POST /api/pdf/learning/reset` - Reset learning knowledge base (admin)

### Frontend (React)

- **Location**: `frontend/` | **Port**: 3000 (configurable)
- **Technology**: Vite + React + SWC + TypeScript + TailwindCSS + React Router
- **Purpose**: Project selection and chat interface with streaming responses

**Key Features**: Project directory selection, routing system, conversation history, demo mode, real-time streaming, theme toggle, auto-scroll, accessibility features, modular hook architecture, request abort functionality, permission dialog handling, configurable Enter key behavior.

### Shared Types

**Location**: `shared/` - TypeScript type definitions shared between backend and frontend

**Key Types**: `StreamResponse`, `ChatRequest`, `AbortRequest`, `ProjectInfo`, `ConversationSummary`, `ConversationHistory`

## Claude Command Integration

Backend uses Claude Code SDK executing commands with:

- `--output-format stream-json` - Streaming JSON responses
- `--verbose` - Detailed execution information
- `-p <message>` - Prompt mode with user message

**Message Types**: System (initialization), Assistant (response content), Result (execution summary)

### Claude CLI Path Detection

Universal detection supporting npm, pnpm, asdf, yarn installations:

1. Auto-discovery in system PATH
2. Script path tracing with temporary node wrapper
3. Version validation with `claude --version`
4. Fallback handling with logging

**Implementation**: `backend/cli/validation.ts` with `detectClaudeCliPath()`, `validateClaudeCli()`

## Session Continuity

Conversation continuity using Claude Code SDK's session management:

1. First message starts new Claude session
2. Frontend extracts `session_id` from SDK messages
3. Subsequent messages include `session_id` for context
4. Backend passes `session_id` to SDK via `options.resume`

## MCP Integration (Model Context Protocol)

Playwright MCP server integration for automated browser testing and demo verification.

### Configuration

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Usage

1. Say "**playwright mcp**" in requests for browser automation
2. Visible Chrome browser window opens for interaction
3. Manual authentication supported through browser window

**Available Tools**: Navigation, interaction, screenshots, content access, file operations, tab management, dialog handling

## PDF Translation System

Self-healing PDF translation system with multi-method extraction and automatic retry capabilities.

### Architecture

The system implements a resilient extraction and translation pipeline:

**Extraction Methods** (parallel execution):

1. **PyPDF2**: Direct text extraction from PDF streams
2. **pdfjs-dist**: JavaScript-based PDF parsing with better Unicode support
3. **OCR**: Tesseract OCR for scanned/image-based PDFs

### Scoring and Ranking

Each extraction method is scored based on:

- **Character Count**: Higher scores for more extracted text
- **CJK Character Detection**: Regex-based detection of Chinese/Japanese/Korean characters (`[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]`)
- **Text Coherence**: Linguistic analysis measuring word frequency distributions and sentence structures

**Ranking Formula**:

```typescript
score = characterCount * 0.3 + cjkRatio * 0.4 + coherenceScore * 0.3;
```

### Translation Pipeline

1. **Extraction**: Run all 3 methods in parallel
2. **Ranking**: Score and sort results by quality metrics
3. **Selection**: Route highest-scoring extraction to translation
4. **Validation**: Verify translation output quality
5. **Retry**: If validation fails, use second-best extraction method
6. **Fallback**: Continue until successful or all methods exhausted

### Learning and Knowledge Base

**Metrics Storage** (`backend/data/pdf-extraction-learning.json`):

```json
{
  "attempts": [
    {
      "timestamp": "2026-03-08T12:00:00Z",
      "pdfHash": "sha256:...",
      "filename": "document.pdf",
      "extractionResults": [
        {
          "method": "pypdf2",
          "characterCount": 5420,
          "cjkRatio": 0.85,
          "coherenceScore": 0.92,
          "selected": true,
          "translationSuccess": true
        },
        {
          "method": "pdfjs-dist",
          "characterCount": 5100,
          "cjkRatio": 0.83,
          "coherenceScore": 0.88,
          "selected": false
        },
        {
          "method": "ocr",
          "characterCount": 3200,
          "cjkRatio": 0.45,
          "coherenceScore": 0.65,
          "selected": false
        }
      ],
      "translationValidation": {
        "passed": true,
        "confidence": 0.94
      }
    }
  ],
  "modelMetrics": {
    "pypdf2": { "successRate": 0.78, "avgScore": 0.85 },
    "pdfjs-dist": { "successRate": 0.82, "avgScore": 0.87 },
    "ocr": { "successRate": 0.65, "avgScore": 0.72 }
  }
}
```

### Validation Criteria

Translation output is validated against:

- **Length Consistency**: Output length within 50-200% of input
- **Language Detection**: Target language detected in output
- **Coherence Score**: Linguistic quality > 0.7 threshold
- **CJK Preservation**: For CJK-heavy inputs, character preservation > 80%

### Implementation Locations

- **Extraction**: `backend/src/pdf/extractors/` (pypdf2.ts, pdfjs.ts, ocr.ts)
- **Scoring**: `backend/src/pdf/scoring/rank.ts`
- **Translation**: `backend/src/pdf/translate/route.ts`
- **Learning**: `backend/src/pdf/learning/tracker.ts`
- **Knowledge Base**: `backend/data/pdf-extraction-learning.json`

### Usage

Upload PDF via chat interface or API:

```typescript
POST /api/pdf/translate
{
  "pdfFile": "<base64 or multipart>",
  "targetLanguage": "zh-CN",
  "options": {
    "preserveFormat": true,
    "enableOcr": true
  }
}
```

**Response**:

```json
{
  "success": true,
  "extractionMethod": "pdfjs-dist",
  "translatedText": "...",
  "confidence": 0.94,
  "attempts": 1,
  "learningData": {
    /* logged internally */
  }
}
```

## Development

### Prerequisites

- Backend: Deno or Node.js (20.0.0+)
- Frontend: Node.js
- Claude CLI tool installed
- dotenvx: `npm install -g @dotenvx/dotenvx`
- **PDF Translation Dependencies**:
  - Python 3.10+ with PyPDF2 (`pip install pypdf2`)
  - Tesseract OCR for system OCR support
  - pdfjs-dist (`npm install pdfjs-dist`)

### Port Configuration

Create `.env` file in project root:

```bash
PORT=9000
```

### Running the Application

```bash
# Backend
cd backend
deno task dev        # Deno
npm run dev          # Node.js
# Add --debug for debug logging

# Frontend
cd frontend
npm run dev
```

**Access**: Frontend http://localhost:3000, Backend http://localhost:8080

### Project Structure

```
├── backend/              # Server with runtime abstraction
│   ├── cli/             # Entry points (deno.ts, node.ts, args.ts, validation.ts)
│   ├── runtime/         # Runtime abstraction (types.ts, deno.ts, node.ts)
│   ├── handlers/        # API handlers (chat.ts, projects.ts, histories.ts, etc.)
│   ├── history/         # History processing utilities
│   ├── middleware/      # Middleware modules
│   ├── utils/           # Utility modules (logger.ts)
│   ├── src/
│   │   └── pdf/         # PDF translation system
│   │       ├── extractors/  # Extraction methods (pypdf2.ts, pdfjs.ts, ocr.ts)
│   │       ├── scoring/     # Extraction quality ranking (rank.ts)
│   │       ├── translate/   # Translation routing (route.ts)
│   │       └── learning/    # Learning tracker (tracker.ts)
│   ├── data/            # Learning knowledge base
│   │   └── pdf-extraction-learning.json
│   └── scripts/         # Build and packaging scripts
├── frontend/            # React application
│   ├── src/
│   │   ├── config/      # API configuration
│   │   ├── utils/       # Utilities and constants
│   │   ├── hooks/       # Custom hooks (streaming, theme, chat state, etc.)
│   │   ├── components/  # UI components (chat, messages, dialogs, etc.)
│   │   ├── types/       # Type definitions
│   │   └── contexts/    # React contexts
├── shared/              # Shared TypeScript types
└── CLAUDE.md           # Technical documentation
```

## Key Design Decisions

1. **Runtime Abstraction**: Platform-agnostic business logic with minimal Runtime interface
2. **Universal CLI Detection**: Tracing-based approach for all package managers
3. **Raw JSON Streaming**: Unmodified Claude responses for frontend flexibility
4. **Modular Architecture**: Specialized hooks and components for maintainability
5. **TypeScript Throughout**: Consistent type safety across all components
6. **Project Directory Selection**: User-chosen working directories for contextual file access

## Claude Code SDK Types Reference

**SDK Types**: `frontend/node_modules/@anthropic-ai/claude-code/sdk.d.ts`

```typescript
// Type extraction
const systemMsg = sdkMessage as Extract<SDKMessage, { type: "system" }>;
const assistantMsg = sdkMessage as Extract<SDKMessage, { type: "assistant" }>;

// Content access patterns
for (const item of assistantMsg.message.content) {
  if (item.type === "text") {
    const text = (item as { text: string }).text;
  }
}

// System message (direct access, no nesting)
console.log(systemMsg.cwd);
```

**Key Points**: System fields directly on object, Assistant content nested under `message.content`, Result has `subtype` field

## Permission Mode Switching

UI-driven plan mode functionality allowing users to toggle between normal execution and plan mode.

**Features**: Normal/Plan mode toggle, UI integration, session persistence
**Implementation**: `usePermissionMode` hook, `PlanPermissionInputPanel` component
**Usage**: Toggle in chat input → send message → review plan → choose action

## Testing

**Frontend**: Vitest + Testing Library (`make test-frontend`)
**Backend**: Deno test runner (`make test-backend`)  
**Unified**: `make test` runs both, `make check` includes in quality validation

## Single Binary Distribution

```bash
cd backend && deno task build  # Local building
```

**Automated**: Push git tags → GitHub Actions builds for Linux/macOS (x64/ARM64)

## Claude Code Dependency Management

**Policy**: Fixed versions (no caret `^`) for consistency across frontend/backend

**Update Procedure**:

1. Check versions: `grep "@anthropic-ai/claude-code" frontend/package.json backend/deno.json`
2. Update frontend package.json and `npm install`
3. Update backend deno.json imports and `rm deno.lock && deno cache cli/deno.ts`
4. Update backend package.json and `npm install`
5. Verify: `make check`

## Commands for Claude

### Unified Commands (from project root)

- `make format` - Format both frontend and backend
- `make lint` - Lint both
- `make typecheck` - Type check both
- `make test` - Test both
- `make check` - All quality checks
- `make format-files FILES="file1 file2"` - Format specific files

### Individual Commands

- Development: `make dev-backend` / `make dev-frontend`
- Testing: `make test-frontend` / `make test-backend`
- Build: `make build-backend` / `make build-frontend`

## Development Workflow

### Pull Request Process

1. Create feature branch: `git checkout -b feature/name`
2. Commit changes (Lefthook runs `make check`)
3. Push and create PR with appropriate labels:
   ```bash
   gh pr create --title "..." --body "..." --label "bug" --label "backend"
   ```
4. Include Type of Change checkboxes and description
5. Request review and merge after approval

### Labels

🐛 `bug`, ✨ `feature`, 💥 `breaking`, 📚 `documentation`, ⚡ `performance`, 🔨 `refactor`, 🧪 `test`, 🔧 `chore`, 🖥️ `backend`, 🎨 `frontend`

### Release Process (Automated with tagpr)

1. Feature PRs merged → tagpr creates release PR
2. Add version labels if needed (minor/major)
3. Merge release PR → automatic tag creation
4. GitHub Actions builds binaries automatically

### GitHub Sub-Issues API

```bash
gh issue create --title "Sub-issue" --label "feature"
SUB_ISSUE_ID=$(gh api repos/sugyan/claude-code-webui/issues/NUM --jq '.id')
gh api repos/sugyan/claude-code-webui/issues/PARENT/sub_issues --method POST --field sub_issue_id=$SUB_ISSUE_ID
```

### Viewing Copilot Review Comments

```bash
gh api repos/sugyan/claude-code-webui/pulls/PR_NUMBER/comments
```

**Important**: Always run commands from project root. Use full paths for cd commands to avoid directory navigation issues.
