import Decimal from "decimal.js";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type StockStatus = "healthy" | "low" | "out";

export type StockProduct = {
  id: string;
  name: string;
  sku: string | null;
  activityName: string;
  activityCode: string;
  quantity: string;
  valueBase: string;
  weightedUnitCostBase: string;
  suggestedPrice: string | null;
  lowStockThreshold: string;
  status: StockStatus;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  quantity: string;
  unitCostBase: string;
  referenceType: string | null;
  movementDate: string;
};

export type InventoryCountRecord = {
  id: string;
  productId: string;
  productName: string;
  status: string;
  countDate: string;
  theoreticalQuantity: string;
  countedQuantity: string;
  difference: string;
};

export type StockWorkspaceData = {
  configured: boolean;
  authenticated: boolean;
  householdName: string | null;
  baseCurrency: string;
  role: "owner" | "manager" | "operator" | "reader" | null;
  products: StockProduct[];
  movements: StockMovement[];
  counts: InventoryCountRecord[];
  totals: {
    productCount: number;
    unitCount: string;
    valueBase: string;
    alertCount: number;
  };
};

const emptyData: StockWorkspaceData = {
  configured: false,
  authenticated: false,
  householdName: null,
  baseCurrency: "USD",
  role: null,
  products: [],
  movements: [],
  counts: [],
  totals: {
    productCount: 0,
    unitCount: "0.0000",
    valueBase: "0.0000",
    alertCount: 0,
  },
};

function stockStatus(quantity: string, threshold: string): StockStatus {
  const available = new Decimal(quantity);
  const minimum = new Decimal(threshold);
  if (available.lte(0)) return "out";
  if (minimum.gt(0) && available.lte(minimum)) return "low";
  return "healthy";
}

export async function getStockWorkspaceData(): Promise<StockWorkspaceData> {
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
  const [
    { data: productRows },
    { data: activityRows },
    { data: snapshotRows },
    { data: movementRows },
    { data: countRows },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku,activity_id,suggested_price,low_stock_threshold")
      .eq("household_id", householdId)
      .eq("type", "physical")
      .eq("active", true)
      .order("name"),
    supabase
      .from("activities")
      .select("id,name,code")
      .eq("household_id", householdId),
    supabase.rpc("get_inventory_snapshot", {
      p_household_id: householdId,
    }),
    supabase
      .from("stock_movements")
      .select(
        "id,product_id,type,quantity,unit_cost_base,reference_type,movement_date,created_at",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("inventory_counts")
      .select("id,status,count_date")
      .eq("household_id", householdId)
      .order("count_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(12),
  ]);

  const activities = new Map(
    (activityRows ?? []).map((activity) => [
      activity.id,
      { name: activity.name, code: activity.code },
    ]),
  );
  const snapshot = new Map(
    (
      (snapshotRows ?? []) as Array<{
        product_id: string;
        quantity: string | number;
        value_base: string | number;
        weighted_unit_cost_base: string | number;
      }>
    ).map((row) => [row.product_id, row]),
  );

  const products: StockProduct[] = (productRows ?? []).map((product) => {
    const balance = snapshot.get(product.id);
    const quantity = String(balance?.quantity ?? "0.0000");
    const threshold = String(product.low_stock_threshold ?? "0.0000");
    const activity = activities.get(product.activity_id);
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      activityName: activity?.name ?? "Activité",
      activityCode: activity?.code ?? "",
      quantity,
      valueBase: String(balance?.value_base ?? "0.0000"),
      weightedUnitCostBase: String(
        balance?.weighted_unit_cost_base ?? "0.0000",
      ),
      suggestedPrice:
        product.suggested_price === null
          ? null
          : String(product.suggested_price),
      lowStockThreshold: threshold,
      status: stockStatus(quantity, threshold),
    };
  });
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  const countIds = (countRows ?? []).map((count) => count.id);
  const { data: countLineRows } = countIds.length
    ? await supabase
        .from("inventory_count_lines")
        .select(
          "inventory_count_id,product_id,theoretical_quantity,counted_quantity,difference",
        )
        .eq("household_id", householdId)
        .in("inventory_count_id", countIds)
    : { data: [] };
  const countLinesByCount = new Map(
    (countLineRows ?? []).map((line) => [line.inventory_count_id, line]),
  );

  const movements: StockMovement[] = (movementRows ?? []).map((movement) => ({
    id: movement.id,
    productId: movement.product_id,
    productName:
      productsById.get(movement.product_id)?.name ?? "Produit archivé",
    type: movement.type,
    quantity: String(movement.quantity),
    unitCostBase: String(movement.unit_cost_base),
    referenceType: movement.reference_type,
    movementDate: movement.movement_date,
  }));
  const counts: InventoryCountRecord[] = (countRows ?? []).flatMap((count) => {
    const line = countLinesByCount.get(count.id);
    if (!line) return [];
    return [
      {
        id: count.id,
        productId: line.product_id,
        productName:
          productsById.get(line.product_id)?.name ?? "Produit archivé",
        status: count.status,
        countDate: count.count_date,
        theoreticalQuantity: String(line.theoretical_quantity),
        countedQuantity: String(line.counted_quantity),
        difference: String(line.difference),
      },
    ];
  });

  const totals = products.reduce(
    (accumulator, product) => ({
      unitCount: accumulator.unitCount.plus(product.quantity),
      valueBase: accumulator.valueBase.plus(product.valueBase),
      alertCount:
        accumulator.alertCount + (product.status === "healthy" ? 0 : 1),
    }),
    {
      unitCount: new Decimal(0),
      valueBase: new Decimal(0),
      alertCount: 0,
    },
  );
  const household = member.households as {
    name?: string;
    base_currency?: string;
  } | null;

  return {
    configured: true,
    authenticated: true,
    householdName: household?.name ?? "Foyer",
    baseCurrency: household?.base_currency ?? "USD",
    role: member.role as StockWorkspaceData["role"],
    products,
    movements,
    counts,
    totals: {
      productCount: products.length,
      unitCount: totals.unitCount.toFixed(4),
      valueBase: totals.valueBase.toFixed(4),
      alertCount: totals.alertCount,
    },
  };
}
