import type { TodoActionStatus } from '~/types/actions';

export interface TodoPlanItem {
  id: string;
  content: string;
  status: TodoActionStatus;
}

export interface TodoPlan {
  title?: string;
  items: TodoPlanItem[];
}

const TODO_STATUS_ALIASES: Record<string, TodoActionStatus> = {
  pending: 'pending',
  todo: 'pending',
  open: 'pending',
  queued: 'pending',
  in_progress: 'in_progress',
  'in-progress': 'in_progress',
  progress: 'in_progress',
  doing: 'in_progress',
  active: 'in_progress',
  running: 'in_progress',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  finished: 'completed',
  closed: 'completed',
};

function normalizeStatus(input: unknown): TodoActionStatus {
  if (typeof input !== 'string') {
    return 'pending';
  }

  const key = input.trim().toLowerCase().replace(/\s+/g, '_');

  return TODO_STATUS_ALIASES[key] ?? 'pending';
}

function normalizeTitle(input: unknown) {
  if (typeof input !== 'string') {
    return undefined;
  }

  const value = input.trim();
  return value.length > 0 ? value : undefined;
}

function normalizeItems(input: unknown): TodoPlanItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const usedIds = new Set<string>();
  const result: TodoPlanItem[] = [];

  for (const [index, entry] of input.entries()) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const rawContent =
      (entry as { content?: unknown }).content ??
      (entry as { text?: unknown }).text ??
      (entry as { title?: unknown }).title ??
      (entry as { task?: unknown }).task;

    if (typeof rawContent !== 'string') {
      continue;
    }

    const content = rawContent.trim();

    if (!content) {
      continue;
    }

    const rawId = (entry as { id?: unknown }).id;
    const normalizedId = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : `todo-${index + 1}`;
    const id = usedIds.has(normalizedId) ? `${normalizedId}-${index + 1}` : normalizedId;

    usedIds.add(id);

    const status = normalizeStatus((entry as { status?: unknown }).status);

    result.push({
      id,
      content,
      status,
    });
  }

  return result;
}

function parseJsonTodoPlan(input: string): TodoPlan | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      const items = normalizeItems(parsed);

      return items.length > 0
        ? {
            items,
          }
        : null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const objectValue = parsed as {
      title?: unknown;
      items?: unknown;
      todos?: unknown;
      tasks?: unknown;
      plan?: unknown;
    };

    const items = normalizeItems(objectValue.items ?? objectValue.todos ?? objectValue.tasks ?? objectValue.plan);

    if (items.length === 0) {
      return null;
    }

    return {
      title: normalizeTitle(objectValue.title),
      items,
    };
  } catch {
    return null;
  }
}

function parseLineBasedTodoPlan(input: string): TodoPlan | null {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const statusItems: TodoPlanItem[] = [];
  const plainItems: TodoPlanItem[] = [];

  for (const [index, line] of lines.entries()) {
    const checkboxMatch = line.match(/^[-*]\s+\[([ xX~\-])\]\s+(.+)$/);

    if (checkboxMatch) {
      const marker = checkboxMatch[1].toLowerCase();
      const content = checkboxMatch[2].trim();

      if (!content) {
        continue;
      }

      const status: TodoActionStatus = marker === 'x' ? 'completed' : marker === '~' || marker === '-' ? 'in_progress' : 'pending';

      statusItems.push({
        id: `todo-${index + 1}`,
        content,
        status,
      });

      continue;
    }

    const explicitStatusMatch = line.match(/^(?:[-*]|\d+[.)])\s+\[(pending|in_progress|in-progress|completed|done|todo)\]\s+(.+)$/i);

    if (explicitStatusMatch) {
      const content = explicitStatusMatch[2].trim();

      if (!content) {
        continue;
      }

      statusItems.push({
        id: `todo-${index + 1}`,
        content,
        status: normalizeStatus(explicitStatusMatch[1]),
      });

      continue;
    }

    const plainTaskMatch = line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/);

    if (plainTaskMatch) {
      const content = plainTaskMatch[1].trim();

      if (!content) {
        continue;
      }

      plainItems.push({
        id: `todo-${index + 1}`,
        content,
        status: 'pending',
      });
    }
  }

  if (statusItems.length > 0) {
    return {
      items: statusItems,
    };
  }

  if (plainItems.length >= 2) {
    return {
      items: plainItems,
    };
  }

  return null;
}

export function parseTodoPlanContent(input: string): TodoPlan | null {
  const jsonPlan = parseJsonTodoPlan(input);

  if (jsonPlan) {
    return jsonPlan;
  }

  return parseLineBasedTodoPlan(input);
}

function sanitizeTaskText(value: string) {
  return value.replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '');
}

function extractBulletedTasks(prompt: string) {
  const items = prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      return match ? sanitizeTaskText(match[1]) : '';
    })
    .filter(Boolean);

  return Array.from(new Set(items));
}

function extractSentenceTasks(prompt: string) {
  const segments = prompt
    .split(/[\n.!?;]+/)
    .map((segment) => sanitizeTaskText(segment))
    .filter((segment) => segment.length >= 12)
    .filter((segment) => /\s/.test(segment))
    .map((segment) => segment.replace(/^нужно\s+/i, '').replace(/^хочу\s+/i, ''));

  return Array.from(new Set(segments));
}

export function buildAutoTodoPlanFromPrompt(prompt: string): TodoPlan {
  const normalizedPrompt = prompt.trim();
  const compactPrompt = normalizedPrompt.replace(/\s+/g, ' ').trim();

  const candidateTasks = extractBulletedTasks(normalizedPrompt);
  const tasks = (candidateTasks.length >= 2 ? candidateTasks : extractSentenceTasks(normalizedPrompt))
    .slice(0, 5)
    .map((task) => sanitizeTaskText(task))
    .filter(Boolean);

  if (tasks.length >= 2) {
    return {
      title: `План по задаче`,
      items: tasks.map((content, index) => ({
        id: `auto-${index + 1}`,
        content,
        status: 'pending',
      })),
    };
  }

  const fallbackIntro = compactPrompt.slice(0, 72);

  return {
    title: 'Стартовый план',
    items: [
      {
        id: 'auto-1',
        content: fallbackIntro ? `Уточнить цель задачи: ${fallbackIntro}` : 'Уточнить цель и критерии результата',
        status: 'pending',
      },
      {
        id: 'auto-2',
        content: 'Подготовить и внести изменения в проект',
        status: 'pending',
      },
      {
        id: 'auto-3',
        content: 'Проверить результат и зафиксировать изменения',
        status: 'pending',
      },
    ],
  };
}
