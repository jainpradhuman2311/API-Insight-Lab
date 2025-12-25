
import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Play, Square, Loader2, CheckCircle2, XCircle, Clock, ArrowUpRight } from 'lucide-react'
import type { SavedApiConfig, TestResult } from "../../types"

interface BulkTestViewProps {
    savedConfigs: SavedApiConfig[];
    onLoadPreset: (config: SavedApiConfig) => void;
}

interface BulkResult {
    configId: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    duration?: number;
    avgTime?: number;
    errorRate?: number;
    message?: string;
    testResult?: TestResult;
}

export function BulkTestView({ savedConfigs, onLoadPreset }: BulkTestViewProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [results, setResults] = useState<BulkResult[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Config
    const [concurrency, setConcurrency] = useState(5)
    const [iterations, setIterations] = useState(10)

    // Selection handlers
    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const selectAll = () => setSelectedIds(savedConfigs.map(c => c.id))
    const deselectAll = () => setSelectedIds([])

    // Runner Logic
    const stopTests = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        setIsRunning(false)
    }

    const runBulkTests = async () => {
        if (selectedIds.length === 0) return

        setIsRunning(true)
        setCurrentIndex(0)

        // Initialize results
        const initialResults: BulkResult[] = selectedIds.map(id => {
            const config = savedConfigs.find(c => c.id === id)
            return {
                configId: id,
                name: config?.name || 'Unknown',
                status: 'pending'
            }
        })
        setResults(initialResults)

        abortControllerRef.current = new AbortController()

        // Process queue
        for (let i = 0; i < selectedIds.length; i++) {
            if (abortControllerRef.current?.signal.aborted) break;

            setCurrentIndex(i)
            const id = selectedIds[i]
            const config = savedConfigs.find(c => c.id === id)

            if (!config) continue

            // Update status to running
            setResults(prev => prev.map(r => r.configId === id ? { ...r, status: 'running' } : r))

            try {
                // Prepare payload
                // Reconstruct auth object
                let authConfig: any = { type: config.authType || 'none' };
                if (config.authType === 'basic') {
                    authConfig.username = config.authUsername;
                    authConfig.password = config.authPassword;
                } else if (config.authType === 'bearer') {
                    authConfig.token = config.authToken;
                } else if ((config.authType as string) === 'apikey') {
                    // Backward compatibility for existing presets
                    authConfig.keyName = config.authKeyName;
                    authConfig.keyValue = config.authKeyValue;
                }

                const payload = {
                    url: config.url,
                    method: config.method,
                    concurrency,
                    iterations,
                    bypassCache: false,
                    timeout: 30,
                    headers: config.headers, // Important: Pass headers
                    body: config.body,       // Pass body
                    auth: authConfig,
                    assertions: config.assertions || [] // Pass assertions if any
                }

                const csrfToken = (window as any).drupalSettings?.api_insight_lab?.csrf_token;

                const res = await fetch('/api/perf-test/run', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    body: JSON.stringify(payload),
                    signal: abortControllerRef.current.signal
                })

                const data = await res.json()

                if (data.success) {
                    setResults(prev => prev.map(r => r.configId === id ? {
                        ...r,
                        status: 'success',
                        testResult: data,
                        duration: data.stats.totalDuration,
                        avgTime: data.stats.mean,
                        errorRate: (data.stats.errorCount / data.stats.requests) * 100
                    } : r))
                } else {
                    setResults(prev => prev.map(r => r.configId === id ? {
                        ...r,
                        status: 'error',
                        message: data.error || 'Test failed'
                    } : r))
                }

            } catch (err: any) {
                if (err.name === 'AbortError') {
                    break;
                }
                setResults(prev => prev.map(r => r.configId === id ? {
                    ...r,
                    status: 'error',
                    message: err.message
                } : r))
            }

            // Small delay between tests
            if (i < selectedIds.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        setIsRunning(false)
        abortControllerRef.current = null
    }

    // Calculate summary stats
    const completed = results.filter(r => r.status === 'success' || r.status === 'error').length
    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Bulk Runner</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Run multiple saved presets sequentially for regression testing.</p>
                </div>
                <div className="flex gap-2">
                    {!isRunning ? (
                        <Button onClick={runBulkTests} disabled={selectedIds.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                            <Play className="w-4 h-4 mr-2" />
                            Run Selected ({selectedIds.length})
                        </Button>
                    ) : (
                        <Button onClick={stopTests} variant="destructive">
                            <Square className="w-4 h-4 mr-2" />
                            Stop
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Selection & Config */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Test Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Concurrency (max 100)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={concurrency}
                                    onChange={e => setConcurrency(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                                />
                                <p className="text-xs text-zinc-500">Virtual users per test</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Iterations (max 1000)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={iterations}
                                    onChange={e => setIterations(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                                />
                                <p className="text-xs text-zinc-500">Requests per user</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="flex-1">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Saved Presets</CardTitle>
                            <div className="flex gap-2 text-xs">
                                <button onClick={selectAll} className="text-indigo-600 hover:underline">All</button>
                                <button onClick={deselectAll} className="text-zinc-500 hover:underline">None</button>
                            </div>
                        </CardHeader>
                        <CardContent className="max-h-[500px] overflow-y-auto pt-0">
                            {savedConfigs.length === 0 && (
                                <div className="text-center py-8 text-zinc-500 text-sm">
                                    No saved presets found. Save a config first.
                                </div>
                            )}
                            <div className="space-y-2 mt-2">
                                {savedConfigs.map(config => (
                                    <div key={config.id} className="flex items-start gap-4 p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200">
                                        <Checkbox
                                            id={`chk-${config.id}`}
                                            checked={selectedIds.includes(config.id)}
                                            onCheckedChange={() => toggleSelect(config.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 grid gap-0.5">
                                            <Label htmlFor={`chk-${config.id}`} className="font-medium cursor-pointer truncate">
                                                {config.name}
                                            </Label>
                                            <div className="flex items-center text-xs text-zinc-500 gap-2">
                                                <Badge variant="outline" className="text-[10px] h-4 px-1">{config.method}</Badge>
                                                <span className="truncate max-w-[150px]">{config.url}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Progress & Results */}
                <div className="lg:col-span-2 space-y-6">
                    {isRunning || results.length > 0 ? (
                        <>
                            {/* Progress Bar */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base">Progress</CardTitle>
                                        <span className="text-sm text-zinc-500">
                                            {completed} / {results.length} Tests
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 mb-2">
                                        <div
                                            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${(completed / results.length) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex gap-4 text-sm mt-4">
                                        <div className="flex items-center gap-2 text-emerald-600">
                                            <CheckCircle2 className="w-4 h-4" /> {successCount} Passed
                                        </div>
                                        <div className="flex items-center gap-2 text-red-600">
                                            <XCircle className="w-4 h-4" /> {errorCount} Failed
                                        </div>
                                        {isRunning && (
                                            <div className="flex items-center gap-2 text-blue-600">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Running: {results[currentIndex]?.name}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Results Table */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {results.map((res) => (
                                            <div key={res.configId} className="py-3 flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    {res.status === 'pending' && <Clock className="w-5 h-5 text-zinc-300" />}
                                                    {res.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                                                    {res.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                                    {res.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm">{res.name}</p>
                                                            {res.testResult?.firstResponse?.status && (
                                                                <Badge variant={res.testResult.firstResponse.status >= 200 && res.testResult.firstResponse.status < 300 ? 'outline' : 'destructive'} className="text-[10px] h-4 px-1">
                                                                    {res.testResult.firstResponse.status}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {res.message && <p className="text-xs text-red-500">{res.message}</p>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 text-sm">
                                                    {res.status === 'success' && (
                                                        <>
                                                            <div className="w-24 text-right">
                                                                <span className="block text-zinc-500 text-xs">Avg Response</span>
                                                                <span className="font-medium">{(res.avgTime || 0).toFixed(2)}ms</span>
                                                            </div>
                                                            <div className="w-24 text-right">
                                                                <span className="block text-zinc-500 text-xs">Error Rate</span>
                                                                <span className={`font-medium ${(res.errorRate || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {(res.errorRate || 0).toFixed(1)}%
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const config = savedConfigs.find(c => c.id === res.configId);
                                                                    if (config) onLoadPreset(config);
                                                                }}
                                                                title="Load into Tester for debugging"
                                                            >
                                                                <ArrowUpRight className="w-4 h-4 text-zinc-500 hover:text-indigo-600" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {res.status === 'error' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                const config = savedConfigs.find(c => c.id === res.configId);
                                                                if (config) onLoadPreset(config);
                                                            }}
                                                            title="Load into Tester for debugging"
                                                        >
                                                            <ArrowUpRight className="w-4 h-4 text-zinc-500 hover:text-indigo-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-zinc-400">
                            <div className="text-center">
                                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Ready to Run</h3>
                                <p>Select presets from the left and click "Run Selected" to start.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
