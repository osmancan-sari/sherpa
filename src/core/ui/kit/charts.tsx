"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

// Small single-series charts for module pages. One series, one colour (the module's, or the
// default series colour); values and labels wear text colours, never the series colour.
// Every value is reachable without hovering: the table view under the chart lists them all.

export type ChartPoint = { label: string; value: number };

type ChartProps = {
  /** What is plotted; names the chart for assistive technology and heads the table view. */
  title: string;
  data: ChartPoint[];
  /** Appended to values: "dk", "kg". */
  unit?: string;
  /** Series colour; default: the first categorical colour. */
  color?: string;
  height?: number;
};

const PAD = { top: 16, right: 12, bottom: 24, left: 40 };

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A clean upper bound for the axis: 1, 2 or 5 times a power of ten. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}

export function formatValue(value: number, unit?: string): string {
  const text = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
  return unit ? `${text} ${unit}` : text;
}

function Frame({
  title,
  data,
  unit,
  height,
  children,
}: Omit<ChartProps, "color"> & {
  height: number;
  children: (width: number) => ReactNode;
}) {
  const [ref, width] = useWidth();
  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 ? children(width) : null}
      </div>
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer items-center md:min-h-8">
          Tablo
        </summary>
        <table className="w-full max-w-sm border-collapse text-left tabular-nums">
          <caption className="sr-only">{title}</caption>
          <tbody>
            {data.map((point, index) => (
              <tr key={index} className="border-border border-b last:border-b-0">
                <th scope="row" className="text-muted-foreground py-1 pr-4 font-normal">
                  {point.label}
                </th>
                <td className="py-1 text-right">{formatValue(point.value, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Axis({
  width,
  height,
  max,
  unit,
}: {
  width: number;
  height: number;
  max: number;
  unit?: string;
}) {
  const plotHeight = height - PAD.top - PAD.bottom;
  return (
    <g aria-hidden>
      {[0, 0.5, 1].map((share) => {
        const y = PAD.top + plotHeight * (1 - share);
        return (
          <g key={share}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {formatValue(max * share)}
            </text>
          </g>
        );
      })}
      {unit ? (
        <text x={PAD.left - 8} y={8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {unit}
        </text>
      ) : null}
    </g>
  );
}

function Tooltip({
  x,
  y,
  point,
  unit,
}: {
  x: number;
  y: number;
  point: ChartPoint;
  unit?: string;
}) {
  return (
    <div
      role="presentation"
      className="bg-popover text-popover-foreground border-border pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-md"
      style={{ left: x, top: y - 6 }}
    >
      <span className="font-semibold tabular-nums">{formatValue(point.value, unit)}</span>{" "}
      <span className="text-muted-foreground">{point.label}</span>
    </div>
  );
}

/** How many x labels fit: every label, every second, every third… */
function labelStep(count: number, slot: number): number {
  return Math.max(1, Math.ceil(44 / Math.max(slot, 1)));
}

export function BarChart({
  title,
  data,
  unit,
  color = "var(--series-1)",
  height = 180,
}: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = niceMax(Math.max(0, ...data.map((point) => point.value)));

  return (
    <Frame title={title} data={data} unit={unit} height={height}>
      {(width) => {
        const plotWidth = width - PAD.left - PAD.right;
        const plotHeight = height - PAD.top - PAD.bottom;
        const slot = plotWidth / Math.max(data.length, 1);
        // Thin marks: the bar never fills its slot; a 2px gap always separates neighbours.
        const bar = Math.max(2, Math.min(24, slot - 2));
        const step = labelStep(data.length, slot);
        const baseline = PAD.top + plotHeight;
        const geometry = data.map((point, index) => {
          const barHeight = (Math.max(0, point.value) / max) * plotHeight;
          return {
            x: PAD.left + slot * index + (slot - bar) / 2,
            y: baseline - barHeight,
            barHeight,
          };
        });
        const shown = active !== null ? geometry[active] : null;

        return (
          <>
            <svg width={width} height={height} role="group" aria-labelledby={titleId}>
              <title id={titleId}>{title}</title>
              <Axis width={width} height={height} max={max} unit={unit} />
              {data.map((point, index) => {
                const { x, y, barHeight } = geometry[index];
                const radius = Math.min(4, bar / 2, barHeight);
                return (
                  <g key={index}>
                    {barHeight > 0 ? (
                      // Rounded at the data end, square at the baseline.
                      <path
                        d={`M${x},${baseline} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + bar - radius} Q${x + bar},${y} ${x + bar},${y + radius} V${baseline} Z`}
                        fill={color}
                        opacity={active === null || active === index ? 1 : 0.55}
                      />
                    ) : null}
                    {index % step === 0 ? (
                      <text
                        x={x + bar / 2}
                        y={height - 6}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px]"
                        aria-hidden
                      >
                        {point.label}
                      </text>
                    ) : null}
                    {/* The whole slot is the hit target, not just the painted bar. */}
                    <rect
                      x={PAD.left + slot * index}
                      y={PAD.top}
                      width={slot}
                      height={plotHeight}
                      fill="transparent"
                      tabIndex={0}
                      role="img"
                      aria-label={`${point.label}: ${formatValue(point.value, unit)}`}
                      className="focus-visible:stroke-ring outline-none focus-visible:stroke-2"
                      onPointerEnter={() => setActive(index)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                    />
                  </g>
                );
              })}
            </svg>
            {shown && active !== null ? (
              <Tooltip x={shown.x + bar / 2} y={shown.y} point={data[active]} unit={unit} />
            ) : null}
          </>
        );
      }}
    </Frame>
  );
}

export function LineChart({
  title,
  data,
  unit,
  color = "var(--series-1)",
  height = 180,
}: ChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = niceMax(Math.max(0, ...data.map((point) => point.value)));

  return (
    <Frame title={title} data={data} unit={unit} height={height}>
      {(width) => {
        const plotWidth = width - PAD.left - PAD.right - 8;
        const plotHeight = height - PAD.top - PAD.bottom;
        const gap = data.length > 1 ? plotWidth / (data.length - 1) : 0;
        const points = data.map((point, index) => ({
          x: PAD.left + 4 + (data.length > 1 ? gap * index : plotWidth / 2),
          y: PAD.top + plotHeight * (1 - Math.max(0, point.value) / max),
        }));
        const step = labelStep(data.length, gap || plotWidth);
        const last = points.at(-1);
        const shown = active !== null ? points[active] : null;

        /** The crosshair finds the X: the pointer only has to be nearest, not on the line. */
        const nearest = (clientX: number, left: number) => {
          if (points.length === 0) return null;
          const x = clientX - left;
          let best = 0;
          for (let index = 1; index < points.length; index++) {
            if (Math.abs(points[index].x - x) < Math.abs(points[best].x - x)) best = index;
          }
          return best;
        };

        return (
          <>
            <svg
              width={width}
              height={height}
              role="group"
              aria-labelledby={titleId}
              onPointerMove={(event) =>
                setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect().left))
              }
              onPointerLeave={() => setActive(null)}
            >
              <title id={titleId}>{title}</title>
              <Axis width={width} height={height} max={max} unit={unit} />
              {shown ? (
                <line
                  x1={shown.x}
                  x2={shown.x}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                  aria-hidden
                />
              ) : null}
              {points.length > 1 ? (
                <polyline
                  points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {/* End dot, and the dot under the crosshair, each with a ring in the surface colour. */}
              {[last, shown].map((point, index) =>
                point ? (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill={color}
                    stroke="var(--background)"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null,
              )}
              {data.map((point, index) => (
                <g key={index}>
                  {index % step === 0 ? (
                    <text
                      x={points[index].x}
                      y={height - 6}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                      aria-hidden
                    >
                      {point.label}
                    </text>
                  ) : null}
                  <circle
                    cx={points[index].x}
                    cy={points[index].y}
                    r={12}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${point.label}: ${formatValue(point.value, unit)}`}
                    className="focus-visible:stroke-ring outline-none focus-visible:stroke-2"
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              ))}
            </svg>
            {shown && active !== null ? (
              <Tooltip x={shown.x} y={shown.y} point={data[active]} unit={unit} />
            ) : null}
          </>
        );
      }}
    </Frame>
  );
}
