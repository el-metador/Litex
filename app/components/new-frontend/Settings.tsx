import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart2, Database, FileText, GitPullRequest, Shield, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { m, useReducedMotion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { Card } from '~/components/ui/Card';
import { motionVariants } from '~/lib/motion/config';
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
  const reduceMotion = useReducedMotion();
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

            <Card elevation={2} className="space-y-4 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white">Системный промпт агента</label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(event) => setSettings((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                  className="ui-focus-ring min-h-[140px] w-full rounded-[var(--radius-md)] border border-white/10 bg-[rgba(0,0,0,0.18)] p-3 text-sm text-gray-200 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white">Формат ветки</label>
                <input
                  value={settings.branchFormat}
                  onChange={(event) => setSettings((prev) => ({ ...prev, branchFormat: event.target.value }))}
                  className="ui-focus-ring w-full rounded-[var(--radius-md)] border border-white/10 bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-gray-200 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white">Режим ответов</label>
                <select
                  value={settings.responseMode}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      responseMode: event.target.value as AgentSettingsPayload['responseMode'],
                    }))
                  }
                  className="ui-focus-ring w-full rounded-[var(--radius-md)] border border-white/10 bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-gray-200 outline-none"
                >
                  <option value="strict">Strict</option>
                  <option value="balanced">Balanced</option>
                  <option value="creative">Creative</option>
                </select>
              </div>

              <div className="text-xs text-gray-400">
                Имя активного агента: <span className="font-medium text-white">Lite Agent</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="primary" size="md" onClick={saveSettings}>
                  Сохранить настройки
                </Button>
                {savedAt ? <span className="text-xs text-gray-400">Сохранено в {savedAt}</span> : null}
              </div>
            </Card>
          </div>
        );
      }

      case 'environments': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Окружения</h2>
            <Card elevation={2} className="space-y-2 p-4 text-sm text-gray-300">
              <p>Текущая рабочая область: LiteCode.</p>
              <p>Ветка по умолчанию: {settings.branchFormat}</p>
              <p>Статус авторизации: {auth.status === 'authenticated' ? 'Авторизован' : 'Гость'}</p>
            </Card>
          </div>
        );
      }

      case 'code_review': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Обзор кода</h2>
            <Card elevation={2} className="space-y-4 p-4">
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
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={settings.reviewScope === option.id ? 'primary' : 'secondary'}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          reviewScope: option.id as AgentSettingsPayload['reviewScope'],
                        }))
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        );
      }

      case 'usage': {
        return (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Использование</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadUsageData()}>
                {isLoadingUsage ? 'Обновление...' : 'Обновить'}
              </Button>
            </div>

            <Card elevation={2} className="space-y-4 p-4">
              <div>
                <div className="mb-1 text-sm text-gray-300">Дневной лимит чата</div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-[#10a37f] transition-[width] duration-300" style={{ width: `${usage.chatPercent}%` }} />
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {limitsData ? `${limitsData.limits.chat.remaining}/${limitsData.limits.chat.dailyLimit}` : 'Данные не загружены'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-300">Дневной лимит enhancer</div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-[#10a37f] transition-[width] duration-300" style={{ width: `${usage.enhancerPercent}%` }} />
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {limitsData
                    ? `${limitsData.limits.enhancer.remaining}/${limitsData.limits.enhancer.dailyLimit}`
                    : 'Данные не загружены'}
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm text-gray-300">Финансовый лимит месяца</div>
                <div className="h-2 w-full rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-[#10a37f] transition-[width] duration-300" style={{ width: `${usage.balancePercent}%` }} />
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {billingData
                    ? `${centsToCurrency(billingData.billing.balanceCents, billingData.billing.currency)} доступно`
                    : 'Данные не загружены'}
                </div>
              </div>
            </Card>
          </div>
        );
      }

      case 'analytics': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Аналитика</h2>
            <Card elevation={2} className="space-y-2 p-4 text-sm text-gray-300">
              <p>План: {auth.plan || 'free'}</p>
              <p>Сессия пользователя: {auth.status === 'authenticated' ? auth.userId : 'anonymous'}</p>
              <p>Режим ответов агента: {settings.responseMode}</p>
            </Card>
          </div>
        );
      }

      case 'data_controls': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Элементы управления данными</h2>
            <Card elevation={2} className="space-y-3 p-4">
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
            </Card>
          </div>
        );
      }

      case 'documents': {
        return (
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-semibold">Документы</h2>
            <Card elevation={2} className="space-y-3 p-4">
              <label className="block text-sm font-medium text-white">Промпт работы с документацией</label>
              <textarea
                value={settings.documentsPrompt}
                onChange={(event) => setSettings((prev) => ({ ...prev, documentsPrompt: event.target.value }))}
                className="ui-focus-ring min-h-[120px] w-full rounded-[var(--radius-md)] border border-white/10 bg-[rgba(0,0,0,0.18)] p-3 text-sm text-gray-200 outline-none"
              />
              <p className="text-xs text-gray-400">Этот текст добавляется как контекст, когда агент анализирует документы и спецификации.</p>
            </Card>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const backdropVariants = reduceMotion ? motionVariants.modalReduced : motionVariants.modalBackdrop;
  const panelVariants = reduceMotion ? motionVariants.modalReduced : motionVariants.modalPanel;

  return (
    <m.div
      variants={backdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="overlay-backdrop fixed inset-0 z-[70] flex items-center justify-center px-3 py-4 md:px-8 md:py-8"
    >
      <button type="button" onClick={onClose} aria-label="Close settings" className="absolute inset-0 border-none bg-transparent" />

      <m.section
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="surface-card elevation-5 relative z-10 flex h-full max-h-[92vh] w-full max-w-[1220px] flex-col text-white"
      >
        <div className="absolute right-3 top-3 z-20">
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </Button>
        </div>

        <div className="flex h-full flex-col md:flex-row">
          <aside className="hidden border-r border-white/10 px-3 pb-4 pt-16 md:flex md:w-72 md:flex-col">
            <h1 className="mb-4 px-3 text-xl font-semibold">Настройки</h1>
            <div className="space-y-1 overflow-y-auto pr-1">
              {SIDEBAR_ITEMS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={activeTab === item.id ? 'secondary' : 'ghost'}
                  size="md"
                  onClick={() => setActiveTab(item.id)}
                  className="w-full justify-start"
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Button>
              ))}
            </div>
          </aside>

          <div className="border-b border-white/10 px-3 pt-12 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-3">
              {SIDEBAR_ITEMS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={activeTab === item.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab(item.id)}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <section className="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-10 md:pt-16">{renderContent()}</section>
        </div>
      </m.section>
    </m.div>
  );
}
