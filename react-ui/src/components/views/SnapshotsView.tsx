import type { HistoryEntry } from "../../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Trash2, Clock, Calendar, Database, Eye, GitCompare, ChevronDown } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { useState, useMemo } from "react"

interface SnapshotsViewProps {
    snapshots: HistoryEntry[];
    onRunTest: (entry: HistoryEntry) => void;
    onDeleteSnapshot: (id: string) => void;
    onViewDetails: (id: string) => void;
    onCompare: (id1: string, id2: string) => void;
}

export function SnapshotsView({ snapshots, onRunTest, onDeleteSnapshot, onViewDetails, onCompare }: SnapshotsViewProps) {
    const [compareMode, setCompareMode] = useState(false)
    const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Group snapshots by config_id
    const groupedSnapshots = useMemo(() => {
        const groups = new Map<string, HistoryEntry[]>()
        snapshots.forEach(snapshot => {
            const key = snapshot.config_id || 'ungrouped'
            if (!groups.has(key)) {
                groups.set(key, [])
            }
            groups.get(key)!.push(snapshot)
        })
        return groups
    }, [snapshots])

    const toggleGroup = (configId: string) => {
        const newExpanded = new Set(expandedGroups)
        if (newExpanded.has(configId)) {
            newExpanded.delete(configId)
        } else {
            newExpanded.add(configId)
        }
        setExpandedGroups(newExpanded)
    }

    const toggleCompareSelection = (id: string) => {
        if (selectedForCompare.includes(id)) {
            setSelectedForCompare(selectedForCompare.filter(sid => sid !== id))
        } else if (selectedForCompare.length < 2) {
            setSelectedForCompare([...selectedForCompare, id])
        }
    }

    const handleCompare = () => {
        if (selectedForCompare.length === 2) {
            onCompare(selectedForCompare[0], selectedForCompare[1])
            // Reset after comparison
            setCompareMode(false)
            setSelectedForCompare([])
        }
    }
    if (snapshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <Database className="w-10 h-10 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">No Snapshots Yet</h3>
                <p className="text-zinc-500 max-w-sm mt-2 mb-6">Run your first load test and save a snapshot to start tracking performance metrics over time.</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto w-full p-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Test Snapshots</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {compareMode ? 'Select 2 snapshots to compare' : 'Review saved performance snapshots and re-execute tests.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {compareMode && selectedForCompare.length === 2 && (
                        <Button onClick={handleCompare} className="bg-indigo-600 hover:bg-indigo-700">
                            <GitCompare className="w-4 h-4 mr-2" />
                            Compare Selected
                        </Button>
                    )}
                    <Button
                        variant={compareMode ? "default" : "outline"}
                        onClick={() => {
                            setCompareMode(!compareMode)
                            setSelectedForCompare([])
                        }}
                    >
                        <GitCompare className="w-4 h-4 mr-2" />
                        {compareMode ? 'Cancel' : 'Compare Mode'}
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pb-10">
                    {Array.from(groupedSnapshots.entries()).map(([configId, groupSnapshots]) => {
                        const isExpanded = expandedGroups.has(configId)
                        const firstSnapshot = groupSnapshots[0]

                        return (
                            <div key={configId} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                {/* Group Header */}
                                <button
                                    onClick={() => toggleGroup(configId)}
                                    className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                        <Badge variant="outline" className={`font-mono ${firstSnapshot.method === 'GET' ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400' :
                                            firstSnapshot.method === 'POST' ? 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400' :
                                                firstSnapshot.method === 'PUT' ? 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400' :
                                                    firstSnapshot.method === 'DELETE' ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400' :
                                                        'border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-400'
                                            }`}>
                                            {firstSnapshot.method}
                                        </Badge>
                                        <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{firstSnapshot.url}</span>
                                    </div>
                                    <Badge variant="secondary">{groupSnapshots.length} snapshot{groupSnapshots.length !== 1 ? 's' : ''}</Badge>
                                </button>

                                {/* Group Content (collapsible) */}
                                {isExpanded && (
                                    <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                                        {groupSnapshots.map((entry) => (
                                            <Card key={entry.id} className="group overflow-hidden border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md">
                                                <CardContent className="p-0">
                                                    <div className="flex flex-col sm:flex-row items-stretch">
                                                        {/* Status Indicator Strip */}
                                                        <div className={`w-1.5 sm:w-1.5 min-h-[4rem] ${entry.errorCount > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />

                                                        <div className="flex-1 p-5 flex flex-col gap-4">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                                <div className="flex items-start gap-3 overflow-hidden">
                                                                    <Badge variant="outline" className={`mt-0.5 shrink-0 font-mono ${entry.method === 'GET' ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400' :
                                                                        entry.method === 'POST' ? 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400' :
                                                                            entry.method === 'PUT' ? 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400' :
                                                                                entry.method === 'DELETE' ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400' :
                                                                                    'border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-400'
                                                                        }`}>
                                                                        {entry.method}
                                                                    </Badge>
                                                                    <div className="min-w-0">
                                                                        <p className="font-mono text-sm font-medium truncate text-zinc-900 dark:text-zinc-100" title={entry.url}>
                                                                            {entry.url}
                                                                        </p>
                                                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                                                                            <span className="flex items-center gap-1">
                                                                                <Calendar className="w-3 h-3" />
                                                                                {new Date(entry.timestamp).toLocaleDateString()}
                                                                            </span>
                                                                            <span className="flex items-center gap-1">
                                                                                <Clock className="w-3 h-3" />
                                                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-6 shrink-0 sm:pr-4">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-xs text-zinc-500 uppercase font-medium">Avg Time</span>
                                                                        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                                            {(entry.avgTime * 1000).toFixed(0)}<span className="text-xs font-normal text-zinc-500 ml-0.5">ms</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end hidden sm:flex">
                                                                        <span className="text-xs text-zinc-500 uppercase font-medium">Requests</span>
                                                                        <span className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                                            {entry.totalRequests}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end hidden sm:flex">
                                                                        <span className="text-xs text-zinc-500 uppercase font-medium">Errors</span>
                                                                        <span className={`font-mono text-lg font-bold ${entry.errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                                            {entry.errorCount}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions Area */}
                                                        <div className="flex items-center sm:border-l border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 px-4 py-3 sm:py-0 gap-2 sm:flex-col sm:justify-center">
                                                            {compareMode ? (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => toggleCompareSelection(entry.id)}
                                                                    className={`flex-1 sm:w-full ${selectedForCompare.includes(entry.id) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white dark:bg-zinc-800 text-indigo-600 hover:text-indigo-700 border-zinc-200'}`}
                                                                    variant="outline"
                                                                >
                                                                    {selectedForCompare.includes(entry.id) ? '✓ Selected' : 'Select'}
                                                                </Button>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => onViewDetails(entry.id)}
                                                                        className="flex-1 sm:w-full bg-white dark:bg-zinc-800 text-emerald-600 hover:text-emerald-700 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm"
                                                                        variant="outline"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5 mr-2" />
                                                                        View
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => onRunTest(entry)}
                                                                        className="flex-1 sm:w-full bg-white dark:bg-zinc-800 text-indigo-600 hover:text-indigo-700 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm"
                                                                        variant="outline"
                                                                    >
                                                                        <Play className="w-3.5 h-3.5 mr-2" />
                                                                        Rerun
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => onDeleteSnapshot(entry.id)}
                                                                        className="shrink-0 sm:w-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
