import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart2, Database, FileText, GitPullRequest, Shield, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { authStore } from '~/lib/stores/auth';
import { Toggle } from './Toggle';
import type { SettingsTab } from './types';

interface SettingsProps {
  onClose: () => void;
}

interface LimitsPayload {
  authenticated: boolean;
  userId?: string;
  plan?: string;
  limits: {
    chat: {
      dailyLimit: number;
      remaining: number;
    };
    enhancer: {
      dailyLimit: number;
      remaining: number;
    };
  };
}

interface BillingPayload {
  billing: {
    currency: string;
    balanceCents: number;
    spentCents: number;
    monthlyLimitCents: number;
  };
}

interface AgentSettingsPayload {
  systemPrompt: string;
  branchFormat: string;
  responseMode: 'strict' | 'balanced' | 'creative';
  doubleReview: boolean;
  reviewScope: 'none' | 'me' | 'workspace';
  allowTelemetry: boolean;
  documentsPrompt: string;
}

const SETTINGS_STORAGE_KEY = 'litecode_agent_settings_v1';

const SIDEBAR_ITEMS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: 'general', label: 'Общее', icon: <FileText size={18} /> },
  { id: 'environments', label: 'Окружения', icon: <Database size={18} /> },
  { id: 'code_review', label: 'Обзор кода', icon: <GitPullRequest size={18} /> },
  { id: 'usage', label: 'Использование', icon: <BarChart2 size={18} /> },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart2 size={18} /> },
  { id: 'data_controls', label: 'Элементы управления данными', icon: <Shield size={18} /> },
  { id: 'documents', label: 'Документы', icon: <FileText size={18} /> },
];

const DEFAULT_SETTINGS: AgentSettingsPayload = {
  systemPrompt:
    'Ты Lite Agent. Всегда предлагай план, затем изменения по файлам, и заверши коротким отчетом о рисках.',
  branchFormat: 'lite/{feature}',
  responseMode: 'balanced',
  doubleReview: true,
  reviewScope: 'me',
  allowTelemetry: false,
  documentsPrompt: 'Используй документы проекта как источник правды перед изменением кода.',
};

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
  const [settings, setSettings] = useState<AgentSettingsPayload>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<string>('');
  const [limitsData, setLimitsData] = useState<LimitsPayload | null>(null);
  const [billingData, setBillingData] = useState<BillingPayload | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<AgentSettingsPayload>;

      setSettings((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      // noop
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  };

  const loadUsageData = async () => {
    setIsLoadingUsage(true);

    try {
      const [limitsResponse, billingResponse] = await Promise.all([fetch('/api/limits'), fetch('/api/billing')]);

      if (limitsResponse.ok) {
        setLimitsData((await limitsResponse.json()) as LimitsPayload);
      }

      if (billingResponse.ok) {
        setBillingData((await billingResponse.json()) as BillingPayload);
      }
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const usage = useMemo(() => {
    const chatPercent = limitsData ? toPercent(limitsData.limits.chat.remaining, limitsData.limits.chat.dailyLimit) : 0;
    const enhancerPercent = limitsData
      ? toPercent(limitsData.limits.enhancer.remaining, limitsData.limits.enhancer.dailyLimit)
      : 0;
    const balancePercent =
      billingData && billingData.billing.monthlyLimitCents > 0
        ? Math.round(
            (Math.max(0, billingData.billing.monthlyLimitCents - billingData.billing.spentCents) /
              billingData.billing.monthlyLimitCents) *
              100,
          )
        : 0;

    return { chatPercent, enhancerPercent, balancePercent };
  }, [limitsData, billingData]);

  const renderContent = () => {
    switch (activeTab) {
      case 'general': {
        return (
          <div className="max-w-3xl space-y-6">
            <h2 className="text-2xl font-semibold">Общее</h2>

            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Системный промпт агента</label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(event) => setSettings((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                  className="w-full min-h-[140px] bg-[#252525] border border-[#3e3e3e] rounded-lg p-3 text-sm text-gray-200 outline-none appearance-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">Формат ветки</label>
                <input
                  value={settings.branchFormat}
                  onChange={(event) => setSettings((prev) => ({ ...prev, branchFormat: event.target.value }))}
                  className="w-full bg-[#252525] border border-[#3e3e3e] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none appearance-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">Режим ответов</label>
                <select
                  value={settings.responseMode}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      responseMode: event.target.value as AgentSettingsPayload['responseMode'],
                    }))
                  }
                  className="w-full bg-[#252525] border border-[#3e3e3e] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none appearance-none"
                >
                  <option value="strict">Strict</option>
                  <option value="balanced">Balanced</option>
                  <option value="creative">Creative</option>
                </select>
              </div>

              <div className="text-xs text-gray-400">
                Имя активного агента: <span className="text-white font-medium">Lite Agent</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors border-none appearance-none"
                >
                  Сохранить настройки
                </button>
                {savedAt ? <span className="text-xs text-gray-400">Сохранено в {savedAt}</span> : null}
              </div>
            </div>
          </div>
        );
      }

      case 'environments': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Окружения</h2>
            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 text-sm text-gray-300 space-y-2">
              <p>Текущая рабочая область: LiteCode.</p>
              <p>Ветка по умолчанию: {settings.branchFormat}</p>
              <p>Статус авторизации: {auth.status === 'authenticated' ? 'Авторизован' : 'Гость'}</p>
            </div>
          </div>
        );
      }

      case 'code_review': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Обзор кода</h2>
            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-white">Двойной проход AI-проверки</h3>
                  <p className="text-xs text-gray-400">При включении агент выполняет 2 последовательных проверки и сводит найденные ошибки.</p>
                </div>
                <Toggle
                  checked={settings.doubleReview}
                  onChange={(checked) => setSettings((prev) => ({ ...prev, doubleReview: checked }))}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Область применения</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'none', label: 'Отключено' },
                    { id: 'me', label: 'Для меня' },
                    { id: 'workspace', label: 'Для рабочей области' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          reviewScope: option.id as AgentSettingsPayload['reviewScope'],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        settings.reviewScope === option.id
                          ? 'bg-[#10a37f] text-white border-none appearance-none'
                          : 'bg-[#252525] border border-[#3e3e3e] text-gray-300 hover:bg-[#2f2f2f] appearance-none'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'usage': {
        return (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Использование</h2>
              <button
                type="button"
                onClick={() => void loadUsageData()}
                className="px-3 py-1.5 text-xs rounded-md border border-[#3e3e3e] bg-[#252525] hover:bg-[#2f2f2f] appearance-none"
              >
                {isLoadingUsage ? 'Обновление...' : 'Обновить'}
              </button>
            </div>

            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 space-y-4">
              <div>
                <div className="text-sm text-gray-300 mb-1">Дневной лимит чата</div>
                <div className="w-full h-2 rounded-full bg-[#3e3e3e]">
                  <div className="h-2 rounded-full bg-[#10a37f]" style={{ width: `${usage.chatPercent}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {limitsData ? `${limitsData.limits.chat.remaining}/${limitsData.limits.chat.dailyLimit}` : 'Данные не загружены'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-300 mb-1">Дневной лимит enhancer</div>
                <div className="w-full h-2 rounded-full bg-[#3e3e3e]">
                  <div className="h-2 rounded-full bg-[#10a37f]" style={{ width: `${usage.enhancerPercent}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {limitsData
                    ? `${limitsData.limits.enhancer.remaining}/${limitsData.limits.enhancer.dailyLimit}`
                    : 'Данные не загружены'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-300 mb-1">Финансовый лимит месяца</div>
                <div className="w-full h-2 rounded-full bg-[#3e3e3e]">
                  <div className="h-2 rounded-full bg-[#10a37f]" style={{ width: `${usage.balancePercent}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {billingData
                    ? `${centsToCurrency(billingData.billing.balanceCents, billingData.billing.currency)} доступно`
                    : 'Данные не загружены'}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'analytics': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Аналитика</h2>
            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 text-sm text-gray-300 space-y-2">
              <p>План: {auth.plan || 'free'}</p>
              <p>Сессия пользователя: {auth.status === 'authenticated' ? auth.userId : 'anonymous'}</p>
              <p>Режим ответов агента: {settings.responseMode}</p>
            </div>
          </div>
        );
      }

      case 'data_controls': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Элементы управления данными</h2>
            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-white">Разрешить телеметрию UI</h3>
                  <p className="text-xs text-gray-400">Локальная метрика помогает улучшать стабильность интерфейса.</p>
                </div>
                <Toggle
                  checked={settings.allowTelemetry}
                  onChange={(checked) => setSettings((prev) => ({ ...prev, allowTelemetry: checked }))}
                />
              </div>
              <p className="text-xs text-gray-400">
                Настройки телеметрии и приватности сохраняются локально и применяются только в этом браузере.
              </p>
            </div>
          </div>
        );
      }

      case 'documents': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Документы</h2>
            <div className="bg-[#202123] border border-[#3e3e3e] rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-white">Промпт работы с документацией</label>
              <textarea
                value={settings.documentsPrompt}
                onChange={(event) => setSettings((prev) => ({ ...prev, documentsPrompt: event.target.value }))}
                className="w-full min-h-[120px] bg-[#252525] border border-[#3e3e3e] rounded-lg p-3 text-sm text-gray-200 outline-none appearance-none"
              />
              <p className="text-xs text-gray-400">Этот текст добавляется как контекст, когда агент анализирует документы и спецификации.</p>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#191919] text-white">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-50 bg-transparent border-none appearance-none"
        aria-label="Close settings"
      >
        <X size={22} />
      </button>

      <div className="h-full flex flex-col md:flex-row">
        <aside className="hidden md:flex md:w-64 border-r border-[#3e3e3e] flex-col pt-16 pb-4 px-3">
          <h1 className="text-xl font-semibold px-3 mb-4">Настройки</h1>
          <div className="space-y-1 overflow-y-auto">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 bg-transparent border-none appearance-none ${
                  activeTab === item.id ? 'bg-[#252525] text-white' : 'text-gray-400 hover:bg-[#252525] hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="md:hidden pt-12 px-3 border-b border-[#3e3e3e]">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap appearance-none ${
                  activeTab === item.id ? 'bg-[#252525] text-white border border-[#3e3e3e]' : 'text-gray-300 bg-[#1f1f1f]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <section className="flex-1 overflow-y-auto pt-4 md:pt-16 px-4 md:px-10 pb-8">{renderContent()}</section>
      </div>
    </div>
  );
}
