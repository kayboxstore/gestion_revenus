import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type IptvLifecycleStatus =
  "active" | "expiring" | "expired" | "scheduled" | "suspended" | "cancelled";

export type IptvPlan = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  currency: string;
  active: boolean;
};

export type IptvCashAccount = {
  id: string;
  name: string;
  currency: string;
};

export type IptvSubscription = {
  id: string;
  contactId: string;
  customerName: string;
  customerPhone: string | null;
  customerIdentifier: string;
  planId: string;
  planName: string;
  planPrice: string;
  planCurrency: string;
  activationDate: string;
  expirationDate: string;
  lifecycleStatus: IptvLifecycleStatus;
  saleId: string;
  saleNumber: string;
  saleStatus: string;
  renewedFromId: string | null;
};

export type IptvWorkspaceData = {
  configured: boolean;
  authenticated: boolean;
  householdName: string | null;
  baseCurrency: string;
  role: "owner" | "manager" | "operator" | "reader" | null;
  activityActive: boolean;
  plans: IptvPlan[];
  cashAccounts: IptvCashAccount[];
  subscriptions: IptvSubscription[];
  overview: {
    customerCount: number;
    activeCount: number;
    expiringCount: number;
    expiredCount: number;
    nextExpiration: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const emptyData: IptvWorkspaceData = {
  configured: false,
  authenticated: false,
  householdName: null,
  baseCurrency: "USD",
  role: null,
  activityActive: false,
  plans: [],
  cashAccounts: [],
  subscriptions: [],
  overview: {
    customerCount: 0,
    activeCount: 0,
    expiringCount: 0,
    expiredCount: 0,
    nextExpiration: null,
  },
  pagination: { page: 1, pageSize: 24, total: 0, totalPages: 1 },
};

type WorkspaceRow = {
  subscription_id: string;
  contact_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_identifier: string;
  plan_id: string;
  plan_name: string;
  plan_price: string | number;
  plan_currency: string;
  activation_date: string;
  expiration_date: string;
  lifecycle_status: IptvLifecycleStatus;
  sale_id: string;
  sale_number: string;
  sale_status: string;
  renewed_from_id: string | null;
  total_count: string | number;
};

type OverviewRow = {
  customer_count: string | number;
  active_count: string | number;
  expiring_count: string | number;
  expired_count: string | number;
  next_expiration: string | null;
};

export async function getIptvWorkspaceData(options: {
  status: string;
  search: string;
  page: number;
  asOf: string;
}): Promise<IptvWorkspaceData> {
  if (!hasSupabaseEnv()) return emptyData;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...emptyData, configured: true };

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id,role,households(name,base_currency)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member) {
    return { ...emptyData, configured: true, authenticated: true };
  }

  const householdId = member.household_id as string;
  const pageSize = 24;
  const page = Math.max(1, options.page);
  const [
    { data: plans },
    { data: accounts },
    { data: activity },
    overview,
    list,
  ] = await Promise.all([
    supabase
      .from("iptv_plans")
      .select("id,name,duration_days,price,currency,active")
      .eq("household_id", householdId)
      .order("active", { ascending: false })
      .order("duration_days"),
    supabase
      .from("cash_accounts")
      .select("id,name,currency")
      .eq("household_id", householdId)
      .eq("active", true)
      .neq("type", "savings")
      .order("name"),
    supabase
      .from("activities")
      .select("active")
      .eq("household_id", householdId)
      .eq("code", "IPTV")
      .maybeSingle(),
    supabase.rpc("get_iptv_overview", {
      p_household_id: householdId,
      p_as_of: options.asOf,
    }),
    supabase.rpc("get_iptv_subscriptions", {
      p_household_id: householdId,
      p_status: options.status,
      p_search: options.search || null,
      p_as_of: options.asOf,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
  ]);

  const workspaceRows = (list.data ?? []) as WorkspaceRow[];
  const overviewRow = ((overview.data ?? []) as OverviewRow[])[0];
  const total = Number(workspaceRows[0]?.total_count ?? 0);
  const household = member.households as {
    name?: string;
    base_currency?: string;
  } | null;

  return {
    configured: true,
    authenticated: true,
    householdName: household?.name ?? "Foyer",
    baseCurrency: household?.base_currency ?? "USD",
    role: member.role as IptvWorkspaceData["role"],
    activityActive: Boolean(activity?.active),
    plans: (plans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      durationDays: Number(plan.duration_days),
      price: String(plan.price),
      currency: plan.currency,
      active: plan.active,
    })),
    cashAccounts: (accounts ?? []).map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
    })),
    subscriptions: workspaceRows.map((row) => ({
      id: row.subscription_id,
      contactId: row.contact_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerIdentifier: row.customer_identifier,
      planId: row.plan_id,
      planName: row.plan_name,
      planPrice: String(row.plan_price),
      planCurrency: row.plan_currency,
      activationDate: row.activation_date,
      expirationDate: row.expiration_date,
      lifecycleStatus: row.lifecycle_status,
      saleId: row.sale_id,
      saleNumber: row.sale_number,
      saleStatus: row.sale_status,
      renewedFromId: row.renewed_from_id,
    })),
    overview: {
      customerCount: Number(overviewRow?.customer_count ?? 0),
      activeCount: Number(overviewRow?.active_count ?? 0),
      expiringCount: Number(overviewRow?.expiring_count ?? 0),
      expiredCount: Number(overviewRow?.expired_count ?? 0),
      nextExpiration: overviewRow?.next_expiration ?? null,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
