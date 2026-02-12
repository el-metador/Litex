import { describe, expect, it } from 'vitest';
import { buildAutoTodoPlanFromPrompt, parseTodoPlanContent } from './todo-plan';

describe('todo-plan', () => {
  it('parses json array with status aliases', () => {
    const input = JSON.stringify([
      { id: 'a', content: 'Analyze repo', status: 'todo' },
      { id: 'b', content: 'Implement changes', status: 'in-progress' },
      { id: 'c', content: 'Validate result', status: 'done' },
    ]);

    const plan = parseTodoPlanContent(input);

    expect(plan).not.toBeNull();
    expect(plan?.items).toEqual([
      { id: 'a', content: 'Analyze repo', status: 'pending' },
      { id: 'b', content: 'Implement changes', status: 'in_progress' },
      { id: 'c', content: 'Validate result', status: 'completed' },
    ]);
  });

  it('parses object payload with title and items', () => {
    const input = JSON.stringify({
      title: 'Execution plan',
      items: [
        { content: 'Step 1', status: 'pending' },
        { content: 'Step 2', status: 'completed' },
      ],
    });

    const plan = parseTodoPlanContent(input);

    expect(plan?.title).toBe('Execution plan');
    expect(plan?.items).toHaveLength(2);
    expect(plan?.items[0]).toEqual({
      id: 'todo-1',
      content: 'Step 1',
      status: 'pending',
    });
  });

  it('parses markdown checkbox plan', () => {
    const input = ['- [ ] Collect requirements', '- [~] Apply update', '- [x] Ship release'].join('\n');
    const plan = parseTodoPlanContent(input);

    expect(plan?.items).toEqual([
      { id: 'todo-1', content: 'Collect requirements', status: 'pending' },
      { id: 'todo-2', content: 'Apply update', status: 'in_progress' },
      { id: 'todo-3', content: 'Ship release', status: 'completed' },
    ]);
  });

  it('builds auto plan from bulleted prompt', () => {
    const prompt = ['Нужно сделать:', '- найти блок Todo', '- интегрировать в текущий проект', '- проверить результат'].join('\n');
    const plan = buildAutoTodoPlanFromPrompt(prompt);

    expect(plan.items).toHaveLength(3);
    expect(plan.items[0]?.content).toBe('найти блок Todo');
    expect(plan.items[1]?.content).toBe('интегрировать в текущий проект');
    expect(plan.items[2]?.content).toBe('проверить результат');
    expect(plan.items.every((item) => item.status === 'pending')).toBe(true);
  });

  it('falls back to starter plan for short prompt', () => {
    const plan = buildAutoTodoPlanFromPrompt('fix');

    expect(plan.title).toBe('Стартовый план');
    expect(plan.items).toHaveLength(3);
    expect(plan.items[0]?.status).toBe('pending');
  });
});
