import { useEffect, useCallback, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeftIcon, QueueListIcon } from "@heroicons/react/24/outline";
import type {
  ChatRequest,
  ChatMessage,
  ProjectInfo,
  PermissionMode,
} from "../types";
import type { CoworkTask } from "../../../shared/types/cowork";
import { useClaudeStreaming } from "../hooks/useClaudeStreaming";
import { useChatState } from "../hooks/chat/useChatState";
import { usePermissions } from "../hooks/chat/usePermissions";
import { usePermissionMode } from "../hooks/chat/usePermissionMode";
import { useAbortController } from "../hooks/chat/useAbortController";
import { useAutoHistoryLoader } from "../hooks/useHistoryLoader";
import { useSidebarState } from "../hooks/useSidebarState";
import { useConversationList } from "../hooks/useConversationList";
import { useCoworkPanelState } from "../hooks/useCoworkPanelState";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";
import { ChatInput } from "./chat/ChatInput";
import { ChatMessages } from "./chat/ChatMessages";
import { ConversationSidebar } from "./ConversationSidebar";
import { CoworkPanel } from "./cowork";
import { getChatUrl, getProjectsUrl } from "../config/api";
import { KEYBOARD_SHORTCUTS } from "../utils/constants";
import { normalizeWindowsPath } from "../utils/pathUtils";
import type { StreamingContext } from "../hooks/streaming/useMessageProcessor";

export function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isCollapsed, toggleSidebar } = useSidebarState();

  // Cowork panel state
  const { isOpen: isCoworkPanelOpen, toggleOpen: toggleCoworkPanel } =
    useCoworkPanelState();

  // Handle task click in Cowork panel
  const handleTaskClick = useCallback((task: CoworkTask) => {
    // TODO: Show task details in a modal or navigate to task view
    console.log("Task clicked:", task);
  }, []);

  // Extract and normalize working directory from URL
  const workingDirectory = (() => {
    const rawPath = location.pathname.replace("/projects", "");
    if (!rawPath) return undefined;

    // URL decode the path
    const decodedPath = decodeURIComponent(rawPath);

    // Normalize Windows paths (remove leading slash from /C:/... format)
    return normalizeWindowsPath(decodedPath);
  })();

  // Get sessionId from query parameters
  const sessionId = searchParams.get("sessionId");
  const isLoadedConversation = !!sessionId;

  const { processStreamLine } = useClaudeStreaming();
  const { abortRequest, createAbortHandler } = useAbortController();

  // Permission mode state management
  const { permissionMode, setPermissionMode } = usePermissionMode();

  // Get encoded name for current working directory
  const getEncodedName = useCallback(() => {
    if (!workingDirectory || !projects.length) {
      return null;
    }

    const project = projects.find((p) => p.path === workingDirectory);

    // Normalize paths for comparison (handle Windows path issues)
    const normalizedWorking = normalizeWindowsPath(workingDirectory);
    const normalizedProject = projects.find(
      (p) => normalizeWindowsPath(p.path) === normalizedWorking,
    );

    // Use normalized result if exact match fails
    const finalProject = project || normalizedProject;

    return finalProject?.encodedName || null;
  }, [workingDirectory, projects]);

  // Load conversation list for sidebar
  const { conversations } = useConversationList(getEncodedName());

  // Load conversation history if sessionId is provided
  const {
    messages: historyMessages,
    loading: historyLoading,
    error: historyError,
    sessionId: loadedSessionId,
  } = useAutoHistoryLoader(
    getEncodedName() || undefined,
    sessionId || undefined,
  );

  // Initialize chat state with loaded history
  const {
    messages,
    input,
    isLoading,
    currentSessionId,
    currentRequestId,
    hasShownInitMessage,
    currentAssistantMessage,
    setInput,
    setCurrentSessionId,
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    addMessage,
    updateLastMessage,
    clearInput,
    generateRequestId,
    resetRequestState,
    startRequest,
  } = useChatState({
    initialMessages: historyMessages,
    initialSessionId: loadedSessionId || undefined,
  });

  const {
    allowedTools,
    permissionRequest,
    showPermissionRequest,
    closePermissionRequest,
    allowToolTemporary,
    allowToolPermanent,
    isPermissionMode,
    planModeRequest,
    showPlanModeRequest,
    closePlanModeRequest,
    updatePermissionMode,
  } = usePermissions({
    onPermissionModeChange: setPermissionMode,
  });

  const handlePermissionError = useCallback(
    (toolName: string, patterns: string[], toolUseId: string) => {
      // Check if this is an ExitPlanMode permission error
      if (patterns.includes("ExitPlanMode")) {
        // For ExitPlanMode, show plan permission interface instead of regular permission
        showPlanModeRequest(""); // Empty plan content since it was already displayed
      } else {
        showPermissionRequest(toolName, patterns, toolUseId);
      }
    },
    [showPermissionRequest, showPlanModeRequest],
  );

  const sendMessage = useCallback(
    async (
      messageContent?: string,
      tools?: string[],
      hideUserMessage = false,
      overridePermissionMode?: PermissionMode,
      attachedFiles?: Array<{ path: string; name: string }>,
    ) => {
      let content = messageContent || input.trim();
      if (!content && !attachedFiles) return;
      if (isLoading) return;

      // If files are attached, prepend their paths to the message
      // Be explicit about file types and skills to trigger the correct behavior
      if (attachedFiles && attachedFiles.length > 0) {
        const getFileTypeIntro = (name: string, path: string) => {
          const ext = name.toLowerCase().substring(name.lastIndexOf("."));
          if (ext === ".pdf") return `PDF file at ${path}`;
          if (ext === ".md") return `Markdown file at ${path}`;
          if (ext.match(/\.(jpg|jpeg|png|gif|tiff?)$/))
            return `Image file at ${path}`;
          return `File at ${path}`;
        };

        // Build the file intro with explicit skill usage instructions
        let fileIntro: string;
        if (attachedFiles.length === 1) {
          const file = attachedFiles[0];
          const ext = file.name
            .toLowerCase()
            .substring(file.name.lastIndexOf("."));
          if (ext === ".pdf") {
            fileIntro = `Please use the pdf skill to read the ${getFileTypeIntro(file.name, file.path)}. `;
          } else {
            fileIntro = `I've uploaded a ${getFileTypeIntro(file.name, file.path)}. `;
          }
        } else {
          fileIntro = `I've uploaded the following files for processing:\n${attachedFiles.map((f) => `  - ${getFileTypeIntro(f.name, f.path)}`).join("\n")}\n\n`;
        }

        content = fileIntro + (content || "Please process these files.");
      }

      const requestId = generateRequestId();

      // Only add user message to chat if not hidden
      if (!hideUserMessage) {
        const userMessage: ChatMessage = {
          type: "chat",
          role: "user",
          content: content,
          timestamp: Date.now(),
        };
        addMessage(userMessage);
      }

      if (!messageContent) clearInput();
      startRequest();

      try {
        // If files are attached, include the upload directory in additionalDirectories
        // so Claude can access the uploaded files
        const additionalDirs =
          attachedFiles && attachedFiles.length > 0
            ? ["/tmp/claude-webui-uploads"]
            : undefined;

        const response = await fetch(getChatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            requestId,
            ...(currentSessionId ? { sessionId: currentSessionId } : {}),
            allowedTools: tools || allowedTools,
            ...(workingDirectory ? { workingDirectory } : {}),
            permissionMode: overridePermissionMode || permissionMode,
            ...(additionalDirs
              ? { additionalDirectories: additionalDirs }
              : {}),
          } as ChatRequest),
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Local state for this streaming session
        let localHasReceivedInit = false;
        let shouldAbort = false;

        const streamingContext: StreamingContext = {
          currentAssistantMessage,
          setCurrentAssistantMessage,
          addMessage,
          updateLastMessage,
          onSessionId: setCurrentSessionId,
          shouldShowInitMessage: () => !hasShownInitMessage,
          onInitMessageShown: () => setHasShownInitMessage(true),
          get hasReceivedInit() {
            return localHasReceivedInit;
          },
          setHasReceivedInit: (received: boolean) => {
            localHasReceivedInit = received;
            setHasReceivedInit(received);
          },
          onPermissionError: handlePermissionError,
          onAbortRequest: async () => {
            shouldAbort = true;
            await createAbortHandler(requestId)();
          },
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done || shouldAbort) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            if (shouldAbort) break;
            processStreamLine(line, streamingContext);
          }

          if (shouldAbort) break;
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        addMessage({
          type: "chat",
          role: "assistant",
          content: "Error: Failed to get response",
          timestamp: Date.now(),
        });
      } finally {
        resetRequestState();
      }
    },
    [
      input,
      isLoading,
      currentSessionId,
      allowedTools,
      hasShownInitMessage,
      currentAssistantMessage,
      workingDirectory,
      permissionMode,
      generateRequestId,
      clearInput,
      startRequest,
      addMessage,
      updateLastMessage,
      setCurrentSessionId,
      setHasShownInitMessage,
      setHasReceivedInit,
      setCurrentAssistantMessage,
      resetRequestState,
      processStreamLine,
      handlePermissionError,
      createAbortHandler,
    ],
  );

  const handleAbort = useCallback(() => {
    abortRequest(currentRequestId, isLoading, resetRequestState);
  }, [abortRequest, currentRequestId, isLoading, resetRequestState]);

  // Permission request handlers
  const handlePermissionAllow = useCallback(() => {
    if (!permissionRequest) return;

    // Add all patterns temporarily
    let updatedAllowedTools = allowedTools;
    permissionRequest.patterns.forEach((pattern) => {
      updatedAllowedTools = allowToolTemporary(pattern, updatedAllowedTools);
    });

    closePermissionRequest();

    if (currentSessionId) {
      sendMessage("continue", updatedAllowedTools, true);
    }
  }, [
    permissionRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
    allowToolTemporary,
    closePermissionRequest,
  ]);

  const handlePermissionAllowPermanent = useCallback(() => {
    if (!permissionRequest) return;

    // Add all patterns permanently
    let updatedAllowedTools = allowedTools;
    permissionRequest.patterns.forEach((pattern) => {
      updatedAllowedTools = allowToolPermanent(pattern, updatedAllowedTools);
    });

    closePermissionRequest();

    if (currentSessionId) {
      sendMessage("continue", updatedAllowedTools, true);
    }
  }, [
    permissionRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
    allowToolPermanent,
    closePermissionRequest,
  ]);

  const handlePermissionDeny = useCallback(() => {
    closePermissionRequest();
  }, [closePermissionRequest]);

  // Plan mode request handlers
  const handlePlanAcceptWithEdits = useCallback(() => {
    updatePermissionMode("acceptEdits");
    closePlanModeRequest();
    if (currentSessionId) {
      sendMessage("accept", allowedTools, true, "acceptEdits");
    }
  }, [
    updatePermissionMode,
    closePlanModeRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
  ]);

  const handlePlanAcceptDefault = useCallback(() => {
    updatePermissionMode("default");
    closePlanModeRequest();
    if (currentSessionId) {
      sendMessage("accept", allowedTools, true, "default");
    }
  }, [
    updatePermissionMode,
    closePlanModeRequest,
    currentSessionId,
    sendMessage,
    allowedTools,
  ]);

  const handlePlanKeepPlanning = useCallback(() => {
    updatePermissionMode("plan");
    closePlanModeRequest();
  }, [updatePermissionMode, closePlanModeRequest]);

  // Slash command handlers
  const handleClearConversation = useCallback(() => {
    // Clear messages and reset session
    setHasShownInitMessage(false);
    setHasReceivedInit(false);
    setCurrentAssistantMessage(null);
    // Clear all messages by resetting to initial state
    messages.length = 0; // Clear array
    setInput("");
  }, [
    setHasShownInitMessage,
    setHasReceivedInit,
    setCurrentAssistantMessage,
    messages,
    setInput,
  ]);

  const handleSaveConversation = useCallback(() => {
    // TODO: Implement save conversation functionality
    console.log("Save conversation - sessionId:", currentSessionId);
    // This could trigger a backend API call to save/mark the conversation
  }, [currentSessionId]);

  const handleExportConversation = useCallback(() => {
    // Export conversation as JSON or markdown
    if (messages.length === 0) return;

    const exportData = {
      sessionId: currentSessionId,
      workingDirectory,
      timestamp: new Date().toISOString(),
      messages: messages,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${currentSessionId || "new"}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages, currentSessionId, workingDirectory]);

  // Create permission data for inline permission interface
  const permissionData = permissionRequest
    ? {
        patterns: permissionRequest.patterns,
        onAllow: handlePermissionAllow,
        onAllowPermanent: handlePermissionAllowPermanent,
        onDeny: handlePermissionDeny,
      }
    : undefined;

  // Create plan permission data for plan mode interface
  const planPermissionData = planModeRequest
    ? {
        onAcceptWithEdits: handlePlanAcceptWithEdits,
        onAcceptDefault: handlePlanAcceptDefault,
        onKeepPlanning: handlePlanKeepPlanning,
      }
    : undefined;

  const handleNewChat = useCallback(() => {
    // Clear session and start fresh
    navigate({ search: "" });
  }, [navigate]);

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // Load projects to get encodedName mapping
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(getProjectsUrl());
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    };
    loadProjects();
  }, []);

  const handleBackToProjects = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleBackToProjectChat = useCallback(() => {
    if (workingDirectory) {
      navigate(`/projects${workingDirectory}`);
    }
  }, [navigate, workingDirectory]);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUTS.ABORT && isLoading && currentRequestId) {
        e.preventDefault();
        handleAbort();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isLoading, currentRequestId, handleAbort]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentSessionId={currentSessionId ?? undefined}
        workingDirectory={workingDirectory || undefined}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
        onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        <div className="max-w-6xl mx-auto p-3 sm:p-6 h-screen flex flex-col w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-8 flex-shrink-0">
            <div className="flex items-center gap-4">
              {isLoadedConversation && (
                <button
                  onClick={() => navigate({ search: "" })}
                  className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md"
                  aria-label="Back to new chat"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              )}
              <div>
                <nav aria-label="Breadcrumb">
                  <div className="flex items-center">
                    <button
                      onClick={handleBackToProjects}
                      className="text-slate-800 dark:text-slate-100 text-lg sm:text-3xl font-bold tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 rounded-md px-1 -mx-1"
                      aria-label="Back to project selection"
                    >
                      Ai-CoWorks
                    </button>
                    {sessionId && (
                      <>
                        <span
                          className="text-slate-800 dark:text-slate-100 text-lg sm:text-3xl font-bold tracking-tight mx-3 select-none"
                          aria-hidden="true"
                        >
                          {" "}
                          ›{" "}
                        </span>
                        <h1
                          className="text-slate-800 dark:text-slate-100 text-lg sm:text-3xl font-bold tracking-tight"
                          aria-current="page"
                        >
                          Conversation
                        </h1>
                      </>
                    )}
                  </div>
                </nav>
                {workingDirectory && (
                  <div className="flex items-center text-sm font-mono mt-1">
                    <button
                      onClick={handleBackToProjectChat}
                      className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 rounded px-1 -mx-1 cursor-pointer"
                      aria-label={`Return to new chat in ${workingDirectory}`}
                    >
                      {workingDirectory}
                    </button>
                    {sessionId && (
                      <span className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                        Session: {sessionId.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Cowork Panel Toggle */}
              <button
                onClick={toggleCoworkPanel}
                className={`p-2 rounded-lg transition-all duration-200 backdrop-blur-sm shadow-sm hover:shadow-md ${
                  isCoworkPanelOpen
                    ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800"
                    : "bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                }`}
                aria-label={isCoworkPanelOpen ? "Hide Cowork" : "Show Cowork"}
                title={
                  isCoworkPanelOpen ? "Hide Cowork Panel" : "Show Cowork Panel"
                }
              >
                <QueueListIcon
                  className={`w-5 h-5 ${
                    isCoworkPanelOpen
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                />
              </button>

              <SettingsButton onClick={handleSettingsClick} />
            </div>
          </div>

          {/* Main Content */}
          {historyLoading ? (
            /* Loading conversation history */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">
                  Loading conversation history...
                </p>
              </div>
            </div>
          ) : historyError ? (
            /* Error loading conversation history */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-slate-800 dark:text-slate-100 text-xl font-semibold mb-2">
                  Error Loading Conversation
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                  {historyError}
                </p>
                <button
                  onClick={() => navigate({ search: "" })}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start New Conversation
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <ChatMessages
                messages={messages}
                isLoading={isLoading}
                workingDirectory={workingDirectory}
              />

              {/* Input */}
              <ChatInput
                input={input}
                isLoading={isLoading}
                currentRequestId={currentRequestId}
                onInputChange={setInput}
                onSubmit={(attachedFiles) =>
                  sendMessage(
                    undefined,
                    undefined,
                    false,
                    undefined,
                    attachedFiles,
                  )
                }
                onAbort={handleAbort}
                permissionMode={permissionMode}
                onPermissionModeChange={setPermissionMode}
                showPermissions={isPermissionMode}
                permissionData={permissionData}
                planPermissionData={planPermissionData}
                onClearConversation={handleClearConversation}
                onSaveConversation={handleSaveConversation}
                onExportConversation={handleExportConversation}
              />
            </>
          )}

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={handleSettingsClose}
          />
        </div>
      </div>

      {/* Cowork Panel */}
      <CoworkPanel
        isOpen={isCoworkPanelOpen}
        sessionId={currentSessionId || undefined}
        onTaskClick={handleTaskClick}
      />
    </div>
  );
}
