import { useState, useEffect } from 'react';
import { CodeEditor } from '../CodeEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CodeSnippet } from '@/components/CodeSnippet';
import parseCurl from 'parse-curl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Plus,
    Trash2,
    Play,
    Save,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Variable,
    Clock,
    Link2,
    Terminal,
    Copy,
    Download,
    Braces
} from 'lucide-react';

interface KeyValue {
    key: string;
    value: string;
}

interface VariableExtraction {
    variableName: string;
    source: 'body' | 'header' | 'status';
    path: string;
}

interface ChainStep {
    id: string;
    name: string;
    url: string;
    method: string;
    headers: KeyValue[];
    body: string;
    auth?: {
        type: 'none' | 'basic' | 'bearer' | 'apikey';
        username?: string;
        password?: string;
        token?: string;
        keyName?: string;
        keyValue?: string;
    };
    extractions: VariableExtraction[];
    stopOnError: boolean;
}

interface StepResult {
    stepId: string;
    stepName: string;
    success: boolean;
    status: number;
    duration: number;
    extractedVariables: Record<string, any>;
    assertions: any[];
    error: string | null;
    response?: {
        body: string;
        headers: Record<string, string[]>;
    };
}

interface ChainResult {
    success: boolean;
    steps: StepResult[];
    variables: Record<string, any>;
    totalDuration: number;
}

interface SavedChain {
    id: string;
    name: string;
    description: string;
    steps: ChainStep[];
    created: number;
}

const createEmptyStep = (): ChainStep => ({
    id: crypto.randomUUID(),
    name: '',
    url: '',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    extractions: [],
    stopOnError: true,
});

export function ChainBuilderView() {
    const { toast } = useToast();
    const [chainName, setChainName] = useState('');
    const [chainDescription, setChainDescription] = useState('');
    const [steps, setSteps] = useState<ChainStep[]>([createEmptyStep()]);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<ChainResult | null>(null);
    const [savedChains, setSavedChains] = useState<SavedChain[]>([]);
    const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [importCurlOpen, setImportCurlOpen] = useState(false);
    const [importStepId, setImportStepId] = useState<string | null>(null);
    const [curlInput, setCurlInput] = useState('');

    // Global variables that can be used across all steps
    const [globalVariables, setGlobalVariables] = useState<KeyValue[]>([
        { key: 'base_url', value: 'https://my-lando-app.lndo.site' }
    ]);

    // Fetch saved chains on mount
    useEffect(() => {
        fetchChains();
    }, []);

    const fetchChains = async () => {
        try {
            const response = await fetch('/api/perf-test/chains');
            if (response.ok) {
                const data = await response.json();
                setSavedChains(data);
            }
        } catch (error) {
            console.error('Failed to fetch chains:', error);
        }
    };

    const addStep = () => {
        const newStep = createEmptyStep();
        setSteps([...steps, newStep]);
        setExpandedStep(newStep.id);
    };

    const removeStep = (stepId: string) => {
        if (steps.length <= 1) return;
        setSteps(steps.filter(s => s.id !== stepId));
    };

    const updateStep = (stepId: string, updates: Partial<ChainStep>) => {
        setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
    };

    const moveStep = (stepId: string, direction: 'up' | 'down') => {
        const index = steps.findIndex(s => s.id === stepId);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const newSteps = [...steps];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
        setSteps(newSteps);
    };

    const addExtraction = (stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        updateStep(stepId, {
            extractions: [...step.extractions, { variableName: '', source: 'body', path: '' }]
        });
    };

    const updateExtraction = (stepId: string, index: number, updates: Partial<VariableExtraction>) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        const newExtractions = [...step.extractions];
        newExtractions[index] = { ...newExtractions[index], ...updates };
        updateStep(stepId, { extractions: newExtractions });
    };

    const removeExtraction = (stepId: string, index: number) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        updateStep(stepId, {
            extractions: step.extractions.filter((_, i) => i !== index)
        });
    };

    const addHeader = (stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        updateStep(stepId, {
            headers: [...step.headers, { key: '', value: '' }]
        });
    };

    const updateHeader = (stepId: string, index: number, updates: Partial<KeyValue>) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        const newHeaders = [...step.headers];
        newHeaders[index] = { ...newHeaders[index], ...updates };
        updateStep(stepId, { headers: newHeaders });
    };

    const removeHeader = (stepId: string, index: number) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        updateStep(stepId, {
            headers: step.headers.filter((_, i) => i !== index)
        });
    };

    const runChain = async () => {
        setRunning(true);
        setResult(null);

        try {
            const csrfToken = (window as any).drupalSettings?.api_insight_lab?.csrf_token;
            // Convert globalVariables array to object for easier backend processing
            const globalVarsObject = globalVariables.reduce((acc, v) => {
                if (v.key.trim()) acc[v.key] = v.value;
                return acc;
            }, {} as Record<string, string>);

            const response = await fetch('/api/perf-test/chains/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                body: JSON.stringify({ steps, globalVariables: globalVarsObject })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Server error: ${text.substring(0, 100)}...`);
            }

            if (data.error) {
                toast({
                    title: 'Chain Execution Failed',
                    description: data.error
                });
            } else {
                setResult(data);
                toast({
                    title: data.success ? 'Chain Completed' : 'Chain Completed with Errors',
                    description: `${data.steps.length} steps executed in ${data.totalDuration.toFixed(0)}ms`
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to run chain'
            });
        } finally {
            setRunning(false);
        }
    };

    const saveChain = async () => {
        if (!chainName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a chain name'
            });
            return;
        }

        try {
            const csrfToken = (window as any).drupalSettings?.api_insight_lab?.csrf_token;
            const response = await fetch('/api/perf-test/chains', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || ''
                },
                body: JSON.stringify({
                    name: chainName,
                    description: chainDescription,
                    steps
                })
            });

            const data = await response.json();
            if (data.success) {
                toast({
                    title: 'Chain Saved',
                    description: `"${chainName}" saved successfully`
                });
                setSaveDialogOpen(false);
                fetchChains();
            } else {
                throw new Error(data.error || 'Failed to save chain');
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save chain'
            });
        }
    };

    const loadChain = (chain: SavedChain) => {
        setChainName(chain.name);
        setChainDescription(chain.description);
        setSteps(chain.steps.length > 0 ? chain.steps : [createEmptyStep()]);
        setSelectedChainId(chain.id);
        setResult(null);
        toast({
            title: 'Chain Loaded',
            description: `Loaded "${chain.name}"`
        });
    };

    const deleteChain = async (chainId: string) => {
        try {
            const csrfToken = (window as any).drupalSettings?.api_insight_lab?.csrf_token;
            const response = await fetch(`/api/perf-test/chains/${chainId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': csrfToken || ''
                }
            });

            if (response.ok) {
                toast({ title: 'Chain Deleted' });
                fetchChains();
                if (selectedChainId === chainId) {
                    setChainName('');
                    setChainDescription('');
                    setSteps([createEmptyStep()]);
                    setSelectedChainId(null);
                }
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete chain'
            });
        }
    };

    // cURL Helpers
    const copyCurlForStep = (step: ChainStep) => {
        let cmd = `curl -X ${step.method} "${step.url}"`;

        // Add headers
        step.headers.forEach(h => {
            if (h.key && h.value) cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
        });

        // Add body
        if (step.body) {
            // Escape single quotes for shell
            const escapedBody = step.body.replace(/'/g, "'\\''");
            cmd += ` \\\n  -d '${escapedBody}'`;
        }

        navigator.clipboard.writeText(cmd);
        toast({ title: 'Copied to clipboard', description: 'cURL command copied' });
    };

    const openImportCurl = (stepId: string) => {
        setImportStepId(stepId);
        setCurlInput('');
        setImportCurlOpen(true);
    };

    const handleImportCurl = () => {
        if (!curlInput.trim() || !importStepId) return;

        try {
            // @ts-ignore
            const parsed = parseCurl(curlInput);
            if (parsed && parsed.url) {
                // Extract query params if any
                let finalUrl = parsed.url;

                // Convert headers
                const headers: KeyValue[] = [];
                if (parsed.header) {
                    Object.entries(parsed.header).forEach(([key, value]) => {
                        headers.push({ key, value: String(value) });
                    });
                }

                // Update step
                updateStep(importStepId, {
                    url: finalUrl,
                    method: parsed.method || 'GET',
                    headers: headers,
                    body: parsed.body || ''
                });

                toast({ title: 'Imported', description: 'cURL command imported successfully' });
                setImportCurlOpen(false);
            } else {
                throw new Error('Invalid cURL command');
            }
        } catch (e) {
            toast({
                title: 'Import Failed',
                description: 'Could not parse cURL command',
                type: 'error'
            } as any);
        }
    };

    // Get all extracted variables for display
    const allVariables = result?.variables || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Link2 className="w-6 h-6" />
                        Request Chains
                    </h2>
                    <p className="text-muted-foreground">
                        Chain multiple requests together and pass data between them using variables.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Save className="w-4 h-4 mr-2" />
                                Save Chain
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Request Chain</DialogTitle>
                                <DialogDescription>
                                    Save this chain for later use.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Chain Name</Label>
                                    <Input
                                        value={chainName}
                                        onChange={e => setChainName(e.target.value)}
                                        placeholder="e.g., Login and Get Profile"
                                    />
                                </div>
                                <div>
                                    <Label>Description (optional)</Label>
                                    <Textarea
                                        value={chainDescription}
                                        onChange={e => setChainDescription(e.target.value)}
                                        placeholder="Describe what this chain does..."
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={saveChain}>Save</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={runChain} disabled={running || steps.every(s => !s.url)}>
                        <Play className="w-4 h-4 mr-2" />
                        {running ? 'Running...' : 'Run Chain'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Saved Chains Sidebar */}
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Saved Chains</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {savedChains.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No saved chains yet</p>
                            ) : (
                                savedChains.map(chain => (
                                    <div
                                        key={chain.id}
                                        className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${selectedChainId === chain.id ? 'border-primary bg-accent/30' : ''
                                            }`}
                                        onClick={() => loadChain(chain)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{chain.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {chain.steps.length} step{chain.steps.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={e => { e.stopPropagation(); deleteChain(chain.id); }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Global Variables Panel */}
                    <Card className="mt-4">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Variable className="w-4 h-4" />
                                Global Variables
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Define variables to use across all steps with {"{{variableName}}"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {globalVariables.map((variable, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={variable.key}
                                        onChange={e => {
                                            const newVars = [...globalVariables];
                                            newVars[index].key = e.target.value;
                                            setGlobalVariables(newVars);
                                        }}
                                        placeholder="name"
                                        className="flex-1 font-mono text-xs"
                                    />
                                    <Input
                                        value={variable.value}
                                        onChange={e => {
                                            const newVars = [...globalVariables];
                                            newVars[index].value = e.target.value;
                                            setGlobalVariables(newVars);
                                        }}
                                        placeholder="value"
                                        className="flex-1 text-xs"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => setGlobalVariables(globalVariables.filter((_, i) => i !== index))}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setGlobalVariables([...globalVariables, { key: '', value: '' }])}
                            >
                                <Plus className="w-3 h-3 mr-1" /> Add Variable
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Extracted Variables Panel (from chain execution) */}
                    {Object.keys(allVariables).length > 0 && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Variable className="w-4 h-4" />
                                    Extracted Variables
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {Object.entries(allVariables).map(([name, value]) => (
                                        <div key={name} className="flex items-center justify-between p-2 bg-muted rounded">
                                            <code className="text-sm font-mono text-primary">{`{{${name}}}`}</code>
                                            <span className="text-sm truncate max-w-[150px]" title={String(value)}>
                                                {String(value).substring(0, 30)}{String(value).length > 30 ? '...' : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Chain Builder */}
                <div className="lg:col-span-2 space-y-4">
                    {steps.map((step, index) => {
                        const stepResult = result?.steps.find(r => r.stepId === step.id);
                        const isExpanded = expandedStep === step.id;

                        return (
                            <Card key={step.id} className={stepResult ? (stepResult.success ? 'border-green-500/50' : 'border-red-500/50') : ''}>
                                <CardHeader className="py-3 cursor-pointer" onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                                                    {index + 1}
                                                </Badge>
                                                {index > 0 && <ArrowRight className="w-4 h-4 text-muted-foreground -ml-1" />}
                                            </div>
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    {step.name || `Step ${index + 1}`}
                                                    {stepResult && (
                                                        stepResult.success
                                                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                            : <XCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    <Badge variant="secondary" className="mr-2">{step.method}</Badge>
                                                    {step.url || 'No URL set'}
                                                    {stepResult && (
                                                        <span className="ml-2">
                                                            <Clock className="w-3 h-3 inline mr-1" />
                                                            {stepResult.duration.toFixed(0)}ms
                                                        </span>
                                                    )}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon">
                                                        <Terminal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openImportCurl(step.id); }}>
                                                        <Download className="w-4 h-4 mr-2" /> Import cURL
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyCurlForStep(step); }}>
                                                        <Copy className="w-4 h-4 mr-2" /> Copy cURL
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); moveStep(step.id, 'up'); }} disabled={index === 0}>
                                                <ChevronUp className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); moveStep(step.id, 'down'); }} disabled={index === steps.length - 1}>
                                                <ChevronDown className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); removeStep(step.id); }} disabled={steps.length <= 1}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="border-t pt-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Step Name</Label>
                                                <Input
                                                    value={step.name}
                                                    onChange={e => updateStep(step.id, { name: e.target.value })}
                                                    placeholder="e.g., Login"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Method</Label>
                                                <Select value={step.method} onValueChange={v => updateStep(step.id, { method: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>URL</Label>
                                            <Input
                                                value={step.url}
                                                onChange={e => updateStep(step.id, { url: e.target.value })}
                                                placeholder="https://api.example.com/endpoint or use {{variable}}"
                                                className="font-mono text-sm"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Use <code className="text-primary">{`{{variableName}}`}</code> to insert extracted values
                                            </p>
                                        </div>

                                        <Tabs defaultValue="headers">
                                            <TabsList>
                                                <TabsTrigger value="auth">Auth</TabsTrigger>
                                                <TabsTrigger value="headers">Headers</TabsTrigger>
                                                <TabsTrigger value="body">Body</TabsTrigger>
                                                <TabsTrigger value="extractions">
                                                    Extractions
                                                    {step.extractions.length > 0 && (
                                                        <Badge variant="secondary" className="ml-2">{step.extractions.length}</Badge>
                                                    )}
                                                </TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="auth" className="space-y-4 mt-4">
                                                <div className="space-y-2">
                                                    <Label>Authentication Type</Label>
                                                    <Select
                                                        value={step.auth?.type || 'none'}
                                                        onValueChange={v => updateStep(step.id, { auth: { ...step.auth, type: v as any } })}
                                                    >
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">None</SelectItem>
                                                            <SelectItem value="bearer">Bearer Token</SelectItem>
                                                            <SelectItem value="basic">Basic Auth</SelectItem>
                                                            <SelectItem value="apikey">API Key</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {step.auth?.type === 'bearer' && (
                                                    <div className="space-y-2">
                                                        <Label>Token</Label>
                                                        <Input
                                                            value={step.auth.token || ''}
                                                            onChange={e => updateStep(step.id, { auth: { ...(step.auth || { type: 'bearer' }), token: e.target.value } })}
                                                            placeholder="Enter token or {{variable}}"
                                                        />
                                                    </div>
                                                )}

                                                {step.auth?.type === 'basic' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Username</Label>
                                                            <Input
                                                                value={step.auth.username || ''}
                                                                onChange={e => updateStep(step.id, { auth: { ...(step.auth || { type: 'basic' }), username: e.target.value } })}
                                                                placeholder="Username"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Password</Label>
                                                            <Input
                                                                type="password"
                                                                value={step.auth.password || ''}
                                                                onChange={e => updateStep(step.id, { auth: { ...(step.auth || { type: 'basic' }), password: e.target.value } })}
                                                                placeholder="Password"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {step.auth?.type === 'apikey' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Key</Label>
                                                            <Input
                                                                value={step.auth.keyName || ''}
                                                                onChange={e => updateStep(step.id, { auth: { ...(step.auth || { type: 'apikey' }), keyName: e.target.value } })}
                                                                placeholder="e.g., X-API-Key"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Value</Label>
                                                            <Input
                                                                value={step.auth.keyValue || ''}
                                                                onChange={e => updateStep(step.id, { auth: { ...(step.auth || { type: 'apikey' }), keyValue: e.target.value } })}
                                                                placeholder="Enter API Key"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="headers" className="space-y-2 mt-4">
                                                {step.headers.map((header, hIndex) => (
                                                    <div key={hIndex} className="flex gap-2">
                                                        <Input
                                                            value={header.key}
                                                            onChange={e => updateHeader(step.id, hIndex, { key: e.target.value })}
                                                            placeholder="Header name"
                                                            className="flex-1"
                                                        />
                                                        <Input
                                                            value={header.value}
                                                            onChange={e => updateHeader(step.id, hIndex, { value: e.target.value })}
                                                            placeholder="Value (use {{var}} for variables)"
                                                            className="flex-1"
                                                        />
                                                        <Button variant="ghost" size="icon" onClick={() => removeHeader(step.id, hIndex)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button variant="outline" size="sm" onClick={() => addHeader(step.id)}>
                                                    <Plus className="w-4 h-4 mr-2" /> Add Header
                                                </Button>
                                            </TabsContent>

                                            <TabsContent value="body" className="mt-4">
                                                <div className="flex justify-end mb-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                        onClick={() => {
                                                            try {
                                                                const parsed = JSON.parse(step.body);
                                                                updateStep(step.id, { body: JSON.stringify(parsed, null, 2) });
                                                                toast({ title: 'JSON Beautified' });
                                                            } catch (e) {
                                                                toast({ title: 'Invalid JSON', description: 'Could not parse body as JSON' });
                                                            }
                                                        }}
                                                    >
                                                        <Braces className="w-3.5 h-3.5 mr-1.5" />
                                                        Beautify JSON
                                                    </Button>
                                                </div>
                                                <CodeEditor
                                                    value={step.body}
                                                    onChange={(value: string) => updateStep(step.id, { body: value })}
                                                    placeholder='{"key": "value"} or use {{variables}}'
                                                    language="json"
                                                    minHeight="200px"
                                                />
                                            </TabsContent>

                                            <TabsContent value="extractions" className="space-y-4 mt-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Extract values from the response to use in subsequent steps.
                                                </p>
                                                {step.extractions.map((extraction, eIndex) => (
                                                    <div key={eIndex} className="flex gap-2 items-end">
                                                        <div className="flex-1">
                                                            <Label className="text-xs">Variable Name</Label>
                                                            <Input
                                                                value={extraction.variableName}
                                                                onChange={e => updateExtraction(step.id, eIndex, { variableName: e.target.value })}
                                                                placeholder="token"
                                                                className="font-mono"
                                                            />
                                                        </div>
                                                        <div className="w-32">
                                                            <Label className="text-xs">Source</Label>
                                                            <Select
                                                                value={extraction.source}
                                                                onValueChange={v => updateExtraction(step.id, eIndex, { source: v as any })}
                                                            >
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="body">Body (JSON)</SelectItem>
                                                                    <SelectItem value="header">Header</SelectItem>
                                                                    <SelectItem value="status">Status Code</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <Label className="text-xs">Path</Label>
                                                            <Input
                                                                value={extraction.path}
                                                                onChange={e => updateExtraction(step.id, eIndex, { path: e.target.value })}
                                                                placeholder="$.data.token"
                                                                className="font-mono"
                                                            />
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => removeExtraction(step.id, eIndex)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button variant="outline" size="sm" onClick={() => addExtraction(step.id)}>
                                                    <Plus className="w-4 h-4 mr-2" /> Add Extraction
                                                </Button>
                                            </TabsContent>
                                        </Tabs>

                                        {/* Step Result */}
                                        {stepResult && (
                                            <div className={`p-3 rounded-lg ${stepResult.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {stepResult.success ? 'Success' : 'Failed'}
                                                    </span>
                                                    <span>Status: {stepResult.status} | {stepResult.duration.toFixed(0)}ms</span>
                                                </div>
                                                {stepResult.error && (
                                                    <p className="text-red-500 text-sm mt-2">{stepResult.error}</p>
                                                )}
                                                {Object.keys(stepResult.extractedVariables).length > 0 && (
                                                    <div className="mt-2">
                                                        <p className="text-xs font-medium">Extracted:</p>
                                                        {Object.entries(stepResult.extractedVariables).map(([k, v]) => (
                                                            <span key={k} className="text-xs mr-2">
                                                                <code>{k}</code>: {String(v).substring(0, 50)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Response Viewer */}
                                                {stepResult.response && (
                                                    <div className="mt-3 border-t pt-3">
                                                        <Tabs defaultValue="body" className="w-full">
                                                            <TabsList className="h-7">
                                                                <TabsTrigger value="body" className="text-xs h-6 px-2">Body</TabsTrigger>
                                                                <TabsTrigger value="headers" className="text-xs h-6 px-2">Headers</TabsTrigger>
                                                            </TabsList>
                                                            <TabsContent value="body" className="mt-2">
                                                                <CodeSnippet
                                                                    code={(() => {
                                                                        try {
                                                                            return JSON.stringify(JSON.parse(stepResult.response.body), null, 2);
                                                                        } catch {
                                                                            return stepResult.response.body;
                                                                        }
                                                                    })()}
                                                                    language="json"
                                                                    maxHeight="200px"
                                                                />
                                                            </TabsContent>
                                                            <TabsContent value="headers" className="mt-2">
                                                                <CodeSnippet
                                                                    code={Object.entries(stepResult.response.headers).map(([key, values]) =>
                                                                        `${key}: ${Array.isArray(values) ? values.join(', ') : values}`
                                                                    ).join('\n')}
                                                                    language="markup"
                                                                    maxHeight="200px"
                                                                />
                                                            </TabsContent>
                                                        </Tabs>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}

                    <Button variant="outline" className="w-full" onClick={addStep}>
                        <Plus className="w-4 h-4 mr-2" /> Add Step
                    </Button>
                </div>
            </div>


            {/* Import cURL Dialog */}
            <Dialog open={importCurlOpen} onOpenChange={setImportCurlOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import cURL</DialogTitle>
                        <DialogDescription>Paste a cURL command to populate this step.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea
                            value={curlInput}
                            onChange={e => setCurlInput(e.target.value)}
                            placeholder="curl -X POST https://api.example.com/..."
                            className="font-mono text-sm h-32"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImportCurlOpen(false)}>Cancel</Button>
                        <Button onClick={handleImportCurl}>Import</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
