import { create } from 'zustand';
import type { Project } from '@/types';
import { api } from '@/services/api';

// 安全解析可能为 JSON 数组或逗号分隔文本的字段
function safeParseArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [val]; }
    catch { return val.split(',').map((s: string) => s.trim()).filter(Boolean); }
  }
  return [];
}

interface ProjectStore {
  projects: Project[];
  isLoading: boolean;
  loadProjects: () => Promise<void>;
  addProject: (project: Project) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getByOwner: (ownerName: string) => Project[];
  getParentProjects: () => Project[];
  getSubProjects: (parentId: string) => Project[];
}

const safeProjects = (state: { projects?: Project[] }): Project[] =>
  Array.isArray(state.projects) ? state.projects : [];

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await api.listProjects();
      const raw = res.data?.projects ?? (Array.isArray(res.data) ? res.data : []) ?? [];
      const projects = raw.map((p: any) => ({
        ...p,
        collaborators: safeParseArray(p.collaborators),
      }));
      set({ projects });
    } finally {
      set({ isLoading: false });
    }
  },

  addProject: async (project) => {
    const res = await api.putProject(project);
    if (!res.success) {
      throw new Error(res.error || '创建项目失败');
    }
    const saved = Array.isArray(res.data) ? res.data[0] : res.data;
    const savedProject = saved ?? project;
    set(state => ({ projects: [...safeProjects(state), savedProject] }));
  },

  updateProject: async (project) => {
    const prevProjects = get().projects;
    set(state => ({
      projects: safeProjects(state).map(p => p.id === project.id ? project : p),
    }));
    try {
      const res = await api.putProject(project);
      if (!res.success) {
        set({ projects: prevProjects });
        throw new Error(res.error || '保存项目失败');
      }
      const saved = Array.isArray(res.data) ? res.data[0] : res.data;
      const savedProject = saved ?? project;
      if (savedProject.id !== project.id) {
        set(state => ({
          projects: safeProjects(state).map(p =>
            p.id === project.id ? savedProject : (p.id === savedProject.id ? savedProject : p)
          ),
        }));
      }
    } catch (err) {
      set({ projects: prevProjects });
      throw err;
    }
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set(state => ({ projects: safeProjects(state).filter(p => p.id !== id) }));
  },

  getByOwner: (ownerName) => safeProjects(get()).filter(p => p.owner === ownerName),
  getParentProjects: () => safeProjects(get()).filter(p => !p.parentId),
  getSubProjects: (parentId) => safeProjects(get())
    .filter(p => p.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
}));
