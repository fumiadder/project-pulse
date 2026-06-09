// ============================================
// Project Pulse - TypeScript Type Definitions
// ============================================

/** User entity */
export interface User {
  id: string;
  name: string;
  role: string;
  color: string;
  createdAt: string;
}

/** Project entity */
export interface Project {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  desc: string;
  owner: string;
  color: string;
  priority: string;
  status: string;
  startDate: string;
  endDate: string;
  collaborators: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Attachment within a progress entry */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  isImage: boolean;
}

/** Progress / daily update entry */
export interface Progress {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  percent: number;
  status: 'normal' | 'warning' | 'danger' | 'info';
  content: string;
  plan: string;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

/** Daily tag for categorizing work */
export interface DailyTag {
  id: string;
  userId: string;
  date: string;
  tag: string;
  content: string;
  majorProject: string;
  subProject: string;
  owner: string;
  createdAt: string;
}

/** Generated report */
export interface Report {
  id: string;
  userId: string;
  type: 'daily' | 'weekly' | 'monthly';
  date: string;
  entryCount: number;
  generatedAt: string;
}

/** Full sync data payload */
export interface SyncData {
  projects: Project[];
  progress: Progress[];
  users: User[];
  reports: Report[];
  daily_tags: DailyTag[];
  settings: Record<string, string>;
}

// ============================================
// API Response Wrappers
// ============================================

/** Standard API response envelope */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Health check response */
export interface HealthResponse {
  status: string;
  timestamp: string;
  version?: string;
}
