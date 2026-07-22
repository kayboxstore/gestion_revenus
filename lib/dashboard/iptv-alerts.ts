export type CountedIptvAlert = {
  total_count?: string | number | null;
};

export function getIptvAlertCount(alerts: readonly CountedIptvAlert[]): number {
  const totalCount = Number(alerts[0]?.total_count);
  return Number.isSafeInteger(totalCount) && totalCount >= alerts.length
    ? totalCount
    : alerts.length;
}
