import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap } from 'lucide-react';

interface ThroughputGaugeProps {
    rps: number;
    maxRps?: number;
}

export function ThroughputGauge({ rps, maxRps }: ThroughputGaugeProps) {
    // Calculate the gauge percentage (auto-scale if maxRps not provided)
    const effectiveMax = maxRps || Math.max(rps * 1.5, 100);
    const percentage = Math.min((rps / effectiveMax) * 100, 100);

    // Determine performance level
    const getPerformanceLevel = () => {
        if (rps >= 100) return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'text-emerald-500' };
        if (rps >= 50) return { label: 'Good', color: 'text-blue-600', bgColor: 'text-blue-500' };
        if (rps >= 20) return { label: 'Moderate', color: 'text-amber-600', bgColor: 'text-amber-500' };
        return { label: 'Low', color: 'text-red-600', bgColor: 'text-red-500' };
    };

    const performance = getPerformanceLevel();

    // SVG arc calculation
    const radius = 80;
    const strokeWidth = 12;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * Math.PI; // Half circle
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" /> Throughput
                </CardTitle>
                <CardDescription>Requests per second</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pb-4">
                {/* Gauge SVG */}
                <div className="relative" style={{ width: radius * 2, height: radius + 20 }}>
                    <svg
                        width={radius * 2}
                        height={radius + 20}
                        className="transform"
                    >
                        {/* Background arc */}
                        <path
                            d={`M ${strokeWidth / 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - strokeWidth / 2} ${radius}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className="text-zinc-200 dark:text-zinc-800"
                            strokeLinecap="round"
                        />
                        {/* Foreground arc */}
                        <path
                            d={`M ${strokeWidth / 2} ${radius} A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${radius * 2 - strokeWidth / 2} ${radius}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className={performance.bgColor}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                        />
                    </svg>

                    {/* Center value */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                        <span className={`text-3xl font-bold ${performance.color}`}>
                            {rps.toFixed(1)}
                        </span>
                        <span className="text-xs text-zinc-500 uppercase tracking-wide">RPS</span>
                    </div>
                </div>

                {/* Performance label */}
                <div className={`mt-2 text-sm font-medium ${performance.color}`}>
                    {performance.label}
                </div>

                {/* Scale markers */}
                <div className="flex justify-between w-full mt-2 px-2 text-xs text-zinc-400">
                    <span>0</span>
                    <span>{Math.round(effectiveMax / 2)}</span>
                    <span>{Math.round(effectiveMax)}</span>
                </div>
            </CardContent>
        </Card>
    );
}
