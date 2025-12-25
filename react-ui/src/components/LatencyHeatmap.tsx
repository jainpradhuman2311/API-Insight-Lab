import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import type { TimeSeriesPoint } from '@/types';

interface LatencyHeatmapProps {
    timeSeries: TimeSeriesPoint[];
    className?: string;
}

const LATENCY_RANGES = [
    { min: 0, max: 50, label: '0-50ms', color: 'bg-emerald-100' },
    { min: 50, max: 100, label: '50-100ms', color: 'bg-emerald-200' },
    { min: 100, max: 200, label: '100-200ms', color: 'bg-yellow-200' },
    { min: 200, max: 500, label: '200-500ms', color: 'bg-orange-200' },
    { min: 500, max: 1000, label: '500ms-1s', color: 'bg-red-200' },
    { min: 1000, max: Infinity, label: '>1s', color: 'bg-red-400' },
];

function getIntensityColor(count: number, maxCount: number): string {
    if (count === 0) return 'bg-zinc-100';
    const intensity = count / maxCount;
    if (intensity < 0.2) return 'opacity-30';
    if (intensity < 0.4) return 'opacity-50';
    if (intensity < 0.6) return 'opacity-70';
    if (intensity < 0.8) return 'opacity-85';
    return 'opacity-100';
}

export function LatencyHeatmap({ timeSeries, className }: LatencyHeatmapProps) {
    const heatmapData = useMemo(() => {
        if (!timeSeries?.length) return [];

        // Create buckets for each time point and latency range
        return timeSeries.map(point => {
            const p50 = point.responseTimeP50;
            const p95 = point.responseTimeP95;
            const p99 = point.responseTimeP99;

            // Estimate distribution based on percentiles
            const distribution: { [key: string]: number } = {};
            LATENCY_RANGES.forEach(range => {
                let count = 0;
                // Simple heuristic based on percentiles
                if (p50 >= range.min && p50 < range.max) count += 50;
                if (p95 >= range.min && p95 < range.max) count += 35;
                if (p99 >= range.min && p99 < range.max) count += 15;
                distribution[range.label] = count;
            });

            return {
                time: new Date(point.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }),
                phase: point.phase,
                distribution,
                p50,
                p95,
                p99
            };
        });
    }, [timeSeries]);

    const maxCount = useMemo(() => {
        let max = 0;
        heatmapData.forEach(d => {
            Object.values(d.distribution).forEach(c => {
                if (c > max) max = c;
            });
        });
        return max || 1;
    }, [heatmapData]);

    if (!timeSeries?.length) return null;

    const avgP50 = (timeSeries.reduce((s, p) => s + p.responseTimeP50, 0) / timeSeries.length).toFixed(0);
    const avgP95 = (timeSeries.reduce((s, p) => s + p.responseTimeP95, 0) / timeSeries.length).toFixed(0);
    const avgP99 = (timeSeries.reduce((s, p) => s + p.responseTimeP99, 0) / timeSeries.length).toFixed(0);

    return (
        <Card className={`shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden ${className || ''}`}>
            <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            Latency Distribution
                        </CardTitle>
                        <CardDescription className="mt-1 text-zinc-500 dark:text-zinc-400">Response time distribution over test duration</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            P50: {avgP50}ms
                        </Badge>
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                            P95: {avgP95}ms
                        </Badge>
                        <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                            P99: {avgP99}ms
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                <div className="overflow-x-auto">
                    <div className="min-w-max">
                        {/* Header row with time labels */}
                        <div className="flex gap-0.5 mb-1">
                            <div className="w-24 shrink-0" />
                            {heatmapData.slice(0, 20).map((d, i) => (
                                <div key={i} className="w-10 text-center">
                                    <span className="text-[9px] text-zinc-400 font-mono">
                                        {d.time.split(':').slice(1).join(':')}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Heatmap rows */}
                        {LATENCY_RANGES.map((range) => (
                            <div key={range.label} className="flex gap-0.5 mb-0.5 items-center">
                                <div className="w-24 shrink-0 text-xs text-zinc-600 font-mono pr-2 text-right">
                                    {range.label}
                                </div>
                                {heatmapData.slice(0, 20).map((d, i) => {
                                    const count = d.distribution[range.label] || 0;
                                    return (
                                        <div
                                            key={i}
                                            className={`w-10 h-6 rounded-sm ${count > 0 ? range.color : 'bg-zinc-100'} ${getIntensityColor(count, maxCount)} transition-all hover:ring-2 hover:ring-indigo-400 cursor-pointer`}
                                            title={`${d.time}: ${range.label}\nP50: ${d.p50.toFixed(0)}ms\nP95: ${d.p95.toFixed(0)}ms`}
                                        />
                                    );
                                })}
                            </div>
                        ))}

                        {/* Phase indicators */}
                        <div className="flex gap-0.5 mt-2">
                            <div className="w-24 shrink-0 text-xs text-zinc-500 pr-2 text-right">Phase</div>
                            {heatmapData.slice(0, 20).map((d, i) => (
                                <div key={i} className="w-10 text-center">
                                    <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${d.phase === 'warmup' ? 'bg-amber-100 text-amber-700' :
                                        d.phase === 'rampup' ? 'bg-blue-100 text-blue-700' :
                                            d.phase === 'sustain' ? 'bg-emerald-100 text-emerald-700' :
                                                d.phase === 'rampdown' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-zinc-100 text-zinc-500'
                                        }`}>
                                        {d.phase ? d.phase.charAt(0).toUpperCase() : '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-zinc-100">
                    <span className="text-xs text-zinc-500">Intensity:</span>
                    {['Low', 'Med', 'High'].map((label, i) => (
                        <div key={label} className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-sm bg-emerald-200 ${i === 0 ? 'opacity-30' : i === 1 ? 'opacity-60' : 'opacity-100'}`} />
                            <span className="text-xs text-zinc-500">{label}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
