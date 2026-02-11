import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart2,
  Database,
  FileText,
  GitPullRequest,
  Link,
  Loader2,
  Plus,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { Toggle } from './Toggle';
import type { SettingsTab } from './types';

interface SettingsProps {
  onClose: () => void;
}

const SIDEBAR_ITEMS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: 'general', label: 'Общее', icon: <FileText size={18} /> },
  { id: 'environments', label: 'Окружения', icon: <Database size={18} /> },
  { id: 'code_review', label: 'Обзор кода', icon: <GitPullRequest size={18} /> },
  { id: 'connectors', label: 'Коннекторы', icon: <Link size={18} /> },
  { id: 'usage', label: 'Использование', icon: <BarChart2 size={18} /> },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart2 size={18} /> },
  { id: 'data_controls', label: 'Элементы управления данными', icon: <Shield size={18} /> },
  { id: 'documents', label: 'Документы', icon: <FileText size={18} /> },
];

interface LimitsPayload {
  authenticated: boolean;
  userId?: string;
  plan?: string;
  limits: {
    chat: {
      dailyLimit: number;
      usedToday: number;
      remaining: number;
    };
    enhancer: {
      dailyLimit: number;
      usedToday: number;
      remaining: number;
    };
  };
}

interface BillingPayload {
  authenticated: boolean;
  userId?: string;
  billing: {
    currency: string;
    balanceCents: number;
    spentCents: number;
    monthlyLimitCents: number;
  };
}

interface ChatSessionsPayload {
  sessions: Array<{
    id: string;
    title: string | null;
    messageCount: number;
    lastMessageAt: string;
  }>;
}

function toPercent(remaining: number, dailyLimit: number) {
  if (dailyLimit <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((remaining / dailyLimit) * 100)));
}

function centsToCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function Settings({ onClose }: SettingsProps) {
  const auth = useStore(authStore);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [instructions, setInstructions] = useState('');
  const [branchFormat, setBranchFormat] = useState('codex/{feature}');
  const [autoReview, setAutoReview] = useState(false);
  const [reviewTrigger, setReviewTrigger] = useState('При открытии pull request');
  const [limitsData, setLimitsData] = useState<LimitsPayload | null>(null);
  const [billingData, setBillingData] = useState<BillingPayload | null>(null);
  const [sessionsData, setSessionsData] = useState<ChatSessionsPayload | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const loadUsageData = async () => {
    setIsLoadingUsage(true);

    try {
      const [limitsResponse, billingResponse, sessionsResponse] = await Promise.all([
        fetch('/api/limits'),
        fetch('/api/billing'),
        auth.status === 'authenticated' ? fetch('/api/chat-sessions') : Promise.resolve(null),
      ]);

      if (limitsResponse.ok) {
        setLimitsData((await limitsResponse.json()) as LimitsPayload);
      }

      if (billingResponse.ok) {
        setBillingData((await billingResponse.json()) as BillingPayload);
      }

      if (sessionsResponse && sessionsResponse.ok) {
        setSessionsData((await sessionsResponse.json()) as ChatSessionsPayload);
      }
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const balancePercent = useMemo(() => {
    if (!billingData?.billing.monthlyLimitCents) {
      return 0;
    }

    const left = Math.max(0, billingData.billing.monthlyLimitCents - billingData.billing.spentCents);
    return Math.round((left / billingData.billing.monthlyLimitCents) * 100);
  }, [billingData]);

  const renderContent = () => {
    switch (activeTab) {
      case 'general': {
        return (
          <div className="max-w-2xl space-y-8">
            <div>
              <h2 className="text-2xl font-medium mb-6">Общее</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Пользовательские инструкции</label>
                  <textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    className="w-full h-32 bg-[#252525] border border-[#3e3e3e] rounded-lg p-3 text-sm text-gray-300 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none resize-none"
                    placeholder="Например: всегда предлагай запуск typecheck и test после изменений"
                  />
                  <p className="mt-2 text-xs text-gray-500">Инструкции применяются к вашим последующим задачам.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Формат ветки</label>
                  <input
                    type="text"
                    value={branchFormat}
                    onChange={(event) => setBranchFormat(event.target.value)}
                    className="w-full bg-[#252525] border border-[#3e3e3e] rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-gray-500 outline-none"
                  />
                  <div className="mt-2 text-xs text-gray-500">Доступные теги: {'{feature}'}, {'{date}'}, {'{time}'}</div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'environments': {
        const repoRows = sessionsData?.sessions ?? [];

        return (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium">Окружения</h2>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-[#252525] border border-[#3e3e3e] rounded-lg flex items-center px-3">
                <Search size={16} className="text-gray-500 mr-2" />
                <input
                  type="text"
                  placeholder="Поиск окружений"
                  className="bg-transparent border-none outline-none text-sm text-white h-10 w-full placeholder-gray-500"
                />
              </div>
              <button type="button" className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200 transition-colors" aria-label="Create environment">
                <Plus size={20} />
              </button>
            </div>

            <div className="border border-[#3e3e3e] rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#252525] text-gray-400 font-medium">
                  <tr>
                    <th className="px-4 py-3">Название</th>
                    <th className="px-4 py-3">ID сессии</th>
                    <th className="px-4 py-3">Сообщения</th>
                    <th className="px-4 py-3">Последняя активность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3e3e3e] text-gray-300">
                  {repoRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-gray-500" colSpan={4}>
                        {auth.status === 'authenticated' ? 'Нет активных окружений.' : 'Войдите, чтобы видеть окружения.'}
                      </td>
                    </tr>
                  ) : (
                    repoRows.slice(0, 6).map((session) => (
                      <tr key={session.id} className="hover:bg-[#252525] transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{session.title?.trim() || 'Новая сессия'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{session.id.slice(0, 10)}…</td>
                        <td className="px-4 py-3">{session.messageCount}</td>
                        <td className="px-4 py-3">{new Date(session.lastMessageAt).toLocaleString('ru-RU')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'code_review': {
        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium mb-2">Обзор кода</h2>
            <p className="text-gray-400 text-sm mb-8">Управляйте автоматическим запуском задач ревью для pull request.</p>

            <div className="space-y-8">
              <div className="flex items-center justify-between py-4 border-b border-[#3e3e3e]">
                <div>
                  <div className="font-medium text-white mb-1">Автоматический обзор PR</div>
                  <div className="text-xs text-gray-500 max-w-md">При включении LiteCode будет предлагать проверку изменений после открытия pull request.</div>
                </div>
                <Toggle checked={autoReview} onChange={setAutoReview} />
              </div>

              <div>
                <h3 className="text-white font-medium mb-4">Триггер запуска обзора</h3>
                <div className="relative">
                  <select
                    value={reviewTrigger}
                    onChange={(event) => setReviewTrigger(event.target.value)}
                    className="w-full bg-[#252525] border border-[#3e3e3e] rounded-lg px-3 py-2 text-left text-sm text-white outline-none"
                  >
                    <option>При открытии pull request</option>
                    <option>При обновлении pull request</option>
                    <option>Только вручную</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'connectors': {
        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium mb-8">Коннекторы</h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">GitHub</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{auth.status === 'authenticated' ? 'Подключено через вашу учетную запись' : 'Требуется авторизация'}</span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Slack</h3>
                <p className="text-sm text-gray-400">Подключите Slack, чтобы вызывать задачи и получать апдейты прямо из каналов команды.</p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Linear</h3>
                <p className="text-sm text-gray-400 mb-4">Интеграция позволяет связывать задачи и chat-сессии с тикетами продукта.</p>
                <button type="button" className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
                  Подключить Linear
                </button>
              </div>
            </div>
          </div>
        );
      }

      case 'usage': {
        const chatPercent = limitsData ? toPercent(limitsData.limits.chat.remaining, limitsData.limits.chat.dailyLimit) : 0;
        const enhancerPercent = limitsData
          ? toPercent(limitsData.limits.enhancer.remaining, limitsData.limits.enhancer.dailyLimit)
          : 0;

        return (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-2xl font-medium">Панель использования</h2>
              <button
                type="button"
                onClick={() => void loadUsageData()}
                className="px-3 py-1.5 text-xs rounded-md border border-[#3e3e3e] bg-[#252525] hover:bg-[#2f2f2f] transition-colors"
                disabled={isLoadingUsage}
              >
                {isLoadingUsage ? 'Обновление…' : 'Обновить данные'}
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Лимит чата в день</div>
                <div className="text-2xl font-medium text-white mb-4">
                  {limitsData ? `${chatPercent}%` : '—'} <span className="text-base font-normal text-gray-400">осталось</span>
                </div>
                <div className="w-full bg-[#3e3e3e] rounded-full h-2 mb-2">
                  <div className="bg-[#10a37f] h-2 rounded-full" style={{ width: `${chatPercent}%` }} />
                </div>
                <div className="text-xs text-gray-500">
                  {limitsData ? `${limitsData.limits.chat.remaining} из ${limitsData.limits.chat.dailyLimit}` : 'Нажмите «Обновить данные»'}
                </div>
              </div>

              <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Лимит enhancer в день</div>
                <div className="text-2xl font-medium text-white mb-4">
                  {limitsData ? `${enhancerPercent}%` : '—'} <span className="text-base font-normal text-gray-400">осталось</span>
                </div>
                <div className="w-full bg-[#3e3e3e] rounded-full h-2 mb-2">
                  <div className="bg-[#10a37f] h-2 rounded-full" style={{ width: `${enhancerPercent}%` }} />
                </div>
                <div className="text-xs text-gray-500">
                  {limitsData ? `${limitsData.limits.enhancer.remaining} из ${limitsData.limits.enhancer.dailyLimit}` : 'Нажмите «Обновить данные»'}
                </div>
              </div>

              <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Финансы</div>
                <div className="text-2xl font-medium text-white mb-4">
                  {billingData ? centsToCurrency(billingData.billing.balanceCents, billingData.billing.currency) : '—'}{' '}
                  <span className="text-base font-normal text-gray-400">доступно</span>
                </div>
                <div className="w-full bg-[#3e3e3e] rounded-full h-2 mb-2">
                  <div className="bg-[#10a37f] h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, balancePercent))}%` }} />
                </div>
                <div className="text-xs text-gray-500">
                  {billingData
                    ? `Потрачено ${centsToCurrency(billingData.billing.spentCents, billingData.billing.currency)} из ${centsToCurrency(billingData.billing.monthlyLimitCents, billingData.billing.currency)}`
                    : 'Нажмите «Обновить данные»'}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'analytics': {
        const sessionCount = sessionsData?.sessions.length ?? 0;

        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium mb-6">Аналитика LiteCode</h2>

            <div className="flex flex-wrap gap-3 mb-8">
              <button type="button" className="px-4 py-2 bg-[#252525] border border-[#3e3e3e] rounded-lg text-sm text-white hover:bg-[#2f2f2f] transition-colors" onClick={() => void loadUsageData()}>
                Обновить аналитику
              </button>
            </div>

            <div>
              <h3 className="text-xl font-medium text-white mb-4">Общее</h3>
              <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-6">
                <div className="text-sm text-white mb-4">Активные chat-сессии пользователя</div>
                <div className="text-4xl font-semibold">{auth.status === 'authenticated' ? sessionCount : 0}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {auth.status === 'authenticated' ? 'Основано на данных /api/chat-sessions' : 'Авторизуйтесь для персональной аналитики'}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'data_controls': {
        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium mb-8">Элементы управления данными</h2>

            <div className="border-b border-[#3e3e3e] pb-6">
              <div className="font-medium text-white mb-2">Статус обучения модели</div>
              <div className="text-sm text-gray-400">
                В текущем workspace персональные данные пользователя не используются для обучения модели без отдельного согласия.
              </div>
            </div>
          </div>
        );
      }

      case 'documents': {
        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium mb-6">Документы</h2>
            <div className="text-gray-400 text-sm">Подключите источники, чтобы документы стали доступны в этом разделе.</div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#191919] text-white flex">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-50"
        aria-label="Close settings"
      >
        <X size={24} />
      </button>

      <div className="w-64 border-r border-[#3e3e3e] h-full flex flex-col pt-16 pb-4">
        <div className="px-6 mb-6">
          <h1 className="text-xl font-bold">Настройки</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
                activeTab === item.id ? 'bg-[#252525] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-16 pb-20 px-8 md:px-16 bg-[#191919]">{renderContent()}</div>
    </div>
  );
}
