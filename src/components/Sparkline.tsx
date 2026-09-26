/**
 * Minimal trend line for one vital sign. The shaded band is the normal range,
 * so an out-of-range reading is visible without reading numbers.
 * Y axis is fitted to data + band (not zero-based): variation is the point here.
 */
export function Sparkline({ points, band, width = 220, height = 56 }: { points: { t: number; v: number }[]; band?: [number, number]; width?: number; height?: number }) {
  if (points.length < 2) return null
  const pad = 5
  const xs = points.map((p) => p.t)
  const ys = points.map((p) => p.v).concat(band ?? [])
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  if (y0 === y1) [y0, y1] = [y0 - 1, y1 + 1]
  const X = (t: number) => pad + ((t - x0) / (x1 - x0 || 1)) * (width - pad * 2)
  const Y = (v: number) => height - pad - ((v - y0) / (y1 - y0)) * (height - pad * 2)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const outOfBand = (v: number) => band && (v < band[0] || v > band[1])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden>
      {band && <rect x={0} width={width} y={Y(band[1])} height={Math.max(0, Y(band[0]) - Y(band[1]))} fill="var(--color-ok-50)" />}
      <path d={d} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) =>
        outOfBand(p.v) ? <circle key={p.t} cx={X(p.t)} cy={Y(p.v)} r="3" fill="var(--color-bad-600)" /> : null,
      )}
      <circle cx={X(last.t)} cy={Y(last.v)} r="3.5" fill={outOfBand(last.v) ? 'var(--color-bad-600)' : 'var(--color-brand-700)'} stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}
