import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import type { ConversationSummary } from "../../../shared/types";

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  currentSessionId?: string;
  workingDirectory?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
}

// Group conversations by time period
type DateGroup = "Today" | "Yesterday" | "This Week" | "This Month" | "Older";

function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "Today";
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationSidebar({
  conversations,
  currentSessionId,
  workingDirectory,
  isCollapsed,
  onToggleCollapse,
  onNewChat,
}: ConversationSidebarProps) {
  const navigate = useNavigate();

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: Record<DateGroup, ConversationSummary[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      "This Month": [],
      Older: [],
    };

    conversations.forEach((conv) => {
      const group = getDateGroup(conv.lastTime);
      groups[group].push(conv);
    });

    return groups;
  }, [conversations]);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      const searchParams = new URLSearchParams();
      searchParams.set("sessionId", sessionId);
      navigate({ search: searchParams.toString() });
    },
    [navigate],
  );

  if (isCollapsed) {
    return (
      <div className="flex-shrink-0 w-12 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          onClick={onNewChat}
          className="mt-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="New chat"
          title="New chat"
        >
          <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            Conversations
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <ChatBubbleLeftIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No conversations yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <div className="p-2">
            {(
              ["Today", "Yesterday", "This Week", "This Month", "Older"] as DateGroup[]
            ).map((group) => {
              const groupConvs = groupedConversations[group];
              if (groupConvs.length === 0) return null;

              return (
                <div key={group} className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase px-3 mb-2">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {groupConvs.map((conv) => {
                      const isActive = conv.sessionId === currentSessionId;
                      return (
                        <button
                          key={conv.sessionId}
                          onClick={() => handleSessionSelect(conv.sessionId)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isActive
                                    ? "text-blue-700 dark:text-blue-400"
                                    : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {conv.lastMessagePreview.substring(0, 40)}
                                {conv.lastMessagePreview.length > 40 && "..."}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {getRelativeTime(conv.lastTime)} •{" "}
                                {conv.messageCount} msgs
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Working Directory */}
      {workingDirectory && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-medium">Directory:</span>{" "}
            <span className="font-mono">{workingDirectory}</span>
          </div>
        </div>
      )}
    </div>
  );
}
