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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await api.listProjects();
      const projects = res.data?.projects ?? (res.data as unknown as Project[]) ?? [];
      set({ projects });
    } finally {
      set({ isLoading: false });
    }
  },

  addProject: async (project) => {
    await api.putProject(project);
    set(state => ({ projects: [...state.projects, project] }));
  },

  updateProject: async (project) => {
    await api.putProject(project);
    set(state => ({
      projects: state.projects.map(p => p.id === project.id ? project : p),
    }));
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set(state => ({ projects: state.projects.filter(p => p.id !== id) }));
  },

  getByOwner: (ownerName) => get().projects.filter(p => p.owner === ownerName),
  getParentProjects: () => get().projects.filter(p => !p.parentId),
  getSubProjects: (parentId) => get().projects.filter(p => p.parentId === parentId),
}));
