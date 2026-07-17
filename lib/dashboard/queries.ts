import { hasSupabaseEnv, createClient } from "@/lib/supabase/server";

export type DashboardKpis = {
  revenue: string;
  gross_profit: string;
  net_profit: string;
  family_expenses: string;
  savings: string;
  cash: string;
};
export type DashboardActivity = { code: string; name: string; active: boolean };
export type DashboardOperation = {
  number: string;
  type: string;
  status: string;
  line_count: number;
};
export type DashboardData = {
  configured: boolean;
  authenticated: boolean;
  householdName: string | null;
  kpis: DashboardKpis;
  activities: DashboardActivity[];
  operations: DashboardOperation[];
};

const zeroKpis: DashboardKpis = {
  revenue: "0.0000",
  gross_profit: "0.0000",
  net_profit: "0.0000",
  family_expenses: "0.0000",
  savings: "0.0000",
  cash: "0.0000",
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return {
      configured: false,
      authenticated: false,
      householdName: null,
      kpis: zeroKpis,
      activities: [],
      operations: [],
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
      kpis: zeroKpis,
      activities: [],
      operations: [],
    };
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, households(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!member) {
    return {
      configured: true,
      authenticated: true,
      householdName: null,
      kpis: zeroKpis,
      activities: [],
      operations: [],
    };
  }

  const householdId = member.household_id as string;
  const [{ data: kpis }, { data: activities }, { data: operations }] =
    await Promise.all([
      supabase.rpc("get_dashboard_kpis", {
        p_household_id: householdId,
        p_from: null,
        p_to: null,
        p_activity_id: null,
      }),
      supabase
        .from("activities")
        .select("code,name,active")
        .eq("household_id", householdId)
        .order("display_order"),
      supabase
        .from("journal_entries")
        .select("number,type,status,journal_lines(count)")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    configured: true,
    authenticated: true,
    householdName:
      (member.households as { name?: string } | null)?.name ?? "Foyer",
    kpis: (Array.isArray(kpis) ? kpis[0] : kpis) ?? zeroKpis,
    activities: (activities ?? []) as DashboardActivity[],
    operations: (operations ?? []).map((row) => ({
      number: row.number,
      type: row.type,
      status: row.status,
      line_count: row.journal_lines?.[0]?.count ?? 0,
    })),
  };
}
