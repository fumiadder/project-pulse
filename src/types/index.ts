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
  privatePassword?: string; // 独立私密密码
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
  /** 服务器端文件 URL（通过 API 上传时使用） */
  url?: string;
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

/** Idea / 想法实体 */
export interface Idea {
  id: string;
  userId: string;          // 所属用户
  title: string;           // 想法标题
  content: string;         // 想法内容
  tags: string[];          // 标签分类
  status: 'pending' | 'landed';  // 待落地 | 已落地
  landedProjectId: string | null; // 落地后关联的项目ID
  priority: string;
  createdAt: string;
  updatedAt: string;
}

/** Full sync data payload */
export interface SyncData {
  projects: Project[];
  progress: Progress[];
  users: User[];
  reports: Report[];
  daily_tags: DailyTag[];
  ideas: Idea[]; // 新增
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

/** Uploaded file metadata */
export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}
