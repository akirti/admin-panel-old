import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_COLORS = [
  '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

/**
 * Resolve a CSS variable (e.g. `var(--color-primary-500)`) to its computed
 * hex/rgb value so recharts can use it as a fill or stroke.  Falls back to the
 * raw string when the variable cannot be resolved.
 */
function resolveColor(raw) {
  if (typeof raw !== 'string') return raw;
  const match = raw.match(/^var\(\s*(--[^)]+)\s*\)$/);
  if (!match) return raw;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();
  return resolved || raw;
}

function useResolvedColors(colors) {
  return useMemo(
    () => (colors || DEFAULT_COLORS).map(resolveColor),
    [colors],
  );
}

/** Returns `true` when `prefers-reduced-motion: reduce` is active. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** Unique ID counter for accessible labels. */
let chartIdCounter = 0;
function useChartId(prefix = 'chart') {
  const [id] = useState(() => `${prefix}-${++chartIdCounter}`);
  return id;
}

// ---------------------------------------------------------------------------
// 1. ChartSkeleton
// ---------------------------------------------------------------------------

export const ChartSkeleton = ({ height = 300 }) => (
  <div
    className="animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"
    style={{ height }}
    role="status"
    aria-label="Loading chart"
  >
    <span className="sr-only">Loading chart…</span>
  </div>
);

// ---------------------------------------------------------------------------
// 2. ChartCard
// ---------------------------------------------------------------------------

export const ChartCard = ({
  title,
  subtitle,
  children,
  loading = false,
  action,
  className,
}) => (
  <div className={`card p-6 ${className || ''}`}>
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-content">{title}</h3>
        {subtitle && (
          <p className="text-sm text-content-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
    {loading ? <ChartSkeleton /> : children}
  </div>
);

// ---------------------------------------------------------------------------
// Shared custom tooltip
// ---------------------------------------------------------------------------

const CustomTooltip = ({ active, payload, label, formatValue }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-edge bg-surface p-3 shadow-lg text-sm">
      {label !== undefined && label !== null && (
        <p className="font-medium text-content mb-1">{label}</p>
      )}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatValue ? formatValue(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. TrendLineChart
// ---------------------------------------------------------------------------

export const TrendLineChart = ({
  data,
  dataKey,
  xKey = 'date',
  height = 300,
  color,
  formatX,
  formatY,
  name,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const chartId = useChartId('trend');
  const gradientId = `${chartId}-gradient`;
  const resolvedColor = useMemo(
    () => resolveColor(color || 'var(--color-primary-500)') || '#ef4444',
    [color],
  );

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-content-muted text-center py-8">
        No data available.
      </p>
    );
  }

  return (
    <div role="img" aria-label={`Trend chart: ${name || dataKey}`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={resolvedColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={resolvedColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickFormatter={formatX}
            className="text-content-muted"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={formatY}
            className="text-content-muted"
          />
          <Tooltip content={<CustomTooltip formatValue={formatY} />} />
          <Legend />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={name || dataKey}
            stroke={resolvedColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. StatusBarChart
// ---------------------------------------------------------------------------

export const StatusBarChart = ({
  data,
  nameKey = 'name',
  valueKey = 'value',
  height = 300,
  colors,
  layout = 'vertical',
  formatValue,
}) => {
  const resolvedColors = useResolvedColors(colors);
  const reducedMotion = usePrefersReducedMotion();

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-content-muted text-center py-8">
        No data available.
      </p>
    );
  }

  const isHorizontal = layout === 'horizontal';

  return (
    <div role="img" aria-label="Bar chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={formatValue} />
              <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 12 }} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatValue} />
            </>
          )}
          <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
          <Legend />
          <Bar
            dataKey={valueKey}
            name={valueKey}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reducedMotion}
          >
            {data.map((_, index) => (
              <Cell
                key={`bar-${index}`}
                fill={resolvedColors[index % resolvedColors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. DistributionDonutChart
// ---------------------------------------------------------------------------

const DonutCenterLabel = ({ viewBox, total }) => {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-current text-content"
    >
      <tspan x={cx} dy="-0.4em" fontSize="20" fontWeight="700">
        {total}
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="12" className="fill-current text-content-muted">
        Total
      </tspan>
    </text>
  );
};

const DonutTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const { name, value, payload: entryPayload } = payload[0];
  const percent = entryPayload?.percent;
  return (
    <div className="rounded-lg border border-edge bg-surface p-3 shadow-lg text-sm">
      <p className="font-medium text-content">{name}</p>
      <p className="text-content-secondary">
        {value} ({percent !== undefined ? `${(percent * 100).toFixed(1)}%` : ''})
      </p>
    </div>
  );
};

export const DistributionDonutChart = ({
  data,
  nameKey = 'name',
  valueKey = 'value',
  height = 300,
  colors,
}) => {
  const resolvedColors = useResolvedColors(colors);
  const reducedMotion = usePrefersReducedMotion();

  const total = useMemo(
    () => (data || []).reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0),
    [data, valueKey],
  );

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-content-muted text-center py-8">
        No data available.
      </p>
    );
  }

  return (
    <div role="img" aria-label="Donut chart showing distribution">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={!reducedMotion}
            label={({ name: entryName, percent }) =>
              `${entryName} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={resolvedColors[index % resolvedColors.length]}
              />
            ))}
            <DonutCenterLabel total={total} />
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. ActivityHeatmap
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Simple CSS-grid heatmap for weekly activity.
 *
 * `data` should be an array of `{ date: string, value: number }` sorted
 * chronologically.  The component groups values into a 7-row grid
 * (Mon–Sun) automatically.
 */
export const ActivityHeatmap = ({ data, height = 120 }) => {
  const [tooltip, setTooltip] = useState(null);

  const { cells, maxVal } = useMemo(() => {
    if (!data || data.length === 0) return { cells: [], maxVal: 0 };

    const mapped = data.map((d) => {
      const dateObj = new Date(d.date);
      // getDay: 0=Sun → remap to Mon=0 … Sun=6
      const day = (dateObj.getDay() + 6) % 7;
      return { ...d, day };
    });

    const max = Math.max(...mapped.map((d) => d.value), 1);

    return { cells: mapped, maxVal: max };
  }, [data]);

  const getOpacity = useCallback(
    (value) => {
      if (maxVal === 0) return 0.05;
      return Math.max(0.05, value / maxVal);
    },
    [maxVal],
  );

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-content-muted text-center py-8">
        No activity data available.
      </p>
    );
  }

  return (
    <div
      role="img"
      aria-label="Activity heatmap"
      className="relative"
      style={{ minHeight: height }}
    >
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 text-xs text-content-muted pr-1 justify-between" style={{ minWidth: 28 }}>
          {DAYS_OF_WEEK.map((d) => (
            <span key={d} className="h-3 leading-3">{d}</span>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-[3px] flex-1"
          style={{
            gridTemplateRows: 'repeat(7, 1fr)',
            gridAutoFlow: 'column',
            gridAutoColumns: '1fr',
          }}
        >
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className="rounded-sm cursor-pointer transition-transform hover:scale-125"
              style={{
                backgroundColor: `rgba(34,197,94,${getOpacity(cell.value)})`,
                aspectRatio: '1',
                minHeight: 10,
              }}
              title={`${cell.date}: ${cell.value}`}
              onMouseEnter={() => setTooltip({ date: cell.date, value: cell.value })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip({ date: cell.date, value: cell.value })}
              onBlur={() => setTooltip(null)}
              tabIndex={0}
              role="gridcell"
              aria-label={`${cell.date}: ${cell.value} activities`}
            />
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg border border-edge bg-surface px-3 py-1.5 shadow-lg text-xs pointer-events-none z-10"
          role="tooltip"
        >
          <span className="font-medium text-content">{tooltip.date}</span>{' '}
          <span className="text-content-secondary">{tooltip.value} activities</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 text-xs text-content-muted justify-end">
        <span>Less</span>
        {[0.05, 0.25, 0.5, 0.75, 1].map((opacity) => (
          <div
            key={opacity}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: `rgba(34,197,94,${opacity})` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
};
