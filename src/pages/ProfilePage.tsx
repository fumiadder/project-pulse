import { useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { api } from '@/services/api';

export function ProfilePage() {
  const { currentUser } = useUserStore();
  const { projects } = useProjectStore();
  const { entries } = useProgressStore();

  const [privatePassword, setPrivatePassword] = useState('');
  const [privatePasswordConfirm, setPrivatePasswordConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const stats = useMemo(() => {
    if (!currentUser) {
      return { totalProjects: 0, totalEntries: 0 };
    }

    // Projects where user is owner
    const ownedProjects = projects.filter(p => p.owner === currentUser.name);
    // Also projects where user is the userId
    const userProjects = projects.filter(p => p.userId === currentUser.id);
    const allAssigned = new Set([...ownedProjects, ...userProjects]);

    // Progress entries for this user
    const userEntries = entries.filter(e => e.userId === currentUser.id);

    return {
      totalProjects: allAssigned.size,
      totalEntries: userEntries.length,
    };
  }, [currentUser, projects, entries]);

  // Compute project progress for the current user
  const projectProgress = useMemo(() => {
    if (!currentUser) return [];

    return projects
      .filter(p => p.owner === currentUser.name || p.userId === currentUser.id)
      .map(project => {
        // Get the latest progress entry for this project
        const projectEntries = entries.filter(
          e => e.projectId === project.id && e.userId === currentUser.id
        );
        const latestEntry = projectEntries.sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        )[0];

        // Get overall latest entry for this project (from any user)
        const allProjectEntries = entries.filter(e => e.projectId === project.id);
        const overallLatest = allProjectEntries.sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        )[0];

        return {
          id: project.id,
          name: project.name,
          color: project.color,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          userProgress: latestEntry?.percent ?? 0,
          overallProgress: overallLatest?.percent ?? 0,
          latestStatus: latestEntry?.status ?? 'info',
          latestContent: latestEntry?.content ?? '',
          latestDate: latestEntry?.date ?? '',
          entryCount: projectEntries.length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentUser, projects, entries]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'warning': return '有风险';
      case 'danger': return '延期';
      case 'info': return '待更新';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-accent-green';
      case 'warning': return 'text-accent-yellow';
      case 'danger': return 'text-accent-red';
      default: return 'text-text-muted';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-accent-green';
    if (percent >= 50) return 'bg-accent-cyan';
    if (percent >= 30) return 'bg-accent-yellow';
    return 'bg-accent-red';
  };

  const handleSetPrivatePassword = async () => {
    if (!currentUser) return;
    if (privatePassword !== privatePasswordConfirm) {
      setPwError('两次输入不一致');
      setPwSuccess('');
      return;
    }
    if (privatePassword.length < 4) {
      setPwError('密码至少 4 位');
      setPwSuccess('');
      return;
    }
    const updated = { ...currentUser, privatePassword: privatePassword.trim() };
    const res = await api.putUser(updated);
    if (res.success) {
      setPwError('');
      setPwSuccess('私密密码已设置');
      setPrivatePassword('');
      setPrivatePasswordConfirm('');
    } else {
      setPwError(res.error || '设置失败');
      setPwSuccess('');
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in-up">
        <i className="fas fa-user-slash text-4xl text-accent-cyan/30 mb-4" />
        <p className="text-sm text-text-muted">未登录</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up max-w-2xl mx-auto">
      {/* Header */}
      <h2 className="text-lg font-display font-bold text-text-primary">
        <i className="fas fa-user-circle mr-2 text-accent-cyan" />
        个人信息
      </h2>

      {/* Avatar & basic info */}
      <div className="rounded-xl border border-border-primary/20 bg-bg-secondary p-6 flex flex-col items-center gap-4">
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name.slice(0, 1)}
        </div>

        {/* Name & role */}
        <div className="text-center">
          <h3 className="text-lg font-bold text-text-primary">{currentUser.name}</h3>
          <p className="text-sm text-text-muted mt-0.5">{currentUser.role}</p>
        </div>

        {/* User ID */}
        <div className="text-[10px] text-text-muted/50 font-mono">
          ID: {currentUser.id}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 text-center">
          <div className="text-3xl font-bold text-accent-cyan">{stats.totalProjects}</div>
          <div className="text-xs text-text-muted mt-1">
            <i className="fas fa-project-diagram mr-1" />
            负责项目
          </div>
        </div>
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 text-center">
          <div className="text-3xl font-bold text-accent-green">{stats.totalEntries}</div>
          <div className="text-xs text-text-muted mt-1">
            <i className="fas fa-pen-alt mr-1" />
            进度更新
          </div>
        </div>
      </div>

      {/* Additional info */}
      <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 space-y-3">
        <h4 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-info-circle mr-1 text-accent-cyan" />
          账户信息
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">用户名</span>
            <span className="text-text-primary font-medium">{currentUser.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">角色</span>
            <span className="text-text-primary font-medium">{currentUser.role}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">创建时间</span>
            <span className="text-text-primary font-medium">
              {currentUser.createdAt.slice(0, 10)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">标识颜色</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: currentUser.color }}
              />
              <span className="text-text-primary font-mono text-[10px]">{currentUser.color}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Private Password Setting */}
      <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 space-y-3">
        <h4 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-lock mr-1 text-accent-cyan" />
          私密密码设置
        </h4>
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={privatePassword}
            onChange={(e) => setPrivatePassword(e.target.value)}
            placeholder="输入私密密码"
            className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          />
          <input
            type="password"
            value={privatePasswordConfirm}
            onChange={(e) => setPrivatePasswordConfirm(e.target.value)}
            placeholder="确认密码"
            className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          />
          {pwError && <p className="text-xs text-accent-red">{pwError}</p>}
          {pwSuccess && <p className="text-xs text-accent-green">{pwSuccess}</p>}
          <button
            onClick={handleSetPrivatePassword}
            className="w-full rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-white hover:bg-accent-cyan/80 transition-all"
          >
            设置密码
          </button>
        </div>
      </div>

      {/* Project Progress List */}
      <div className="rounded-xl border border-border-primary/20 bg-bg-secondary p-4 space-y-3">
        <h4 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-tasks mr-1 text-accent-cyan" />
          项目进度
        </h4>

        {projectProgress.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-text-muted">
            <i className="fas fa-folder-open text-2xl text-accent-cyan/20 mb-2" />
            <p className="text-xs">暂无分配的项目</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectProgress.map((proj) => (
              <div
                key={proj.id}
                className="rounded-lg border border-border-primary/10 bg-bg-primary/30 p-3 space-y-2"
              >
                {/* Project header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="truncate text-sm font-medium text-text-primary">
                      {proj.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {proj.latestDate && (
                      <span className="text-[10px] text-text-muted font-mono">
                        {proj.latestDate}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium ${getStatusColor(proj.latestStatus)}`}>
                      {getStatusLabel(proj.latestStatus)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-muted">我的进度</span>
                    <span className="text-text-primary font-medium">{proj.userProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(proj.userProgress)}`}
                      style={{ width: `${proj.userProgress}%` }}
                    />
                  </div>
                </div>

                {/* Overall progress */}
                {proj.overallProgress !== proj.userProgress && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-text-muted">整体进度</span>
                      <span className="text-text-primary font-medium">{proj.overallProgress}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-bg-tertiary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-cyan/50 transition-all duration-500"
                        style={{ width: `${proj.overallProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Latest content preview */}
                {proj.latestContent && (
                  <p className="text-[10px] text-text-muted/70 line-clamp-2 leading-relaxed">
                    {proj.latestContent}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
