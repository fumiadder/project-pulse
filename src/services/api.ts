// ============================================
// Project Pulse - API Client
// ============================================
import type {
  User,
  Project,
  Progress,
  Report,
  DailyTag,
  SyncData,
  ApiResponse,
  HealthResponse,
} from '@/types';

// --------------------------------------------
// API Base URL
// --------------------------------------------
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// --------------------------------------------
// Generic fetch wrapper with error handling
// --------------------------------------------
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data: T = await response.json();
    return { success: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Network request failed';
    return { success: false, error: message };
  }
}

// --------------------------------------------
// Full API Object
// --------------------------------------------
export const api = {
  // --- Health ---
  health(): Promise<ApiResponse<HealthResponse>> {
    return apiFetch<HealthResponse>('/health');
  },

  // --- Projects ---
  listProjects(userId?: string): Promise<ApiResponse<Project[]>> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiFetch<Project[]>(`/projects${query}`);
  },

  getProject(id: string): Promise<ApiResponse<Project>> {
    return apiFetch<Project>(`/projects/${encodeURIComponent(id)}`);
  },

  putProject(project: Project): Promise<ApiResponse<Project>> {
    return apiFetch<Project>('/projects', {
      method: 'PUT',
      body: JSON.stringify(project),
    });
  },

  deleteProject(id: string): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // --- Progress ---
  listProgress(userId?: string, projectId?: string): Promise<ApiResponse<Progress[]>> {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (projectId) params.set('projectId', projectId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<Progress[]>(`/progress${query}`);
  },

  getProgress(id: string): Promise<ApiResponse<Progress>> {
    return apiFetch<Progress>(`/progress/${encodeURIComponent(id)}`);
  },

  putProgress(progress: Progress): Promise<ApiResponse<Progress>> {
    return apiFetch<Progress>('/progress', {
      method: 'PUT',
      body: JSON.stringify(progress),
    });
  },

  deleteProgress(id: string): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/progress/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // --- Users ---
  listUsers(): Promise<ApiResponse<User[]>> {
    return apiFetch<User[]>('/users');
  },

  putUser(user: User): Promise<ApiResponse<User>> {
    return apiFetch<User>('/users', {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },

  deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // --- Full Sync ---
  fullSyncGet(): Promise<ApiResponse<SyncData>> {
    return apiFetch<SyncData>('/sync/full');
  },

  fullSyncPost(data: SyncData): Promise<ApiResponse<SyncData>> {
    return apiFetch<SyncData>('/sync/full', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // --- Settings ---
  getSetting(key: string): Promise<ApiResponse<string>> {
    return apiFetch<string>(`/settings/${encodeURIComponent(key)}`);
  },

  putSetting(key: string, value: string): Promise<ApiResponse<string>> {
    return apiFetch<string>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },
};

export default api;
