import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ZAxis
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { TimeSeriesPoint } from '@/types';

interface ThroughputLatencyChartProps {
    timeSeries: TimeSeriesPoint[];
}

export function ThroughputLatencyChart({ timeSeries }: ThroughputLatencyChartProps) {
    const chartData = useMemo(() => {
        if (!timeSeries?.length) return [];

        return timeSeries.map((point, idx) => ({
            rps: point.rps,
            p95: point.responseTimeP95,
            p50: point.responseTimeP50,
            phase: point.phase,
            time: idx,
            activeVUs: point.activeVUs
        }));
    }, [timeSeries]);

    // Find the breaking point (where latency starts increasing significantly)
    const breakingPoint = useMemo(() => {
        if (chartData.length < 3) return null;

        let maxRps = 0;
        let breakingIdx = -1;

        for (let i = 1; i < chartData.length; i++) {
            if (chartData[i].rps > maxRps) {
                maxRps = chartData[i].rps;
            }
            // Detect if latency increased by more than 50% from previous
            if (chartData[i].p95 > chartData[i - 1].p95 * 1.5 && chartData[i].p95 > 100) {
                breakingIdx = i;
                break;
            }
        }

        return breakingIdx >= 0 ? chartData[breakingIdx] : null;
    }, [chartData]);

    const phaseColors: { [key: string]: string } = {
        warmup: '#f59e0b',
        rampup: '#3b82f6',
        sustain: '#10b981',
        rampdown: '#ef4444'
    };

    if (!timeSeries?.length) return null;

    const avgRps = (timeSeries.reduce((s, p) => s + p.rps, 0) / timeSeries.length).toFixed(1);
    const avgP95 = (timeSeries.reduce((s, p) => s + p.responseTimeP95, 0) / timeSeries.length).toFixed(0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: phaseColors[data.phase] || '#6b7280' }} />
                        <span className="font-medium text-zinc-900 capitalize">{data.phase || 'Standard'} Phase</span>
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Throughput:</span>
                            <span className="font-mono font-medium">{data.rps} RPS</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">P95 Latency:</span>
                            <span className="font-mono font-medium">{data.p95.toFixed(0)}ms</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Active VUs:</span>
                            <span className="font-mono font-medium">{data.activeVUs}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="shadow-sm border-zinc-200 bg-white overflow-hidden">
            <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Throughput vs Latency
                        </CardTitle>
                        <CardDescription className="mt-1">Correlation between RPS and response time</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                            Avg: {avgRps} RPS
                        </Badge>
                        <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                            Avg P95: {avgP95}ms
                        </Badge>
                        {breakingPoint && (
                            <Badge variant="destructive">
                                Breaking @ {breakingPoint.rps} RPS
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                type="number"
                                dataKey="rps"
                                name="Throughput"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                label={{ value: 'Requests/sec', position: 'bottom', offset: 0, style: { fill: '#6b7280', fontSize: 11 } }}
                            />
                            <YAxis
                                type="number"
                                dataKey="p95"
                                name="P95 Latency"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                label={{ value: 'P95 Latency (ms)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
                            />
                            <ZAxis type="number" dataKey="activeVUs" range={[50, 200]} />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Data points colored by phase */}
                            {Object.entries(phaseColors).map(([phase, color]) => (
                                <Scatter
                                    key={phase}
                                    name={phase}
                                    data={chartData.filter(d => d.phase === phase)}
                                    fill={color}
                                    opacity={0.8}
                                />
                            ))}

                            {/* Points without phase */}
                            <Scatter
                                name="standard"
                                data={chartData.filter(d => !d.phase)}
                                fill="#6b7280"
                                opacity={0.8}
                            />

                            {/* Breaking point indicator */}
                            {breakingPoint && (
                                <ReferenceLine
                                    x={breakingPoint.rps}
                                    stroke="#ef4444"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    label={{
                                        value: 'Breaking Point',
                                        position: 'top',
                                        fill: '#ef4444',
                                        fontSize: 10
                                    }}
                                />
                            )}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Phase Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-zinc-100">
                    {Object.entries(phaseColors).map(([phase, color]) => (
                        <div key={phase} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs text-zinc-600 capitalize">{phase}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
