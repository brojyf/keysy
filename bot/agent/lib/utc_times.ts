type Sample = [string | number, ...unknown[]];
type Series = { values?: Sample[]; value?: Sample };

// The model cannot convert unix timestamps reliably, so tools return ISO UTC times.
// Loki log lines (streams) carry nanosecond strings; Loki and Prometheus metric samples carry seconds.
export function withUtcTimes(resultType: string, result: unknown) {
  const toUtc = (time: string | number) =>
    new Date(resultType === "streams" ? Number(BigInt(time) / 1_000_000n) : Number(time) * 1000).toISOString();
  const withUtc = ([time, ...rest]: Sample): Sample => [toUtc(time), ...rest];
  if (resultType === "scalar") return withUtc(result as Sample);
  if (!["streams", "matrix", "vector"].includes(resultType)) return result;
  return (result as Series[]).map((series) => ({
    ...series,
    ...(series.values && { values: series.values.map(withUtc) }),
    ...(series.value && { value: withUtc(series.value) }),
  }));
}
