"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";

export function AttendanceTrendChart({
  data,
  locale,
  labels,
}: {
  data: { date: string; present: number; late: number; absent: number }[];
  locale: string;
  labels: { present: string; late: string; absent: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="lateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value, name) => [formatNumber(Number(value ?? 0), locale), String(name)]}
        />
        <Area
          type="monotone"
          dataKey="present"
          name={labels.present}
          stroke="#10b981"
          fill="url(#presentFill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="late"
          name={labels.late}
          stroke="#f59e0b"
          fill="url(#lateFill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="absent"
          name={labels.absent}
          stroke="#ef4444"
          fill="transparent"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DepartmentChart({
  data,
  locale,
}: {
  data: { name: string; value: number }[];
  locale: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => [formatNumber(Number(value ?? 0), locale), ""]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#2563eb" barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LeaveTypeChart({
  data,
  locale,
}: {
  data: { name: string; value: number; color: string }[];
  locale: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => [formatNumber(Number(value ?? 0), locale), ""]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
