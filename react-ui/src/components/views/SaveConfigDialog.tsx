import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Folder, Plus, Save, FilePlus } from 'lucide-react'

interface SaveConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (name: string, groupId: string, action: 'create' | 'update') => void;
    currentUrl: string;
    loadedPresetId?: string | null;
    loadedPresetName?: string | null;
}

interface Group {
    id: string;
    name: string;
}

export function SaveConfigDialog({ open, onOpenChange, onSave, currentUrl, loadedPresetId, loadedPresetName }: SaveConfigDialogProps) {
    const [name, setName] = useState('')
    const [groupId, setGroupId] = useState('ungrouped')
    const [groups, setGroups] = useState<Group[]>([])
    const [showNewGroup, setShowNewGroup] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [saveAction, setSaveAction] = useState<'create' | 'update'>('create')

    const detectGroup = (url: string): string => {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length >= 2 && ['rest', 'api'].includes(parts[0])) {
                return `${parts[0]}_${parts[1]}`;
            }
        } catch { /* ignore */ }
        return 'ungrouped';
    };

    useEffect(() => {
        if (open) {
            loadGroups();
            // Set default group - prefer detected group from URL, fallback to ungrouped
            const detected = detectGroup(currentUrl);
            setGroupId(detected || 'ungrouped');
            // If a preset is loaded, default to update
            if (loadedPresetId) {
                setSaveAction('update');
                setName(loadedPresetName || '');
            } else {
                setSaveAction('create');
                setName('');
            }
        }
    }, [open, currentUrl, loadedPresetId, loadedPresetName]);

    const loadGroups = async () => {
        try {
            const res = await fetch('/api/perf-test/groups');
            const data = await res.json();
            if (Array.isArray(data)) setGroups(data);
        } catch { console.error('Failed to load groups'); }
    };

    const handleSave = () => {
        const finalName = saveAction === 'update' && loadedPresetName ? loadedPresetName : name;
        if (!finalName.trim()) return;
        const finalGroup = showNewGroup && newGroupName.trim()
            ? newGroupName.trim().toLowerCase().replace(/\s+/g, '_')
            : groupId;
        onSave(finalName, finalGroup || 'ungrouped', saveAction);
        setName('');
        setGroupId('ungrouped');
        setNewGroupName('');
        setShowNewGroup(false);
        onOpenChange(false);
    }

    const formatGroupName = (id: string) => {
        if (id === 'ungrouped') return 'Ungrouped';
        return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Save API Configuration</DialogTitle>
                    <DialogDescription>
                        {loadedPresetId
                            ? 'Update existing preset or create a new one'
                            : 'Save the current request as a preset'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Show update/create choice if preset is loaded */}
                    {loadedPresetId && (
                        <div className="space-y-3">
                            <Label>What would you like to do?</Label>
                            <RadioGroup value={saveAction} onValueChange={(v) => setSaveAction(v as 'create' | 'update')} className="space-y-2">
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => setSaveAction('update')}>
                                    <RadioGroupItem value="update" id="update" />
                                    <Save className="w-4 h-4 text-blue-500" />
                                    <div className="flex-1">
                                        <Label htmlFor="update" className="font-medium cursor-pointer">Update existing</Label>
                                        <p className="text-xs text-gray-500">Update "{loadedPresetName}"</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => setSaveAction('create')}>
                                    <RadioGroupItem value="create" id="create" />
                                    <FilePlus className="w-4 h-4 text-green-500" />
                                    <div className="flex-1">
                                        <Label htmlFor="create" className="font-medium cursor-pointer">Create new</Label>
                                        <p className="text-xs text-gray-500">Save as a new preset</p>
                                    </div>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    {/* Name field - only for new presets */}
                    {saveAction === 'create' && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., User Login Flow"
                                className="col-span-3"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* URL display */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-muted-foreground">URL</Label>
                        <div className="col-span-3 text-sm text-muted-foreground truncate font-mono bg-muted p-2 rounded">
                            {currentUrl || 'No URL set'}
                        </div>
                    </div>

                    {/* Group selection - for all cases */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                            <div className="flex items-center gap-1">
                                <Folder className="w-3.5 h-3.5" /> Group
                            </div>
                        </Label>
                        {!showNewGroup ? (
                            <div className="col-span-3 flex gap-2">
                                <Select value={groupId} onValueChange={setGroupId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select group" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[99999999]">
                                        <SelectItem value="ungrouped">Ungrouped</SelectItem>
                                        {groups.filter(g => g.id !== 'ungrouped').map(g => (
                                            <SelectItem key={g.id} value={g.id}>{formatGroupName(g.id)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="icon" onClick={() => setShowNewGroup(true)} title="Add new group">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="col-span-3 flex gap-2">
                                <Input
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Enter new group name"
                                    className="flex-1"
                                />
                                <Button variant="ghost" size="sm" onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}>
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={saveAction === 'create' && !name.trim()}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                        {saveAction === 'update' ? 'Update Preset' : 'Save Preset'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
