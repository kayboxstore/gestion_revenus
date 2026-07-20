const statusLabels: Record<string, string> = {
  active: "Actif",
  cancelled: "Annulée",
  confirmed: "Confirmée",
  draft: "Brouillon",
  inactive: "Inactif",
  overdue: "Échue",
  paid: "Payée",
  partially_paid: "Partiellement payée",
  posted: "Validée",
  reversed: "Annulée",
};

export function translateStatus(status: string) {
  return statusLabels[status] ?? status;
}
