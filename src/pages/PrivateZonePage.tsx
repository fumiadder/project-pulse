import { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useUIStore } from '@/stores/useUIStore';
import { usePrivateStore } from '@/stores/usePrivateStore';
import { PasswordGate } from '@/components/private/PasswordGate';
import { IdeaEditorModal } from '@/components/modals/IdeaEditorModal';
import { LandIdeaModal } from '@/components/modals/LandIdeaModal';
import type { Idea } from '@/types';

export function PrivateZonePage() {
  const { currentUser } = useUserStore();
  const { setActivePage } = useUIStore();
  const {
    ideas, isUnlocked, isLoading,
    checkUnlockStatus, unlock,
    loadIdeas, addIdea, updateIdea, deleteIdea, landIdea,
  } = usePrivateStore();

  const [password, setPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [landModalOpen, setLandModalOpen] = useState(false);
  const [landingIdea, setLandingIdea] = useState<Idea | null>(null);

  useEffect(() => {
    if (currentUser && checkUnlockStatus(currentUser.id)) {
      loadIdeas(currentUser.id);
    }
  }, [currentUser]);

  const handleVerify = async () => {
    if (!currentUser || !password.trim()) return;
    const valid = await usePrivateStore.getState().verifyPassword(currentUser.id, password);
    if (valid) {
      unlock(currentUser.id);
      loadIdeas(currentUser.id);
      setVerifyError('');
    } else {
      setVerifyError('密码错误');
    }
  };

  const handleSaveIdea = async (idea: Idea) => {
    if (editingIdea) {
      await updateIdea(idea);
    } else {
      await addIdea(idea);
    }
    setEditingIdea(null);
  };

  const handleLand = async (projectData: Partial<Project>) => {
    if (!landingIdea) return;
    try {
      await landIdea(landingIdea.id, projectData);
      setLandModalOpen(false);
      setLandingIdea(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '落地失败');
    }
  };

  const handleNavigateToProject = (projectId: string) => {
    setActivePage('projects');
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 animate-fade-in-up">
        <PasswordGate password={password} setPassword={setPassword} onVerify={handleVerify} error={verifyError} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-text-primary">私密空间</h1>
          <p className="text-xs text-text-muted mt-0.5">仅自己可见的想法与计划</p>
        </div>
        <button
          onClick={() => { setEditingIdea(null); setIdeaModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-white hover:bg-accent-cyan/80 transition-all"
        >
          <i className="fas fa-plus" />
          新建想法
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <i className="fas fa-spinner fa-spin text-text-muted" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <i className="fas fa-lightbulb text-3xl text-text-muted/30 mb-3" />
          <p className="text-sm text-text-muted">暂无想法，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className={`flex flex-col gap-3 rounded-xl border p-4 transition-all hover:scale-[1.01] ${
                idea.status === 'landed'
                  ? 'border-accent-green/20 bg-accent-green/5'
                  : 'border-border-custom/50 bg-bg-secondary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  idea.priority === '高' ? 'bg-accent-red/10 text-accent-red' :
                  idea.priority === '低' ? 'bg-accent-cyan/10 text-accent-cyan' :
                  'bg-yellow-400/10 text-yellow-400'
                }`}>
                  {idea.priority}
                </span>
                {idea.status === 'landed' && (
                  <span className="text-xs font-medium text-accent-green">已落地</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-text-primary">{idea.title}</h3>
              <p className="text-xs text-text-muted line-clamp-3">{idea.content || '暂无描述'}</p>
              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border-custom/30">
                {idea.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => { setEditingIdea(idea); setIdeaModalOpen(true); }}
                      className="text-xs text-text-muted hover:text-accent-cyan transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => { setLandingIdea(idea); setLandModalOpen(true); }}
                      className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                    >
                      落地
                    </button>
                  </>
                ) : idea.landedProjectId ? (
                  <button
                    onClick={() => handleNavigateToProject(idea.landedProjectId!)}
                    className="text-xs text-accent-green hover:text-accent-green/80 transition-colors"
                  >
                    查看项目 →
                  </button>
                ) : null}
                <button
                  onClick={() => deleteIdea(idea.id)}
                  className="text-xs text-text-muted hover:text-accent-red transition-colors ml-auto"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <IdeaEditorModal
        open={ideaModalOpen}
        onClose={() => setIdeaModalOpen(false)}
        idea={editingIdea}
        userId={currentUser?.id ?? ''}
        onSave={handleSaveIdea}
      />
      <LandIdeaModal
        open={landModalOpen}
        onClose={() => { setLandModalOpen(false); setLandingIdea(null); }}
        idea={landingIdea}
        onLand={handleLand}
      />
    </div>
  );
}
