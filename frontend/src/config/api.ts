// API configuration - uses relative paths with Vite proxy in development
export const API_CONFIG = {
  ENDPOINTS: {
    CHAT: "/api/chat",
    ABORT: "/api/abort",
    PROJECTS: "/api/projects",
    HISTORIES: "/api/projects",
    CONVERSATIONS: "/api/projects",
    // Skills endpoints
    SKILLS: "/api/skills",
    SKILL_DETAIL: "/api/skills",
    INSTALL_SKILL: "/api/skills/install",
    DELETE_SKILL: "/api/skills/delete",
    TOGGLE_SKILL: "/api/skills/toggle",
    SCAN_SKILLS: "/api/skills/scan",
    // Cowork endpoints
    COWORK_TASKS: "/api/cowork/tasks",
    COWORK_CREATE: "/api/cowork/create",
    COWORK_CANCEL: "/api/cowork/cancel",
    COWORK_SSE: "/api/cowork/stream",
  },
} as const;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return endpoint;
};

// Helper function to get abort URL
export const getAbortUrl = (requestId: string) => {
  return `${API_CONFIG.ENDPOINTS.ABORT}/${requestId}`;
};

// Helper function to get chat URL
export const getChatUrl = () => {
  return API_CONFIG.ENDPOINTS.CHAT;
};

// Helper function to get projects URL
export const getProjectsUrl = () => {
  return API_CONFIG.ENDPOINTS.PROJECTS;
};

// Helper function to get histories URL
export const getHistoriesUrl = (projectPath: string) => {
  const encodedPath = encodeURIComponent(projectPath);
  return `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedPath}/histories`;
};

// Helper function to get conversation URL
export const getConversationUrl = (
  encodedProjectName: string,
  sessionId: string,
) => {
  return `${API_CONFIG.ENDPOINTS.CONVERSATIONS}/${encodedProjectName}/histories/${sessionId}`;
};

// Skills API helpers
export const getSkillsUrl = (params?: {
  scope?: string;
  projectId?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.scope) searchParams.set("scope", params.scope);
  if (params?.projectId) searchParams.set("projectId", params.projectId);
  const queryString = searchParams.toString();
  return `${API_CONFIG.ENDPOINTS.SKILLS}${queryString ? `?${queryString}` : ""}`;
};

export const getSkillDetailUrl = (
  skillId: string,
  params?: { scope?: string; projectId?: string },
) => {
  const searchParams = new URLSearchParams();
  if (params?.scope) searchParams.set("scope", params.scope);
  if (params?.projectId) searchParams.set("projectId", params.projectId);
  const queryString = searchParams.toString();
  return `${API_CONFIG.ENDPOINTS.SKILL_DETAIL}/${encodeURIComponent(skillId)}${queryString ? `?${queryString}` : ""}`;
};

export const getInstallSkillUrl = () => {
  return API_CONFIG.ENDPOINTS.INSTALL_SKILL;
};

export const getDeleteSkillUrl = () => {
  return API_CONFIG.ENDPOINTS.DELETE_SKILL;
};

export const getToggleSkillUrl = () => {
  return API_CONFIG.ENDPOINTS.TOGGLE_SKILL;
};

export const getScanSkillsUrl = () => {
  return API_CONFIG.ENDPOINTS.SCAN_SKILLS;
};

// Cowork API helpers
export const getCoworkTasksUrl = (params?: {
  status?: string;
  limit?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  const queryString = searchParams.toString();
  return `${API_CONFIG.ENDPOINTS.COWORK_TASKS}${queryString ? `?${queryString}` : ""}`;
};

export const getCoworkTaskUrl = (taskId: string) => {
  return `${API_CONFIG.ENDPOINTS.COWORK_TASKS}/${encodeURIComponent(taskId)}`;
};

export const getCoworkCreateUrl = () => {
  return API_CONFIG.ENDPOINTS.COWORK_CREATE;
};

export const getCoworkCancelUrl = (taskId: string) => {
  return `${API_CONFIG.ENDPOINTS.COWORK_CANCEL}/${encodeURIComponent(taskId)}`;
};

export const getCoworkSSEUrl = (sessionId?: string) => {
  return sessionId
    ? `${API_CONFIG.ENDPOINTS.COWORK_SSE}?sessionId=${encodeURIComponent(sessionId)}`
    : API_CONFIG.ENDPOINTS.COWORK_SSE;
};
