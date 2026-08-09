import { create } from 'zustand';
import type { Todo } from '@/types';
import { api } from '@/services/api';

/** 安全解析 tags 字段（可能为 JSON 数组或逗号分隔文本） */
function safeParseTags(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return val.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** 安全解析 images 字段（JSON 数组字符串） */
function safeParseImages(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 安全解析 subtasks 字段 */
function safeParseSubtasks(val: any): import('@/types').SubTask[] {
  if (!val) return [];
  let parsed: any[] = [];
  if (typeof val === 'string') {
    try {
      parsed = JSON.parse(val);
    } catch {
      return [];
    }
  } else if (Array.isArray(val)) {
    parsed = val;
  }
  // 规范化：确保每个子任务字段完整
  return parsed.map((s: any) => ({
    id: String(s.id ?? ''),
    title: String(s.title ?? ''),
    done: Boolean(s.done),
    note: s.note ?? undefined,
    noteColor: s.noteColor ?? undefined,
  }));
}

interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  loadTodos: (userId?: string) => Promise<void>;
  addTodo: (todo: Todo) => Promise<void>;
  updateTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  toggleSubtask: (todoId: string, subtaskId: string) => Promise<void>;
  getByUserId: (userId: string) => Todo[];
}

const safeTodos = (state: { todos?: Todo[] }): Todo[] =>
  Array.isArray(state.todos) ? state.todos : [];

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  isLoading: false,

  loadTodos: async (userId?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.listTodos(userId);
      const raw = res.data ?? [];
      const todos = raw.map((t: any) => ({
        ...t,
        tags: safeParseTags(t.tags),
        reminderTime: t.reminderTime ?? null,
        images: safeParseImages(t.images),
        pinned: t.pinned === true || t.pinned === 1 || t.pinned === 'true' || t.pinned === '1',
        subtasks: safeParseSubtasks(t.subtasks),
      }));
      set({ todos });
    } finally {
      set({ isLoading: false });
    }
  },

  addTodo: async (todo) => {
    const res = await api.putTodo(todo);
    if (!res.success) {
      throw new Error(res.error || '创建待办失败');
    }
    set((state) => ({ todos: [todo, ...safeTodos(state)] }));
  },

  updateTodo: async (todo) => {
    const res = await api.putTodo(todo);
    if (!res.success) {
      throw new Error(res.error || '保存待办失败');
    }
    set((state) => ({
      todos: safeTodos(state).map((t) => (t.id === todo.id ? todo : t)),
    }));
  },

  deleteTodo: async (id) => {
    await api.deleteTodo(id);
    set((state) => ({ todos: safeTodos(state).filter((t) => t.id !== id) }));
  },

  toggleComplete: async (id) => {
    const todo = safeTodos(get()).find((t) => t.id === id);
    if (!todo) return;
    const now = new Date().toISOString();
    const updated: Todo = {
      ...todo,
      status: todo.status === 'completed' ? 'pending' : 'completed',
      completedAt: todo.status === 'completed' ? null : now,
      updatedAt: now,
    };
    await get().updateTodo(updated);
  },

  togglePin: async (id) => {
    const todo = safeTodos(get()).find((t) => t.id === id);
    if (!todo) return;
    const updated: Todo = {
      ...todo,
      pinned: !todo.pinned,
      updatedAt: new Date().toISOString(),
    };
    await get().updateTodo(updated);
  },

  toggleSubtask: async (todoId, subtaskId) => {
    const todo = safeTodos(get()).find((t) => t.id === todoId);
    if (!todo) return;
    const updated: Todo = {
      ...todo,
      subtasks: todo.subtasks.map((st) =>
        st.id === subtaskId ? { ...st, done: !st.done } : st,
      ),
      updatedAt: new Date().toISOString(),
    };
    await get().updateTodo(updated);
  },

  getByUserId: (userId) => safeTodos(get()).filter((t) => t.userId === userId),
}));
