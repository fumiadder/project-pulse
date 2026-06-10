import { create } from 'zustand';
import type { Project } from '@/types';
import { api } from '@/services/api';

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
      const projects = res.data?.projects ?? (Array.isArray(res.data) ? res.data : []) ?? [];
      set({ projects });
    } finally {
      set({ isLoading: false });
    }
  },

  addProject: async (project) => {
    await api.putProject(project);
    set(state => ({ projects: [...safeProjects(state), project] }));
  },

  updateProject: async (project) => {
    await api.putProject(project);
    set(state => ({
      projects: safeProjects(state).map(p => p.id === project.id ? project : p),
    }));
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set(state => ({ projects: safeProjects(state).filter(p => p.id !== id) }));
  },

  getByOwner: (ownerName) => safeProjects(get()).filter(p => p.owner === ownerName),
  getParentProjects: () => safeProjects(get()).filter(p => !p.parentId),
  getSubProjects: (parentId) => safeProjects(get()).filter(p => p.parentId === parentId),
}));
