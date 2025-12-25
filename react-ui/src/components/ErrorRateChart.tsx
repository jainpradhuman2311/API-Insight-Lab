import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import type { TimeSeriesPoint } from '@/types';

interface ErrorRateChartProps {
    timeSeries: TimeSeriesPoint[];
}

export function ErrorRateChart({ timeSeries }: ErrorRateChartProps) {
    const chartData = useMemo(() => {
        if (!timeSeries?.length) return [];

        return timeSeries.map(point => ({
            ...point,
            displayTime: new Date(point.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            errorRate: point.successCount + point.errorCount > 0
                ? ((point.errorCount / (point.successCount + point.errorCount)) * 100).toFixed(1)
                : 0
        }));
    }, [timeSeries]);

    const totalErrors = useMemo(() => {
        return timeSeries?.reduce((sum, p) => sum + p.errorCount, 0) || 0;
    }, [timeSeries]);

    const totalSuccess = useMemo(() => {
        return timeSeries?.reduce((sum, p) => sum + p.successCount, 0) || 0;
    }, [timeSeries]);

    const errorRate = totalSuccess + totalErrors > 0
        ? ((totalErrors / (totalSuccess + totalErrors)) * 100).toFixed(2)
        : '0';

    if (!timeSeries?.length) return null;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium text-zinc-900 mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-zinc-600">{entry.name}:</span>
                            </span>
                            <span className="font-mono font-medium">{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="shadow-sm border-zinc-200 bg-white overflow-hidden">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 py-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Error Rate Timeline
                    </CardTitle>
                    <div className="flex gap-3">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            {totalSuccess.toLocaleString()} Success
                        </Badge>
                        <Badge variant={totalErrors > 0 ? 'destructive' : 'outline'} className={totalErrors === 0 ? 'bg-zinc-50' : ''}>
                            {totalErrors.toLocaleString()} Errors ({errorRate}%)
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="displayTime"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => <span className="text-zinc-600 text-sm">{value}</span>}
                            />
                            <Area
                                type="monotone"
                                dataKey="successCount"
                                name="Success"
                                stackId="1"
                                stroke="#10b981"
                                fill="url(#successGradient)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="errorCount"
                                name="Errors"
                                stackId="1"
                                stroke="#ef4444"
                                fill="url(#errorGradient)"
                                strokeWidth={2}
                            />
                            {/* Phase change markers */}
                            {chartData.map((point, idx) => {
                                const prev = chartData[idx - 1];
                                if (prev && point.phase !== prev.phase) {
                                    return (
                                        <ReferenceLine
                                            key={idx}
                                            x={point.displayTime}
                                            stroke="#6366f1"
                                            strokeDasharray="3 3"
                                            strokeWidth={1}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
