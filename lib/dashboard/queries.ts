import { hasSupabaseEnv, createClient } from "@/lib/supabase/server";

export type DashboardKpis = {
  revenue: string;
  gross_profit: string;
  net_profit: string;
  family_expenses: string;
  savings: string;
  cash: string;
};
export type DashboardActivity = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};
export type DashboardOperation = {
  id: string;
  number: string;
  type: string;
  status: string;
  line_count: number;
};
export type DashboardReference = {
  id: string;
  name: string;
  code?: string;
  type?: string;
  activity_id?: string;
  currency?: string;
  target_amount?: string;
  target_date?: string | null;
  stock_quantity?: string;
};
export type DashboardSale = {
  id: string;
  number: string;
  total_source: string;
  status: string;
};
export type DashboardIptvAlert = {
  subscription_id: string;
  customer_name: string;
  customer_identifier: string;
  expiration_date: string;
  lifecycle_status: "expiring" | "expired";
};
export type HouseholdMember = {
  user_id: string;
  role: "owner" | "manager" | "operator" | "reader";
  status: string;
  display_name: string | null;
};
export type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
};
export type ReportRow = { label: string; amount: string; detail?: string };
export type DashboardReports = {
  activityMargins: ReportRow[];
  expensesByCategory: ReportRow[];
  accountBalances: ReportRow[];
  stock: ReportRow[];
  receivables: ReportRow[];
  savingsProgress: ReportRow[];
};
export type DashboardData = {
  configured: boolean;
  authenticated: boolean;
  householdName: string | null;
  role: "owner" | "manager" | "operator" | "reader" | null;
  kpis: DashboardKpis;
  activities: DashboardActivity[];
  operations: DashboardOperation[];
  products: DashboardReference[];
  cashAccounts: DashboardReference[];
  categories: DashboardReference[];
  savingsGoals: DashboardReference[];
  openSales: DashboardSale[];
  members: HouseholdMember[];
  invitations: Invitation[];
  iptvAlerts: DashboardIptvAlert[];
  reports: DashboardReports;
};

const emptyReports: DashboardReports = {
  activityMargins: [],
  expensesByCategory: [],
  accountBalances: [],
  stock: [],
  receivables: [],
  savingsProgress: [],
};

const zeroKpis: DashboardKpis = {
  revenue: "0.0000",
  gross_profit: "0.0000",
  net_profit: "0.0000",
  family_expenses: "0.0000",
  savings: "0.0000",
  cash: "0.0000",
};

export type DashboardFilters = {
  from?: string | null;
  to?: string | null;
  activityId?: string | null;
};

export async function getDashboardData(
  filters: DashboardFilters = {},
): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return {
      configured: false,
      authenticated: false,
      householdName: null,
      role: null,
      kpis: zeroKpis,
      activities: [],
      operations: [],
      products: [],
      cashAccounts: [],
      categories: [],
      savingsGoals: [],
      openSales: [],
      members: [],
      invitations: [],
      iptvAlerts: [],
      reports: emptyReports,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      configured: true,
      authenticated: false,
      householdName: null,
      role: null,
      kpis: zeroKpis,
      activities: [],
      operations: [],
      products: [],
      cashAccounts: [],
      categories: [],
      savingsGoals: [],
      openSales: [],
      members: [],
      invitations: [],
      iptvAlerts: [],
      reports: emptyReports,
    };
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!member) {
    return {
      configured: true,
      authenticated: true,
      householdName: null,
      role: null,
      kpis: zeroKpis,
      activities: [],
      operations: [],
      products: [],
      cashAccounts: [],
      categories: [],
      savingsGoals: [],
      openSales: [],
      members: [],
      invitations: [],
      iptvAlerts: [],
      reports: emptyReports,
    };
  }

  const householdId = member.household_id as string;
  const kinshasaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let operationsQuery = supabase
    .from("journal_entries")
    .select(
      "id,number,type,status,journal_lines!journal_lines_journal_entry_id_fkey(count)",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (filters.from)
    operationsQuery = operationsQuery.gte("entry_date", filters.from);
  if (filters.to)
    operationsQuery = operationsQuery.lte("entry_date", filters.to);
  if (filters.activityId)
    operationsQuery = operationsQuery.eq("activity_id", filters.activityId);

  const [
    { data: kpis },
    { data: activities },
    { data: operations },
    { data: products },
    { data: inventorySnapshot },
    { data: cashAccounts },
    { data: categories },
    { data: savingsGoals },
    { data: openSales },
    { data: members },
    { data: invitations },
    { data: activityMargins },
    { data: expensesByCategory },
    { data: accountBalances },
    { data: stock },
    { data: receivables },
    { data: savingsProgress },
    { data: iptvAlerts },
  ] = await Promise.all([
    supabase.rpc("get_dashboard_kpis", {
      p_household_id: householdId,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_activity_id: filters.activityId ?? null,
    }),
    supabase
      .from("activities")
      .select("id,code,name,active")
      .eq("household_id", householdId)
      .order("display_order"),
    operationsQuery,
    supabase
      .from("products")
      .select("id,name,type,activity_id")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name"),
    supabase.rpc("get_inventory_snapshot", {
      p_household_id: householdId,
    }),
    supabase
      .from("cash_accounts")
      .select("id,name,type,currency")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id,name,type")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("savings_goals")
      .select("id,name,currency,target_amount,target_date")
      .eq("household_id", householdId)
      .eq("status", "active")
      .order("priority"),
    supabase
      .from("sales")
      .select("id,number,total_source,status")
      .eq("household_id", householdId)
      .in("status", ["confirmed", "partially_paid", "overdue"])
      .order("sale_date", { ascending: false }),
    supabase
      .from("household_members")
      .select("user_id,role,status,profiles(display_name)")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase
      .from("invitations")
      .select("id,email,role,status")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_activity_margins", {
      p_household_id: householdId,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_activity_id: filters.activityId ?? null,
    }),
    supabase.rpc("get_expenses_by_category", {
      p_household_id: householdId,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_activity_id: filters.activityId ?? null,
    }),
    supabase.rpc("get_account_balances", { p_household_id: householdId }),
    supabase.rpc("get_stock_report", { p_household_id: householdId }),
    supabase.rpc("get_receivables_report", { p_household_id: householdId }),
    supabase.rpc("get_savings_progress", { p_household_id: householdId }),
    supabase.rpc("get_iptv_subscriptions", {
      p_household_id: householdId,
      p_status: "attention",
      p_search: null,
      p_as_of: kinshasaToday,
      p_limit: 4,
      p_offset: 0,
    }),
  ]);

  const inventoryByProduct = new Map(
    (
      (inventorySnapshot ?? []) as Array<{
        product_id: string;
        quantity: string | number;
      }>
    ).map((row) => [row.product_id, String(row.quantity)]),
  );

  return {
    configured: true,
    authenticated: true,
    householdName:
      (member.households as { name?: string } | null)?.name ?? "Foyer",
    role: member.role as DashboardData["role"],
    kpis: (Array.isArray(kpis) ? kpis[0] : kpis) ?? zeroKpis,
    activities: (activities ?? []) as DashboardActivity[],
    operations: (operations ?? []).map((row) => ({
      id: row.id,
      number: row.number,
      type: row.type,
      status: row.status,
      line_count: row.journal_lines?.[0]?.count ?? 0,
    })),
    products: (products ?? []).map((product) => ({
      ...product,
      stock_quantity:
        product.type === "physical"
          ? (inventoryByProduct.get(product.id) ?? "0.0000")
          : undefined,
    })) as DashboardReference[],
    cashAccounts: (cashAccounts ?? []) as DashboardReference[],
    categories: (categories ?? []) as DashboardReference[],
    savingsGoals: (savingsGoals ?? []) as DashboardReference[],
    openSales: (openSales ?? []) as DashboardSale[],
    members: (members ?? []).map((row) => ({
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      display_name:
        (row.profiles as { display_name?: string } | null)?.display_name ??
        null,
    })),
    invitations: (invitations ?? []) as Invitation[],
    iptvAlerts: (iptvAlerts ?? []) as DashboardIptvAlert[],
    reports: {
      activityMargins: (activityMargins ?? []) as ReportRow[],
      expensesByCategory: (expensesByCategory ?? []) as ReportRow[],
      accountBalances: (accountBalances ?? []) as ReportRow[],
      stock: (stock ?? []) as ReportRow[],
      receivables: (receivables ?? []) as ReportRow[],
      savingsProgress: (savingsProgress ?? []) as ReportRow[],
    },
  };
}
