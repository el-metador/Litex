import { useState } from 'react';
import { ArrowUp, GitBranch, Github, Layers, Mic, Plus, Search } from 'lucide-react';
import { Dropdown } from './Dropdown';
import type { Branch, Repository } from './types';

interface DashboardProps {
  onStartTask: (prompt: string) => void;
  showToast: (msg: string) => void;
  repositories: Repository[];
  branches: Branch[];
}

const SUGGESTIONS = [
  {
    title: 'Объясни кодовую базу проекта',
    description: 'Разберись в архитектуре, ключевых модулях и опиши, с чего лучше начать развитие.',
  },
  {
    title: 'Сделай аудит текущего UI',
    description: 'Найди самые важные улучшения интерфейса и предложи пошаговый план внедрения.',
  },
];

export function Dashboard({ onStartTask, showToast, repositories, branches }: DashboardProps) {
  const [selectedRepo, setSelectedRepo] = useState<Repository | undefined>(repositories[0]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>(branches[0]);
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'review' | 'archive'>('tasks');

  const handleSubmit = () => {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    onStartTask(trimmed);
    showToast('Задача отправлена в чат');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-10 pb-20 md:pt-24">
      <h1 className="text-3xl md:text-5xl font-medium text-center text-white mb-12 tracking-tight leading-tight">
        Что теперь будем
        <br />
        программировать?
      </h1>

      <div className="bg-[#252525] rounded-3xl border border-[#3e3e3e] shadow-2xl mb-12 transition-all focus-within:ring-1 focus-within:ring-gray-600 focus-within:border-gray-500 overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <textarea
            className="w-full bg-transparent text-white text-lg placeholder-gray-500 resize-none outline-none min-h-[60px]"
            placeholder="Опишите задачу"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between px-3 pb-3 gap-2">
          <div className="flex items-center gap-1">
            <button type="button" className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors" aria-label="Attach files">
              <Plus size={20} />
            </button>

            <Dropdown<Repository>
              options={repositories}
              selected={selectedRepo}
              onSelect={setSelectedRepo}
              renderItem={(repo) => `${repo.owner}/${repo.name}`}
              keyExtractor={(repo) => repo.id}
              placeholder="Репозиторий"
              icon={<Github size={18} />}
              minimal={true}
              emptyText="Репозитории не найдены"
            />

            <Dropdown<Branch>
              options={branches}
              selected={selectedBranch}
              onSelect={setSelectedBranch}
              renderItem={(branch) => branch.name}
              keyExtractor={(branch) => branch.id}
              placeholder="Ветка"
              icon={<GitBranch size={18} />}
              minimal={true}
              emptyText="Ветки не найдены"
            />

            <button
              type="button"
              className="flex items-center gap-1.5 p-1.5 text-sm text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
              aria-label="Workspace layers"
            >
              <Layers size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors" aria-label="Voice input">
              <Mic size={20} />
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className={`p-2 rounded-full transition-all duration-200 ${prompt.trim() ? 'bg-white text-black hover:bg-gray-200 shadow-lg' : 'bg-[#333] text-gray-500 cursor-not-allowed'}`}
              aria-label="Send prompt"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 border-b border-[#3e3e3e] mb-8 px-1">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'tasks' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Задачи
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'review' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Проверка кода
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'archive' ? 'text-white border-white' : 'text-gray-400 border-transparent hover:text-gray-200'}`}
        >
          Архив
        </button>

        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="text-gray-400 hover:text-white transition-colors" aria-label="Search tasks">
            <Search size={18} />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 px-1">Быстрый старт</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUGGESTIONS.map((suggestion) => (
            <div key={suggestion.title} className="bg-[#252525] border border-[#3e3e3e] rounded-2xl p-6 hover:border-gray-500 transition-all shadow-sm hover:shadow-md">
              <h3 className="text-white font-medium mb-3 text-base">{suggestion.title}</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">{suggestion.description}</p>
              <button
                type="button"
                onClick={() => onStartTask(suggestion.title)}
                className="px-5 py-2.5 bg-[#333] hover:bg-[#444] text-white text-sm font-medium rounded-xl transition-colors"
              >
                Начать
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
