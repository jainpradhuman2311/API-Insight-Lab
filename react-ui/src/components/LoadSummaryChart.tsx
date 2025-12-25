import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Users, Zap, Clock, TrendingUp } from 'lucide-react';
import type { TimeSeriesPoint } from '@/types';

interface LoadSummaryChartProps {
    timeSeries: TimeSeriesPoint[];
    totalVUs: number;
    totalRequests: number;
    testDuration: number;
}

interface PhaseMarker {
    start: number;
    end: number;
    label: string;
}

export function LoadSummaryChart({ timeSeries, totalVUs }: LoadSummaryChartProps) {
    const [showP99, setShowP99] = useState(true);
    const [showP95, setShowP95] = useState(true);
    const [showRPS, setShowRPS] = useState(true);
    const [showVUs, setShowVUs] = useState(true);

    // Calculate summary metrics
    const metrics = useMemo(() => {
        if (!timeSeries?.length) return null;

        const totalSuccess = timeSeries.reduce((sum, p) => sum + p.successCount, 0);
        const avgRPS = timeSeries.reduce((sum, p) => sum + p.rps, 0) / timeSeries.length;
        const peakRPS = Math.max(...timeSeries.map(p => p.rps));
        const avgP95 = timeSeries.reduce((sum, p) => sum + p.responseTimeP95, 0) / timeSeries.length;

        return {
            totalSuccess,
            avgRPS: avgRPS.toFixed(1),
            peakRPS: peakRPS.toFixed(1),
            avgP95: avgP95.toFixed(0)
        };
    }, [timeSeries]);

    // Detect phases from actual backend data
    const phases = useMemo((): PhaseMarker[] => {
        if (!timeSeries?.length) return [];

        const formatPhaseLabel = (phase: string): string => {
            const labels: Record<string, string> = {
                'warmup': 'Warmup',
                'rampup': 'Ramp Up',
                'sustain': 'Sustain',
                'rampdown': 'Ramp Down',
                'spike': 'Spike'
            };
            return labels[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);
        };

        const result: PhaseMarker[] = [];
        let currentPhase = timeSeries[0]?.phase;
        let phaseStart = timeSeries[0]?.time || 0;

        timeSeries.forEach((point) => {
            if (point.phase && point.phase !== currentPhase) {
                if (currentPhase) {
                    result.push({
                        start: phaseStart,
                        end: point.time,
                        label: formatPhaseLabel(currentPhase)
                    });
                }
                currentPhase = point.phase;
                phaseStart = point.time;
            }
        });

        // Add final phase
        if (currentPhase && timeSeries.length > 0) {
            result.push({
                start: phaseStart,
                end: timeSeries[timeSeries.length - 1].time,
                label: formatPhaseLabel(currentPhase)
            });
        }

        // If no phases detected from data, show a single "Test" phase
        if (result.length === 0 && timeSeries.length > 0) {
            result.push({
                start: timeSeries[0].time,
                end: timeSeries[timeSeries.length - 1].time,
                label: 'Test'
            });
        }

        return result;
    }, [timeSeries]);

    if (!timeSeries?.length) {
        return null;
    }

    // Format chart data with readable timestamps
    const chartData = timeSeries.map(point => ({
        ...point,
        displayTime: new Date(point.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }));

    // Custom Tooltip
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
                            <span className="font-mono font-medium">
                                {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
                                {entry.name.includes('Time') && 'ms'}
                                {entry.name === 'RPS' && '/s'}
                            </span>
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
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        Load Summary
                    </CardTitle>
                    <div className="flex gap-2">
                        {[
                            { key: 'showVUs', label: 'VUs', color: '#8b5cf6', value: showVUs, setter: setShowVUs },
                            { key: 'showRPS', label: 'RPS', color: '#f97316', value: showRPS, setter: setShowRPS },
                            { key: 'showP95', label: 'P95', color: '#06b6d4', value: showP95, setter: setShowP95 },
                            { key: 'showP99', label: 'P99', color: '#3b82f6', value: showP99, setter: setShowP99 },
                        ].map(toggle => (
                            <Badge
                                key={toggle.key}
                                variant={toggle.value ? 'default' : 'outline'}
                                className="cursor-pointer transition-colors"
                                style={toggle.value ? { backgroundColor: toggle.color } : undefined}
                                onClick={() => toggle.setter(!toggle.value)}
                            >
                                {toggle.label}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
                        <div className="flex items-center gap-2 text-violet-600 mb-1">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase">VUs Created</span>
                        </div>
                        <p className="text-2xl font-bold text-violet-900">
                            {totalVUs.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                        <div className="flex items-center gap-2 text-orange-600 mb-1">
                            <Zap className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase">Avg RPS</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-900">
                            {metrics?.avgRPS}<span className="text-sm font-normal">/sec</span>
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                            <Zap className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase">Peak RPS</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-900">
                            {metrics?.peakRPS}<span className="text-sm font-normal">/sec</span>
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
                        <div className="flex items-center gap-2 text-cyan-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase">Avg P95</span>
                        </div>
                        <p className="text-2xl font-bold text-cyan-900">
                            {metrics?.avgP95}<span className="text-sm font-normal">ms</span>
                        </p>
                    </div>
                </div>

                {/* Phase Indicators */}
                {phases.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                        {phases.map((phase, index) => (
                            <Badge
                                key={index}
                                variant="outline"
                                className="text-xs whitespace-nowrap bg-zinc-50"
                            >
                                {phase.label}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Chart */}
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="vuGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                                yAxisId="left"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                label={{ value: 'VUs / RPS', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={{ stroke: '#e5e7eb' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                label={{ value: 'Response Time (ms)', angle: 90, position: 'insideRight', style: { fill: '#6b7280', fontSize: 11 } }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => <span className="text-zinc-600 text-sm">{value}</span>}
                            />

                            {showVUs && (
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="activeVUs"
                                    name="Active VUs"
                                    stroke="#8b5cf6"
                                    fill="url(#vuGradient)"
                                    strokeWidth={2}
                                />
                            )}
                            {showRPS && (
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="rps"
                                    name="RPS"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            )}
                            {showP95 && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="responseTimeP95"
                                    name="P95 Response Time"
                                    stroke="#06b6d4"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            )}
                            {showP99 && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="responseTimeP99"
                                    name="P99 Response Time"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
