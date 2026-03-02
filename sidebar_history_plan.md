# Sidebar Conversation History Implementation Plan

## Overview

Add a left sidebar to display conversation history in session format, similar to ChatGPT's interface. Users can click on a session to load it, and the sidebar is collapsible for better space utilization.

## Design

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │       Main Chat Area             │
│             │                                  │
│ Sessions:   │  Current Conversation            │
│             │                                  │
│ ○ Today     │                                  │
│   Session 1 │                                  │
│   Session 2 │                                  │
│             │                                  │
│ ○ Yesterday │                                  │
│   Session 3 │                                  │
│             │                                  │
│ [Collapse]  │                                  │
└─────────────┴──────────────────────────────────┘
```

## Proposed Changes

### Frontend Changes

#### [NEW] [ConversationSidebar.tsx](file:///Users/ysh/ai/cowork/my-cowork/claude-code-webui/frontend/src/components/ConversationSidebar.tsx)

Create new sidebar component with:
- **Session List**: Display all conversations grouped by date (Today, Yesterday, This Week, This Month, Older)
- **New Chat Button**: Start a new conversation
- **Session Items**: Show preview of last message and timestamp
- **Active State**: Highlight currently selected session
- **Collapse/Expand**: Toggle sidebar visibility
- **Responsive**: Hide on mobile, show on desktop

**Session Item Display:**
- First user message as title (truncated)
- Timestamp (relative, e.g., "2 hours ago")
- Hover effect with delete option

---

#### [MODIFY] [ChatPage.tsx](file:///Users/ysh/ai/cowork/my-cowork/claude-code-webui/frontend/src/components/ChatPage.tsx)

Update main chat layout:
1. Add `ConversationSidebar` component
2. Adjust layout to include sidebar on the left
3. Update responsive behavior
4. Remove the History Button (now we have sidebar)
5. Add "New Chat" button clicking starts new session

**Layout Structure:**
```jsx
<div className="flex h-screen">
  <ConversationSidebar 
    conversations={conversations}
    currentSessionId={currentSessionId}
    onSelectSession={handleSessionSelect}
    onNewChat={handleNewChat}
  />
  <div className="flex-1 flex flex-col">
    {/* Existing chat content */}
  </div>
</div>
```

---

#### [NEW] [useSidebarState.ts](file:///Users/ysh/ai/cowork/my-cowork/claude-code-webui/frontend/src/hooks/useSidebarState.ts)

Create hook for sidebar state management:
```typescript
interface UseSidebarState {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  // Persist collapsed state in localStorage
}
```

---

#### [MODIFY] [HistoryView.tsx](file:///Users/ysh/ai/cowork/my-cowork/claude-code-webui/frontend/src/components/HistoryView.tsx)

**Option 1: Remove completely** (sidebar replaces it)
**Option 2: Keep as full-screen history view** (accessible via sidebar menu)

Recommended: Remove and integrate functionality into sidebar.

---

### Backend Changes

**No backend changes required** - existing history endpoints are sufficient:
- `GET /api/histories/:projectName` - Already provides conversation list
- `GET /api/histories/:projectName/:sessionId` - Already provides session details

---

### Styling Guidelines

#### Sidebar Theme
- **Width**: 280px (expanded), 0px (collapsed)
- **Background**: `bg-white dark:bg-slate-800`
- **Border**: Right border with `border-slate-200 dark:border-slate-700`
- **Transition**: Smooth collapse animation (300ms)

#### Session Item
- **Padding**: `p-3`
- **Hover**: `hover:bg-slate-50 dark:hover:bg-slate-700/50`
- **Active**: `bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600`
- **Text**: Primary (title), secondary (timestamp)

#### Date Groups
- **Headers**: `text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase`
- **Spacing**: `mt-6 mb-2 px-3`

---

## Implementation Steps

### Step 1: Create Sidebar Component
1. Create `ConversationSidebar.tsx`
2. Implement basic layout and styling
3. Add date grouping logic
4. Add session item rendering

### Step 2: Integrate with ChatPage
1. Add sidebar to layout
2. Update responsive design
3. Connect conversation data
4. Handle session selection

### Step 3: Add State Management
1. Create `useSidebarState` hook
2. Persist collapsed state
3. Handle mobile behavior

### Step 4: Update Navigation
1. Remove History Button
2. Add "New Chat" functionality
3. Update breadcrumb navigation

---

## Verification Plan

### Manual Testing

1. **Sidebar Display**
   - Start application
   - Verify sidebar shows on left side
   - Check date grouping (Today, Yesterday, etc.)
   - Verify session items display correctly

2. **Session Selection**
   - Click on a session in sidebar
   - Verify conversation loads
   - Verify active state highlights selected session
   - Check URL updates with sessionId

3. **New Chat**
   - Click "New Chat" button
   - Verify new empty conversation starts
   - Check sessionId is cleared

4. **Collapse/Expand**
   - Click collapse button
   - Verify sidebar animates smoothly
   - Check main chat area expands
   - Verify state persists on refresh

5. **Responsive Behavior**
   - Resize window to mobile width
   - Verify sidebar hides automatically
   - Add hamburger menu for mobile access (optional)

6. **Dark Mode**
   - Toggle dark mode
   - Verify all sidebar colors adapt correctly

---

## Future Enhancements

- **Search**: Add search box to filter conversations
- **Delete Sessions**: Right-click or swipe to delete
- **Pin Important Conversations**: Pin frequently used sessions to top
- **Export**: Export conversation history
- **Folders/Tags**: Organize conversations by project or topic
