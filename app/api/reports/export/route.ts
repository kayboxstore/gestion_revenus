import Decimal from "decimal.js";
import { NextRequest } from "next/server";
import { getDashboardData } from "@/lib/dashboard/queries";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function decimalAmount(value: string) {
  return new Decimal(value).toFixed(4);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const data = await getDashboardData({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    activityId: searchParams.get("activity_id"),
  });
  if (!data.authenticated || !data.householdName) {
    return new Response("Authentification requise", { status: 401 });
  }
  const lines = [["Section", "Libellé", "Montant", "Détail"]];
  const addRows = (
    section: string,
    rows: { label: string; amount: string; detail?: string }[],
  ) => {
    for (const row of rows)
      lines.push([
        section,
        row.label,
        decimalAmount(row.amount),
        row.detail ?? "",
      ]);
  };
  addRows("Marge par activité", data.reports.activityMargins);
  addRows("Dépenses par catégorie", data.reports.expensesByCategory);
  addRows("Soldes", data.reports.accountBalances);
  addRows("Stock", data.reports.stock);
  addRows("Créances", data.reports.receivables);
  addRows("Épargne", data.reports.savingsProgress);
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="rapports.csv"',
      "cache-control": "no-store",
    },
  });
}
