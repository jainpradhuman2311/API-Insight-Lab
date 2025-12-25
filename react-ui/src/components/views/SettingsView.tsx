import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SettingsConfig } from "../../types"
import { Save, Shield, Globe, Zap, Eye, EyeOff } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

interface SettingsViewProps {
    settings: SettingsConfig;
    setSettings: (settings: SettingsConfig) => void;
}

export function SettingsView({ settings, setSettings }: SettingsViewProps) {

    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [showToken, setShowToken] = useState(false);

    // Load settings from backend on mount
    useEffect(() => {
        fetch('/api/perf-test/settings')
            .then(res => res.json())
            .then(data => {
                // Backend now returns flat structure!
                setSettings({
                    ...settings,
                    baseUrl: data.baseUrl || settings.baseUrl,
                    defaultAuthType: data.defaultAuthType || 'none',
                    defaultUsername: data.defaultUsername || '',
                    defaultPassword: data.defaultPassword || '',
                    defaultToken: data.defaultToken || '',
                    defaultApiKey: data.defaultApiKey || '',
                    defaultTimeout: data.defaultTimeout || 30,
                    defaultConcurrency: data.defaultConcurrency || 10,
                })
            })
            .catch(err => console.error('Failed to load settings:', err))
    }, []) // Empty dependency array - only run on mount



    const handleSave = async () => {
        // Save to Backend only (no localStorage)
        try {
            const response = await fetch('/api/perf-test/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Success',
                    description: 'Settings saved successfully!',
                    type: 'success'
                });
            } else {
                toast({
                    title: 'Error',
                    description: 'Failed to save settings: ' + (data.error || 'Unknown error'),
                    type: 'error'
                });
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
            toast({
                title: 'Error',
                description: 'Error saving settings',
                type: 'error'
            });
        }
    }

    const updateSetting = (key: keyof SettingsConfig, value: any) => {
        setSettings({ ...settings, [key]: value })
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h2>
                    <p className="text-muted-foreground">Manage global defaults for your API tests.</p>
                </div>
                <Button onClick={handleSave} className="gap-2">
                    <Save className="w-4 h-4" /> Save Changes
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Global Configuration */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-500" /> Global Defaults</CardTitle>
                        <CardDescription>Base URL and general settings applied to new tests.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                                placeholder="https://example.com"
                                value={settings.baseUrl}
                                onChange={(e) => updateSetting('baseUrl', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">This URL will be prepended to relative paths.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Authentication Defaults */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-500" /> Default Authentication</CardTitle>
                        <CardDescription>Credentials used when creating new tests.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Default Auth Type</Label>
                            <Select
                                value={settings.defaultAuthType}
                                onValueChange={(val: any) => updateSetting('defaultAuthType', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Authentication</SelectItem>
                                    <SelectItem value="basic">Basic Auth</SelectItem>
                                    <SelectItem value="bearer">Bearer Token</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Default type selected when creating new tests.</p>
                        </div>

                        {/* Basic Auth Credentials - Show when selected */}
                        {settings.defaultAuthType === 'basic' && (
                            <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs font-semibold uppercase text-zinc-500">Basic Auth Credentials</Label>
                                <div className="space-y-2">
                                    <Label className="text-xs">Username</Label>
                                    <Input
                                        value={settings.defaultUsername}
                                        onChange={(e) => updateSetting('defaultUsername', e.target.value)}
                                        placeholder="Enter username"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Password</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            value={settings.defaultPassword}
                                            onChange={(e) => updateSetting('defaultPassword', e.target.value)}
                                            placeholder="Enter password"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4 text-zinc-500" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-zinc-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bearer Token - Show when selected */}
                        {settings.defaultAuthType === 'bearer' && (
                            <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs font-semibold uppercase text-zinc-500">Bearer Token</Label>
                                <div className="space-y-2">
                                    <Label className="text-xs">Token</Label>
                                    <div className="relative">
                                        <Input
                                            type={showToken ? "text" : "password"}
                                            placeholder="e.g. eyJhbGciOiJIUzI1Ni..."
                                            value={settings.defaultToken}
                                            onChange={(e) => updateSetting('defaultToken', e.target.value)}
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                            onClick={() => setShowToken(!showToken)}
                                        >
                                            {showToken ? (
                                                <EyeOff className="h-4 w-4 text-zinc-500" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-zinc-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Performance Defaults */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Performance Defaults</CardTitle>
                        <CardDescription>Default load testing parameters.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Default Timeout (seconds)</Label>
                            <Input
                                type="number"
                                min="1"
                                value={settings.defaultTimeout}
                                onChange={(e) => updateSetting('defaultTimeout', parseInt(e.target.value) || 30)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Concurrency (max 100)</Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={settings.defaultConcurrency}
                                onChange={(e) => updateSetting('defaultConcurrency', Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                            />
                            <p className="text-xs text-muted-foreground">Number of parallel requests (VUs) to send.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
