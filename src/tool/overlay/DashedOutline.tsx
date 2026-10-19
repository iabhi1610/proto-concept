/** CSS `dashed` leaves the dash rhythm to the browser (tight ~3px); an SVG stroke lets us set it. */
const DASH = 4
const GAP = 4.5

/**
 * Dashed (or solid) ring filling its positioned parent. By default it sits just outside the box like
 * a CSS outline; `inside` keeps it within the box like a border.
 */
export function DashedOutline({
  color,
  width = 1.5,
  radius = 3,
  inside,
  solid,
}: {
  color: string
  width?: number
  /** corner radius of the box the ring follows */
  radius?: number
  inside?: boolean
  solid?: boolean
}) {
  // the stroke is centered on the rect, so shift the rect half a stroke out (outline) or in (border)
  const shift = inside ? -width / 2 : width / 2
  return (
    <svg aria-hidden className="pointer-events-none absolute overflow-visible" style={{ inset: -shift, width: `calc(100% + ${shift * 2}px)`, height: `calc(100% + ${shift * 2}px)` }}>
      <rect
        width="100%"
        height="100%"
        rx={Math.max(0, radius + shift)}
        fill="none"
        stroke={color}
        strokeWidth={width}
        // round caps add half a stroke to each end of a dash, so trim the dash and widen the gap to keep DASH / GAP visible
        strokeDasharray={solid ? undefined : `${Math.max(0, DASH - width)} ${GAP + width}`}
        strokeLinecap="round"
      />
    </svg>
  )
}
