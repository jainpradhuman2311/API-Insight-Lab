import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Download, Upload, Trash2, Plus, RefreshCw, FileJson, MapPin, Check,
    ArrowRight, Settings, Link2, Layers, Key, Globe, ChevronRight, ChevronDown,
    Copy, MoreHorizontal, FileText, Folder, Search, X, AlertCircle
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PresetConfig {
    headers?: Array<{ key: string; value: string }>;
    queryParams?: Array<{ key: string; value: string }>;
    body?: string;
    bodyType?: string;
    authType?: string;
    authUsername?: string;
    authToken?: string;
    authKeyName?: string;
    authPassword?: string;
    authKeyValue?: string;
}

interface Preset {
    id: string;
    name: string;
    url: string;
    method: string;
    group_id?: string;
    config?: PresetConfig;
}

interface Chain {
    id: string;
    name: string;
    description: string;
    steps?: Array<{ id: string; name: string; method: string; url: string }>;
}

interface EnvironmentProfile {
    id: string;
    name: string;
    base_url: string;
    color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
    variables?: Array<{ key: string; value: string }>;
    is_active?: boolean;
}

interface UrlMapping { from: string; to: string; }
interface ImportPreview {
    presets: Array<{ name: string; url: string }>;
    chains: Array<{ name: string; stepsCount: number }>;
    detectedUrls: string[];
}

function groupPresetsByGroupId(presets: Preset[]): Map<string, Preset[]> {
    const groups = new Map<string, Preset[]>();
    presets.forEach(preset => {
        const groupId = preset.group_id || 'ungrouped';
        if (!groups.has(groupId)) groups.set(groupId, []);
        groups.get(groupId)!.push(preset);
    });
    return new Map([...groups.entries()].sort((a, b) => {
        if (a[0] === 'ungrouped') return 1;
        if (b[0] === 'ungrouped') return -1;
        return a[0].localeCompare(b[0]);
    }));
}

function formatGroupName(groupId: string): string {
    if (groupId === 'ungrouped') return 'Ungrouped';
    return groupId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function generateCurl(preset: Preset): string {
    const config = preset.config || {};
    let curl = `curl -X ${preset.method} "${preset.url}"`;
    if (config.headers) config.headers.filter(h => h.key).forEach(h => curl += ` \\\n  -H "${h.key}: ${h.value}"`);
    if (config.authType === 'basic' && config.authUsername) curl += ` \\\n  -u "${config.authUsername}:${config.authPassword || ''}"`;
    else if (config.authType === 'bearer' && config.authToken) curl += ` \\\n  -H "Authorization: Bearer ${config.authToken}"`;
    else if (config.authType === 'apikey' && config.authKeyName && config.authKeyValue) curl += ` \\\n  -H "${config.authKeyName}: ${config.authKeyValue}"`;
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(preset.method)) curl += ` \\\n  -d '${config.body.replace(/'/g, "'\\''")}'`;
    return curl;
}

const methodColors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    POST: 'bg-blue-100 text-blue-700 border-blue-200',
    PUT: 'bg-amber-100 text-amber-700 border-amber-200',
    PATCH: 'bg-orange-100 text-orange-700 border-orange-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
};

const envColorMap: Record<string, { bg: string; icon: string; border: string }> = {
    green: { bg: 'bg-emerald-100', icon: 'text-emerald-600', border: 'border-emerald-200' },
    yellow: { bg: 'bg-amber-100', icon: 'text-amber-600', border: 'border-amber-200' },
    red: { bg: 'bg-red-100', icon: 'text-red-600', border: 'border-red-200' },
    blue: { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200' },
    gray: { bg: 'bg-gray-100', icon: 'text-gray-600', border: 'border-gray-200' },
};

interface ConfigManagerViewProps {
    onEnvironmentChange?: () => void;
}

export function ConfigManagerView({ onEnvironmentChange }: ConfigManagerViewProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [presets, setPresets] = useState<Preset[]>([]);
    const [chains, setChains] = useState<Chain[]>([]);
    const [environments, setEnvironments] = useState<EnvironmentProfile[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
    const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'presets' | 'chains' | 'environments'>('presets');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['ungrouped']));
    const [expandedPresets, setExpandedPresets] = useState<Set<string>>(new Set());
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importData, setImportData] = useState<any>(null);
    const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
    const [urlMappings, setUrlMappings] = useState<UrlMapping[]>([]);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [envDialogOpen, setEnvDialogOpen] = useState(false);
    const [editingEnv, setEditingEnv] = useState<EnvironmentProfile | null>(null);
    const [envName, setEnvName] = useState('');
    const [envBaseUrl, setEnvBaseUrl] = useState('');
    const [envColor, setEnvColor] = useState<'green' | 'yellow' | 'red' | 'blue' | 'gray'>('gray');
    const [envVariables, setEnvVariables] = useState<Array<{ key: string; value: string }>>([]);

    // Export dialog state
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [includeAuth, setIncludeAuth] = useState(false);;

    // Search and Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMethod, setFilterMethod] = useState<string>('all');
    const [filterGroup, setFilterGroup] = useState<string>('all');

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'preset' | 'bulk' | 'environment'; id?: string; count?: number }>({ type: 'bulk' });

    useEffect(() => { loadPresets(); loadChains(); loadEnvironments(); }, []);

    const loadPresets = async () => { try { const res = await fetch('/api/perf-test/presets'); const data = await res.json(); setPresets(Array.isArray(data) ? data : []); } catch { console.error('Failed to load presets'); } };
    const loadChains = async () => { try { const res = await fetch('/api/perf-test/chains'); const data = await res.json(); setChains(Array.isArray(data) ? data : []); } catch { console.error('Failed to load chains'); } };
    const loadEnvironments = async () => { try { const res = await fetch('/api/perf-test/environments'); const data = await res.json(); setEnvironments(Array.isArray(data) ? data : []); } catch { console.error('Failed to load environments'); } };

    const handleDeletePreset = async (id: string) => {
        setDeleteTarget({ type: 'preset', id });
        setDeleteDialogOpen(true);
    };

    // Bulk delete handler - uses selectedPresets
    const handleBulkDelete = async () => {
        if (selectedPresets.size === 0) return;
        setDeleteTarget({ type: 'bulk', count: selectedPresets.size });
        setDeleteDialogOpen(true);
    };

    // Perform the confirmed delete
    const performDelete = async () => {
        setLoading(true);
        try {
            if (deleteTarget.type === 'preset' && deleteTarget.id) {
                await fetch(`/api/perf-test/presets/${deleteTarget.id}`, { method: 'DELETE' });
                toast({ title: '✓ Deleted' });
                loadPresets();
            } else if (deleteTarget.type === 'bulk') {
                const deletePromises = Array.from(selectedPresets).map(id =>
                    fetch(`/api/perf-test/presets/${id}`, { method: 'DELETE' })
                );
                await Promise.all(deletePromises);
                toast({ title: `✓ Deleted ${selectedPresets.size} presets` });
                setSelectedPresets(new Set());
                loadPresets();
            } else if (deleteTarget.type === 'environment' && deleteTarget.id) {
                await fetch(`/api/perf-test/environments/${deleteTarget.id}`, { method: 'DELETE' });
                toast({ title: '✓ Deleted' });
                loadEnvironments();
            }
        } catch { toast({ title: 'Failed to delete' }); }
        finally {
            setLoading(false);
            setDeleteDialogOpen(false);
        }
    };

    const handleCopyCurl = (preset: Preset) => { navigator.clipboard.writeText(generateCurl(preset)); toast({ title: '✓ Copied to clipboard' }); };

    const openExportDialog = () => {
        if (selectedPresets.size === 0 && selectedChains.size === 0) {
            toast({ title: 'Nothing selected' });
            return;
        }
        setExportDialogOpen(true);
    };

    const performExport = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/perf-test/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    presets: Array.from(selectedPresets),
                    chains: Array.from(selectedChains),
                    includeAuth
                })
            });
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `api-config-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            toast({ title: '✓ Exported' });
            setSelectedPresets(new Set());
            setSelectedChains(new Set());
            setExportDialogOpen(false);
        } catch {
            toast({ title: 'Export failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                setImportData(data);
                setImportPreview({ presets: (data.presets || []).map((p: any) => ({ name: p.name, url: p.url })), chains: (data.chains || []).map((c: any) => ({ name: c.name, stepsCount: c.steps?.length || 0 })), detectedUrls: data.detected_urls || [] });
                setUrlMappings((data.detected_urls || []).map((url: string) => ({ from: url, to: '' })));
                setImportDialogOpen(true);
            } catch { toast({ title: 'Invalid JSON file' }); }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImport = async () => {
        if (!importData) return; setLoading(true);
        try {
            const res = await fetch('/api/perf-test/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: importData, urlMappings: urlMappings.filter(m => m.from && m.to), replaceExisting }) });
            const result = await res.json();
            if (result.success) { toast({ title: '✓ Imported' }); setImportDialogOpen(false); setImportData(null); loadPresets(); loadChains(); }
            else { toast({ title: 'Import failed', description: result.error }); }
        } catch { toast({ title: 'Import failed' }); } finally { setLoading(false); }
    };

    const handleSaveEnvironment = async () => {
        if (!envName || !envBaseUrl) return;
        try {
            await fetch('/api/perf-test/environments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingEnv?.id,
                    name: envName,
                    base_url: envBaseUrl,
                    color: envColor,
                    variables: envVariables.filter(v => v.key)
                })
            });
            toast({ title: '✓ Saved' });
            setEnvDialogOpen(false);
            resetEnvForm();
            loadEnvironments();
            onEnvironmentChange?.(); // Notify parent to refresh
        } catch { toast({ title: 'Failed to save' }); }
    };

    const resetEnvForm = () => {
        setEditingEnv(null);
        setEnvName('');
        setEnvBaseUrl('');
        setEnvColor('gray');
        setEnvVariables([]);
    };

    const openEnvDialog = (env?: EnvironmentProfile) => {
        if (env) {
            setEditingEnv(env);
            setEnvName(env.name);
            setEnvBaseUrl(env.base_url);
            setEnvColor(env.color || 'gray');
            setEnvVariables(env.variables || []);
        } else {
            resetEnvForm();
        }
        setEnvDialogOpen(true);
    };

    const handleSetActiveEnvironment = async (id: string) => {
        try {
            await fetch('/api/perf-test/environments/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            toast({ title: '✓ Environment activated' });
            loadEnvironments();
            onEnvironmentChange?.(); // Notify parent to refresh
        } catch { toast({ title: 'Failed to set active' }); }
    };

    const handleCloneEnvironment = (env: EnvironmentProfile) => {
        setEditingEnv(null);
        setEnvName(env.name + ' (Copy)');
        setEnvBaseUrl(env.base_url);
        setEnvColor(env.color || 'gray');
        setEnvVariables([...(env.variables || [])]);
        setEnvDialogOpen(true);
    };

    const addEnvVariable = () => {
        setEnvVariables([...envVariables, { key: '', value: '' }]);
    };

    const updateEnvVariable = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...envVariables];
        updated[index][field] = value;
        setEnvVariables(updated);
    };

    const removeEnvVariable = (index: number) => {
        setEnvVariables(envVariables.filter((_, i) => i !== index));
    };

    const handleDeleteEnvironment = async (id: string) => {
        setDeleteTarget({ type: 'environment', id });
        setDeleteDialogOpen(true);
    };

    const toggleGroupExpand = (groupId: string) => { const s = new Set(expandedGroups); s.has(groupId) ? s.delete(groupId) : s.add(groupId); setExpandedGroups(s); };
    const togglePresetExpand = (id: string) => { const s = new Set(expandedPresets); s.has(id) ? s.delete(id) : s.add(id); setExpandedPresets(s); };

    // Filter presets
    const filteredPresets = presets.filter(p => {
        const matchesSearch = searchQuery === '' ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.url.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMethod = filterMethod === 'all' || p.method === filterMethod;
        const matchesGroup = filterGroup === 'all' || (p.group_id || 'ungrouped') === filterGroup;
        return matchesSearch && matchesMethod && matchesGroup;
    });

    // Get unique groups for filter dropdown
    const uniqueGroups = Array.from(new Set(presets.map(p => p.group_id || 'ungrouped')));

    const hasActiveFilters = searchQuery !== '' || filterMethod !== 'all' || filterGroup !== 'all';
    const clearFilters = () => { setSearchQuery(''); setFilterMethod('all'); setFilterGroup('all'); };

    const groupedPresets = groupPresetsByGroupId(filteredPresets);

    const renderConfigDetails = (config?: PresetConfig) => {
        if (!config) return <p className="text-sm text-gray-400 italic">No additional configuration</p>;
        const hasAuth = config.authType && config.authType !== 'none';
        const hasHeaders = (config.headers?.filter(h => h.key).length || 0) > 0;
        const hasParams = (config.queryParams?.filter(p => p.key).length || 0) > 0;
        const hasBody = config.body && config.bodyType !== 'none';
        if (!hasAuth && !hasHeaders && !hasParams && !hasBody) return <p className="text-sm text-gray-400 italic">No additional configuration</p>;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {hasAuth && <div className="bg-amber-50 rounded-lg p-3 border border-amber-100"><div className="flex items-center gap-2 mb-1"><Key className="w-4 h-4 text-amber-600" /><span className="font-medium text-amber-800">Auth</span></div><p className="text-amber-700 text-xs">{config.authType === 'basic' ? `Basic: ${config.authUsername}` : config.authType === 'bearer' ? 'Bearer Token' : `API Key: ${config.authKeyName}`}</p></div>}
                {hasHeaders && <div className="bg-blue-50 rounded-lg p-3 border border-blue-100"><div className="flex items-center gap-2 mb-1"><Globe className="w-4 h-4 text-blue-600" /><span className="font-medium text-blue-800">Headers ({config.headers!.filter(h => h.key).length})</span></div>{config.headers!.filter(h => h.key).slice(0, 2).map((h, i) => <p key={i} className="text-blue-700 text-xs font-mono truncate">{h.key}: {h.value}</p>)}</div>}
                {hasParams && <div className="bg-green-50 rounded-lg p-3 border border-green-100"><div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-green-600" /><span className="font-medium text-green-800">Query Params</span></div>{config.queryParams!.filter(p => p.key).slice(0, 2).map((p, i) => <p key={i} className="text-green-700 text-xs font-mono truncate">{p.key}={p.value}</p>)}</div>}
                {hasBody && <div className="bg-purple-50 rounded-lg p-3 border border-purple-100"><div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-purple-600" /><span className="font-medium text-purple-800">Body</span></div><pre className="text-purple-700 text-xs font-mono max-h-12 overflow-auto">{config.body!.substring(0, 80)}...</pre></div>}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Configuration Manager</h1>
                    <p className="text-sm text-gray-500">Manage API presets, chains, and environment profiles</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Download className="w-4 h-4 mr-2" /> Import</Button>
                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                    <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={openExportDialog} disabled={loading || (selectedPresets.size === 0 && selectedChains.size === 0)}><Upload className="w-4 h-4 mr-2" /> Export {(selectedPresets.size + selectedChains.size) > 0 && `(${selectedPresets.size + selectedChains.size})`}</Button>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={loading || selectedPresets.size === 0}><Trash2 className="w-4 h-4 mr-2" /> Delete {selectedPresets.size > 0 && `(${selectedPresets.size})`}</Button>
                </div>
            </div>

            {/* Simple Tabs */}
            <div className="flex gap-6 border-b border-gray-200 mb-6">
                {(['presets', 'chains', 'environments'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {tab === 'presets' && <><Layers className="w-4 h-4" /> API Presets</>}
                        {tab === 'chains' && <><Link2 className="w-4 h-4" /> Request Chains</>}
                        {tab === 'environments' && <><MapPin className="w-4 h-4" /> Environments</>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {tab === 'presets' ? presets.length : tab === 'chains' ? chains.length : environments.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Presets with Grouping */}
            {activeTab === 'presets' && (
                <div className="space-y-4">
                    {/* Compact Search and Filter Bar */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search presets..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-8 text-sm"
                            />
                        </div>
                        <select
                            value={filterMethod}
                            onChange={e => setFilterMethod(e.target.value)}
                            className="h-8 px-2 rounded border border-gray-200 bg-white text-sm cursor-pointer"
                        >
                            <option value="all">All Methods</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <select
                            value={filterGroup}
                            onChange={e => setFilterGroup(e.target.value)}
                            className="h-8 px-2 rounded border border-gray-200 bg-white text-sm cursor-pointer"
                        >
                            <option value="all">All Groups</option>
                            {uniqueGroups.map(g => (
                                <option key={g} value={g}>{formatGroupName(g)}</option>
                            ))}
                        </select>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-gray-500">
                                <X className="w-3 h-3" />
                            </Button>
                        )}
                        <span className="text-xs text-gray-400 ml-2">
                            {filteredPresets.length}/{presets.length}
                        </span>
                    </div>

                    {filteredPresets.length === 0 ? (
                        <div className="text-center py-12 text-gray-400"><Layers className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>{presets.length === 0 ? 'No presets saved' : 'No presets match your filters'}</p></div>
                    ) : (
                        Array.from(groupedPresets.entries()).map(([groupId, groupPresets]) => {
                            const isGroupExpanded = expandedGroups.has(groupId);
                            return (
                                <div key={groupId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    {/* Group Header */}
                                    <div
                                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleGroupExpand(groupId)}
                                    >
                                        <Checkbox
                                            checked={groupPresets.every(p => selectedPresets.has(p.id))}
                                            onCheckedChange={c => {
                                                const s = new Set(selectedPresets);
                                                groupPresets.forEach(p => c ? s.add(p.id) : s.delete(p.id));
                                                setSelectedPresets(s);
                                            }}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <Folder className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium text-sm text-gray-900 flex-1">{formatGroupName(groupId)}</span>
                                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{groupPresets.length}</span>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isGroupExpanded ? '' : '-rotate-90'}`} />
                                    </div>

                                    {/* Group Content */}
                                    {isGroupExpanded && (
                                        <div className="divide-y divide-gray-100">
                                            {groupPresets.map(preset => {
                                                const isExpanded = expandedPresets.has(preset.id);
                                                const config = preset.config || {};
                                                const hasConfig = (config.authType && config.authType !== 'none') || (config.headers?.filter(h => h.key).length || 0) > 0;
                                                return (
                                                    <div key={preset.id}>
                                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => togglePresetExpand(preset.id)}>
                                                            <Checkbox checked={selectedPresets.has(preset.id)} onCheckedChange={c => { const s = new Set(selectedPresets); c ? s.add(preset.id) : s.delete(preset.id); setSelectedPresets(s); }} onClick={e => e.stopPropagation()} />
                                                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                            <Badge className={`${methodColors[preset.method] || 'bg-gray-100 text-gray-700'} text-xs font-medium px-2 py-0.5 border`}>{preset.method}</Badge>
                                                            <span className="text-sm text-gray-600 font-mono flex-1 truncate">{preset.url}</span>
                                                            <span className="text-sm text-gray-400">{preset.name}</span>
                                                            {hasConfig && <Key className="w-3.5 h-3.5 text-amber-500" />}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal className="w-4 h-4 text-gray-400" /></button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleCopyCurl(preset)}><Copy className="w-4 h-4 mr-2" /> Copy as cURL</DropdownMenuItem>
                                                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeletePreset(preset.id)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                        {isExpanded && <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">{renderConfigDetails(preset.config)}</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Chains */}
            {activeTab === 'chains' && (
                <div className="space-y-4">
                    {/* Chains Search */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search chains..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-8 text-sm"
                            />
                        </div>
                        <span className="text-xs text-gray-400">
                            {chains.filter(c => searchQuery === '' || c.name.toLowerCase().includes(searchQuery.toLowerCase())).length}/{chains.length}
                        </span>
                    </div>

                    {chains.length === 0 ? (
                        <div className="text-center py-12 text-gray-400"><Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>No chains saved</p></div>
                    ) : (
                        <div className="space-y-2">
                            {chains.filter(c => searchQuery === '' || c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chain => (
                                <div key={chain.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 hover:border-gray-300 transition-colors">
                                    <Checkbox checked={selectedChains.has(chain.id)} onCheckedChange={c => { const s = new Set(selectedChains); c ? s.add(chain.id) : s.delete(chain.id); setSelectedChains(s); }} />
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <Link2 className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 text-sm">{chain.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{chain.description || 'No description'}</p>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">{chain.steps?.length || 0} steps</Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><button className="p-1 hover:bg-gray-100 rounded"><MoreHorizontal className="w-4 h-4 text-gray-400" /></button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Environments */}
            {activeTab === 'environments' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={() => openEnvDialog()}>
                            <Plus className="w-4 h-4 mr-2" /> Add Environment
                        </Button>
                    </div>
                    {environments.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No environments configured</p>
                            <p className="text-xs mt-2">Environments help you test APIs across different servers (Dev, Staging, Prod)</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {environments.map(env => {
                                const colors = envColorMap[env.color || 'gray'];
                                return (
                                    <div key={env.id} className={`bg-white rounded-lg border p-4 flex items-center gap-4 hover:shadow-sm transition-all ${env.is_active ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
                                        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                                            <MapPin className={`w-5 h-5 ${colors.icon}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-gray-900">{env.name}</p>
                                                {env.is_active && (
                                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                                        ✓ Active
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 font-mono truncate">{env.base_url}</p>
                                            {env.variables && env.variables.length > 0 && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {env.variables.length} variable{env.variables.length !== 1 ? 's' : ''}: {env.variables.map(v => v.key).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        {!env.is_active && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSetActiveEnvironment(env.id)}
                                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                            >
                                                Set Active
                                            </Button>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-2 hover:bg-gray-100 rounded">
                                                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEnvDialog(env)}>
                                                    <Settings className="w-4 h-4 mr-2" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleCloneEnvironment(env)}>
                                                    <Plus className="w-4 h-4 mr-2" /> Clone
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteEnvironment(env.id)}>
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileJson className="w-5 h-5" /> Import Configuration</DialogTitle><DialogDescription>Map URLs to your target environment</DialogDescription></DialogHeader>
                    {importPreview && (<div className="space-y-4">
                        <div className="flex gap-4"><Badge>{importPreview.presets.length} Presets</Badge><Badge>{importPreview.chains.length} Chains</Badge></div>
                        {urlMappings.length > 0 && <div className="space-y-2"><Label>URL Mappings</Label>{urlMappings.map((m, i) => <div key={i} className="flex items-center gap-2"><Input value={m.from} readOnly className="flex-1 bg-gray-50 text-sm font-mono" /><ArrowRight className="w-4 h-4 text-gray-400" /><Input value={m.to} onChange={e => { const n = [...urlMappings]; n[i].to = e.target.value; setUrlMappings(n); }} className="flex-1 text-sm font-mono" /></div>)}</div>}
                        <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                            <Checkbox checked={replaceExisting} onCheckedChange={c => setReplaceExisting(!!c)} className="mt-0.5" />
                            <div>
                                <Label className="text-sm font-medium cursor-pointer" onClick={() => setReplaceExisting(!replaceExisting)}>Replace existing presets</Label>
                                <p className="text-xs text-gray-500 mt-0.5">If checked, presets with the same name will be overwritten. Otherwise, duplicates will be skipped.</p>
                            </div>
                        </div>
                    </div>)}
                    <DialogFooter><Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button><Button className="bg-gray-900 hover:bg-gray-800" onClick={handleImport} disabled={loading}>{loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Import</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Environment Dialog */}
            <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingEnv ? 'Edit' : 'Add'} Environment</DialogTitle>
                        <DialogDescription>Configure your environment profile with URL and variables</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <Label>Name</Label>
                            <Input value={envName} onChange={e => setEnvName(e.target.value)} placeholder="e.g., Production" />
                        </div>

                        {/* Base URL */}
                        <div>
                            <Label>Base URL</Label>
                            <Input value={envBaseUrl} onChange={e => setEnvBaseUrl(e.target.value)} placeholder="https://api.example.com" className="font-mono" />
                        </div>

                        {/* Color Picker */}
                        <div>
                            <Label className="mb-2 block">Color</Label>
                            <div className="flex gap-3">
                                {(['green', 'yellow', 'red', 'blue', 'gray'] as const).map(color => {
                                    const colorStyles = envColorMap[color];
                                    const isSelected = envColor === color;
                                    return (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEnvColor(color);
                                            }}
                                            className={`w-10 h-10 rounded-lg ${colorStyles.bg} flex items-center justify-center cursor-pointer border-2 ${isSelected ? `${colorStyles.border} ring-2 ring-offset-2 ring-gray-400` : 'border-transparent hover:scale-105'} transition-transform`}
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            <MapPin className={`w-5 h-5 ${colorStyles.icon}`} />
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Use colors to visually distinguish environments (green=Dev, yellow=Staging, red=Prod)</p>
                        </div>

                        {/* Environment Variables */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>Variables</Label>
                                <Button variant="ghost" size="sm" onClick={addEnvVariable} className="text-xs h-7">
                                    <Plus className="w-3 h-3 mr-1" /> Add Variable
                                </Button>
                            </div>
                            {envVariables.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No variables defined. Add API keys, tokens, or other env-specific values.</p>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {envVariables.map((v, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                value={v.key}
                                                onChange={e => updateEnvVariable(i, 'key', e.target.value)}
                                                placeholder="KEY_NAME"
                                                className="flex-1 h-8 text-sm font-mono"
                                            />
                                            <Input
                                                value={v.value}
                                                onChange={e => updateEnvVariable(i, 'value', e.target.value)}
                                                placeholder="value"
                                                className="flex-1 h-8 text-sm"
                                                type="password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeEnvVariable(i)}
                                                className="p-1 hover:bg-red-50 rounded text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEnvDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-gray-900 hover:bg-gray-800" onClick={handleSaveEnvironment}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Export Confirmation Dialog */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5" /> Export Configuration
                        </DialogTitle>
                        <DialogDescription>
                            Export {selectedPresets.size} preset{selectedPresets.size !== 1 ? 's' : ''} and {selectedChains.size} chain{selectedChains.size !== 1 ? 's' : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                            <Checkbox
                                checked={includeAuth}
                                onCheckedChange={c => setIncludeAuth(!!c)}
                                className="mt-0.5"
                            />
                            <div>
                                <Label className="text-sm font-medium cursor-pointer" onClick={() => setIncludeAuth(!includeAuth)}>
                                    Include authentication data
                                </Label>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Includes usernames, passwords, tokens, and API keys in the export file.
                                </p>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700 flex gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Export file may contain sensitive data. Handle with care.</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-gray-900 hover:bg-gray-800" onClick={performExport} disabled={loading}>
                            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            Export
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-5 h-5" /> Confirm Delete
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget.type === 'bulk' && `Are you sure you want to delete ${deleteTarget.count || selectedPresets.size} selected preset(s)?`}
                            {deleteTarget.type === 'preset' && 'Are you sure you want to delete this preset?'}
                            {deleteTarget.type === 'environment' && 'Are you sure you want to delete this environment?'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700 flex gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>This action cannot be undone.</span>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={performDelete} disabled={loading}>
                            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
