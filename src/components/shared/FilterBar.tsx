import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  placeholder?: string;
}

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '有风险' },
  { value: 'danger', label: '延期' },
];

export function FilterBar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  placeholder = '搜索项目名称...',
}: FilterBarProps) {
  const hasFilter = searchValue !== '' || statusFilter !== 'all';

  const handleClear = () => {
    onSearchChange('');
    onStatusChange('all');
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="border-border-custom bg-bg-tertiary pl-9 text-text-primary placeholder:text-text-muted focus:border-accent-cyan/50 focus:ring-accent-cyan/20"
        />
      </div>
      <div className="flex items-center gap-2">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              statusFilter === opt.value
                ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_10px_rgba(0,212,255,0.15)]'
                : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80 hover:text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {/* Clear / Reset button */}
        {hasFilter && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 rounded-lg border border-accent-red/20 bg-accent-red/5 px-2.5 py-1.5 text-xs text-accent-red transition-all duration-200 hover:bg-accent-red/10 hover:border-accent-red/30 animate-fade-in-up"
            title="清除筛选"
          >
            <X className="h-3 w-3" />
            <span>清除</span>
          </button>
        )}
      </div>
    </div>
  );
}
