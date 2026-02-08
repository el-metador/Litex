import type { Actor } from './auth';
import { getServiceSupabaseClient } from './supabase';
import { withTimeout } from './timeout';
import type { UsageFeature } from './usage';

export interface BillingSnapshot {
  plan: Actor['plan'];
  creditBalanceUsd: number;
  spentTodayUsd: number;
  hardLimitUsd: number | null;
}

const USD_PER_1K_TOKENS: Record<UsageFeature, number> = {
  chat: 0.006,
  enhancer: 0.003,
};

function getUtcDayStartIso() {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return dayStart.toISOString();
}

export function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCostUsd(feature: UsageFeature, tokens: number) {
  return Number(((tokens / 1000) * USD_PER_1K_TOKENS[feature]).toFixed(6));
}

export async function getBillingSnapshot(actor: Actor): Promise<BillingSnapshot> {
  if (actor.isAnonymous) {
    return {
      plan: actor.plan,
      creditBalanceUsd: 0,
      spentTodayUsd: 0,
      hardLimitUsd: 0,
    };
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return {
      plan: actor.plan,
      creditBalanceUsd: 0,
      spentTodayUsd: 0,
      hardLimitUsd: null,
    };
  }

  type AccountRow = { credit_balance_usd: number | string | null; hard_limit_usd: number | string | null };
  type LedgerRow = { amount_usd: number | string | null };

  let accountRow: AccountRow | null = null;
  let ledgerRows: LedgerRow[] = [];

  try {
    const [accountResult, ledgerResult] = await Promise.all([
      withTimeout(
        supabase.from('billing_accounts').select('credit_balance_usd, hard_limit_usd').eq('user_id', actor.userId).maybeSingle(),
        4000,
        'Supabase billing account timeout',
      ),
      withTimeout(
        supabase.from('billing_ledger').select('amount_usd').eq('user_id', actor.userId).gte('created_at', getUtcDayStartIso()),
        4000,
        'Supabase billing ledger timeout',
      ),
    ]);

    accountRow = (accountResult as { data: AccountRow | null }).data;
    ledgerRows = ((ledgerResult as { data: LedgerRow[] | null }).data ?? []) as LedgerRow[];
  } catch {
    return {
      plan: actor.plan,
      creditBalanceUsd: 0,
      spentTodayUsd: 0,
      hardLimitUsd: null,
    };
  }

  const spentTodayUsd = ledgerRows.reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
  const creditBalanceUsd = Number(accountRow?.credit_balance_usd ?? 0);
  const hardLimitRaw = accountRow?.hard_limit_usd;
  const hardLimitUsd = hardLimitRaw === null || hardLimitRaw === undefined ? null : Number(hardLimitRaw);

  return {
    plan: actor.plan,
    creditBalanceUsd,
    spentTodayUsd: Number(spentTodayUsd.toFixed(6)),
    hardLimitUsd,
  };
}

export async function recordBillingEvent(
  actor: Actor,
  feature: UsageFeature,
  requestId: string,
  tokens: number,
  metadata: Record<string, unknown> = {},
) {
  if (actor.isAnonymous) {
    return;
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return;
  }

  const amountUsd = estimateCostUsd(feature, tokens);

  try {
    await withTimeout(
      supabase.from('billing_ledger').insert({
        user_id: actor.userId,
        request_id: requestId,
        feature,
        tokens,
        amount_usd: amountUsd,
        metadata,
        created_at: new Date().toISOString(),
      }),
      3000,
      'Supabase billing insert timeout',
    );
  } catch {
    // noop
  }
}
