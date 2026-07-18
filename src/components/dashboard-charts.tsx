import type { TrustCategory } from "@/lib/db";
import { trustColorVar } from "@/lib/ai/mock-analyze";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = { day: string; count: number };
export type CatPoint = { category: string; key: TrustCategory; count: number };

export type DashboardChartsProps = {
  trendData: TrendPoint[];
  catData: CatPoint[];
  hasAnalytics: boolean;
};

/**
 * Isolated so the dashboard can lazy-load recharts and Verify never pays the cost.
 */
export default function DashboardCharts({
  trendData,
  catData,
  hasAnalytics,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="glass rounded-2xl p-5 lg:col-span-3">
        <div className="text-base font-semibold">Verifications over time</div>
        <div className="mt-4">
          {hasAnalytics ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--teal)"
                    strokeWidth={2}
                    fill="url(#fillCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="Run a verification to see your trend line." />
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 lg:col-span-2">
        <div className="text-base font-semibold">TrustScore distribution</div>
        <div className="mt-4">
          {hasAnalytics ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={catData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {catData.map((d) => (
                      <Cell key={d.key} fill={trustColorVar(d.key)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="Categories will appear after your first verification." />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {label}
    </div>
  );
}
