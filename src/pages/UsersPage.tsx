import { useState, useMemo } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';

const ROLE_OPTIONS = [
  { value: '管理员', label: '管理员' },
  { value: '项目经理', label: '项目经理' },
] as const;

const COLOR_PRESETS = [
  '#0d9488', '#2563eb', '#7c3aed', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#db2777',
  '#0891b2', '#4f46e5',
];

export function UsersPage() {
  const { users, currentUser, switchUser, addUser, deleteUser } = useUserStore();
  const { projects } = useProjectStore();
  const { entries } = useProgressStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('项目经理');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Compute project count and recent activity count per user
  const userStats = useMemo(() => {
    const statsMap: Record<string, { projectCount: number; activityCount: number }> = {};
    for (const user of users) {
      const userProjects = projects.filter(
        (p) => p.owner === user.name || p.userId === user.id
      );
      const userActivities = entries.filter((e) => e.userId === user.id);
      statsMap[user.id] = {
        projectCount: userProjects.length,
        activityCount: userActivities.length,
      };
    }
    return statsMap;
  }, [users, projects, entries]);

  const adminCount = useMemo(
    () => users.filter((u) => u.role === '管理员').length,
    [users]
  );

  const handleAddUser = async () => {
    if (!newName.trim()) {
      setError('请输入用户名');
      return;
    }
    setError('');

    const newUser = {
      id: `user_${Date.now()}`,
      name: newName.trim(),
      role: newRole,
      color: newColor,
      createdAt: new Date().toISOString(),
    };

    await addUser(newUser);
    setNewName('');
    setNewRole('项目经理');
    setNewColor(COLOR_PRESETS[0]);
    setShowAddForm(false);
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    // Prevent deleting the last admin
    if (user.role === '管理员' && adminCount <= 1) {
      setError('无法删除最后一个管理员');
      setDeleteConfirmId(null);
      return;
    }

    await deleteUser(userId);
    setDeleteConfirmId(null);
  };

  const handleSwitchUser = (userId: string) => {
    switchUser(userId);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-users mr-2 text-accent-cyan" />
          用户管理
        </h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError('');
          }}
          className="flex items-center gap-2 rounded-lg bg-accent-cyan/15 px-4 py-2 text-xs font-medium text-accent-cyan transition-all hover:bg-accent-cyan/25 hover:shadow-[0_0_15px_rgba(0,212,255,0.15)]"
        >
          <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'}`} />
          添加用户
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-red/20 bg-accent-red/5 px-3 py-2 text-xs text-accent-red animate-fade-in-up">
          <i className="fas fa-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <div className="rounded-xl border border-border-primary/20 bg-bg-secondary p-5 animate-fade-in-up space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            <i className="fas fa-user-plus mr-2 text-accent-cyan" />
            新增用户
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">用户名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="请输入用户名"
                className="h-9 w-full rounded-lg border border-border-custom bg-bg-primary/50 px-3 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">角色</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-custom bg-bg-primary/50 px-3 text-sm text-text-primary outline-none transition-all focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">标识颜色</label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      newColor === color
                        ? 'border-white shadow-[0_0_8px_rgba(255,255,255,0.3)] scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setError('');
              }}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-4 py-2 text-xs text-text-secondary transition-all hover:bg-bg-tertiary/80"
            >
              取消
            </button>
            <button
              onClick={handleAddUser}
              className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-semibold text-bg-primary transition-all hover:shadow-lg hover:shadow-accent-cyan/20"
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((user) => {
          const stats = userStats[user.id] ?? { projectCount: 0, activityCount: 0 };
          const isCurrentUser = currentUser?.id === user.id;
          const isDeleting = deleteConfirmId === user.id;

          return (
            <div
              key={user.id}
              className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                isCurrentUser
                  ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-[0_0_15px_rgba(0,212,255,0.1)]'
                  : 'border-border-primary/20 bg-bg-secondary hover:border-accent-cyan/20 hover:shadow-[0_0_10px_rgba(0,212,255,0.05)]'
              }`}
              onClick={() => handleSwitchUser(user.id)}
            >
              {/* Current user badge */}
              {isCurrentUser && (
                <div className="absolute -top-2 right-3 rounded-full bg-accent-cyan px-2 py-0.5 text-[10px] font-semibold text-bg-primary shadow-[0_0_8px_rgba(0,212,255,0.3)]">
                  当前用户
                </div>
              )}

              {/* Avatar + Name + Role */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {user.name}
                  </div>
                  <div className="truncate text-[10px] text-text-muted">
                    {user.role}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-[10px] text-text-muted mb-3">
                <span>
                  <i className="fas fa-project-diagram mr-1 text-accent-cyan/60" />
                  {stats.projectCount} 个项目
                </span>
                <span>
                  <i className="fas fa-pen-alt mr-1 text-accent-green/60" />
                  {stats.activityCount} 条动态
                </span>
              </div>

              {/* Delete button */}
              <div className="flex justify-end">
                {isDeleting ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-accent-red">确认删除？</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUser(user.id);
                      }}
                      className="rounded px-2 py-1 text-[10px] font-medium bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition-colors"
                    >
                      删除
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="rounded px-2 py-1 text-[10px] font-medium bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setError('');
                      setDeleteConfirmId(user.id);
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-accent-red/10 hover:text-accent-red"
                  >
                    <i className="fas fa-trash-alt" />
                    删除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <i className="fas fa-users text-3xl text-accent-cyan/20 mb-3" />
          <p className="text-sm">暂无用户数据</p>
        </div>
      )}
    </div>
  );
}
