import { useState, useEffect } from 'react'
import './index.css'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, CartesianGrid } from 'recharts'
import { Settings, Layers, BarChart3, Home, Zap, Search, Bell, ArrowUpRight, ArrowDownRight, AlertCircle, RefreshCw, ChevronRight, ChevronLeft, Code, Activity, Gauge, Copy, X, List, Save, Bookmark, FileCode, CheckCircle, Trash, Play, Lock, Sliders, Eye, EyeOff, FolderOpen, Braces, TrendingUp, Flame, Menu } from 'lucide-react'
import type { SettingsConfig, HistoryEntry, SavedApiConfig, Assertion, AssertionResult, TestResult } from "./types"
import { SettingsView } from "./components/views/SettingsView"
import { SaveConfigDialog } from "./components/views/SaveConfigDialog"
import { SnapshotsView } from "./components/views/SnapshotsView" // Snapshots feature
import { BulkTestView } from "./components/views/BulkTestView"
import { ChainBuilderView } from "./components/views/ChainBuilderView"
import { CodeEditor } from "./components/CodeEditor"
import { ConfigManagerView } from "./components/views/ConfigManagerView"
import { LoadSummaryChart } from "./components/LoadSummaryChart"
import { LatencyHeatmap } from "./components/LatencyHeatmap"
import { ThroughputGauge } from "./components/ThroughputGauge"
import { CodeSnippet } from "./components/CodeSnippet"
import { AssertionBuilder } from "./components/AssertionBuilder"
import parseCurl from 'parse-curl'
import { Toaster } from '@/components/ui/toaster'
import { ToastProvider, useToast } from '@/hooks/use-toast'


function AppContent() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [concurrency, setConcurrency] = useState(10)
  const [iterations, setIterations] = useState(100)
  const [loadPhaseConfig, setLoadPhaseConfig] = useState({
    enablePhasedLoad: false,
    spikeMode: false,
    preset: 'standard',
    warmupDuration: 5,
    warmupVUsPercent: 20,
    rampUpDuration: 10,
    sustainDuration: 30,
    rampDownDuration: 5
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'headers' | 'body' | 'preview'>('headers')
  const pageSize = 15

  // Progress tracking
  const [progress, setProgress] = useState<{ current: number; total: number; startTime: number } | null>(null)
  const abortControllerRef = { current: null as AbortController | null }

  // Test endpoints
  const [testEndpoints, setTestEndpoints] = useState<Array<{ name: string; url: string; method: string; description: string }>>([])
  const [showEndpoints, setShowEndpoints] = useState(false)
  const [showSavedConfigs, setShowSavedConfigs] = useState(false)

  // Main view: tester, discovery, settings, history, analytics
  const [mainView, setMainView] = useState<'tester' | 'discovery' | 'settings' | 'snapshots' | 'bulk' | 'chains' | 'configManager'>('tester')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [discoveredApis, setDiscoveredApis] = useState<Array<{ name: string; path: string; url: string; methods: string[]; auth: string; format: string; category: string; description: string }>>([])
  const [apiFilter, setApiFilter] = useState('')
  const [loadingApis, setLoadingApis] = useState(false)

  // ============ SETTINGS STATE ============
  const [settings, setSettings] = useState<SettingsConfig>({
    baseUrl: window.location.origin,
    defaultAuthType: 'none',
    defaultUsername: '',
    defaultPassword: '',
    defaultToken: '',
    defaultApiKey: '',
    defaultTimeout: 30,
    defaultConcurrency: 10
  })

  // Load settings from backend on mount
  useEffect(() => {
    fetch('/api/perf-test/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSettings(data);
        }
      })
      .catch(err => console.error('Failed to load settings:', err))
  }, [])

  // ============ SNAPSHOTS STATE ============
  const [snapshots, setSnapshots] = useState<HistoryEntry[]>([])

  // Load snapshots from backend on mount
  const loadSnapshots = async () => {
    try {
      const csrfToken = (window as any).drupalSettings?.api_perf_tester?.csrf_token;
      const res = await fetch('/api/perf-test/snapshots', {
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken || '' }
      })
      const data = await res.json()
      // Handle both array and object responses
      const snapshotsArray = Array.isArray(data) ? data : (data.snapshots || [])
      if (snapshotsArray.length > 0) {
        const transformed: HistoryEntry[] = snapshotsArray.map((snap: any) => ({
          id: snap.id.toString(),
          timestamp: new Date(snap.created * 1000).toISOString(), // Convert to ISO string
          url: snap.url || 'Unknown', // Use actual URL from request_config
          method: snap.method || 'GET', // Use actual method from request_config
          status: snap.status_code || 200,
          duration: snap.response_time || 0,
          totalRequests: 1,
          avgTime: (snap.response_time || 0) / 1000, // Convert ms to seconds
          errorCount: snap.status_code >= 400 ? 1 : 0,
          config_id: snap.config_id || '', // For grouping
          snapshot_name: snap.snapshot_name || 'Unnamed' // Version name
        }))
        setSnapshots(transformed)
      } else {
        setSnapshots([]) // Empty array if no snapshots
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err)
      setSnapshots([]) // Set empty on error
    }
  }

  useEffect(() => {
    loadSnapshots()
  }, [])

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return

    try {
      const res = await fetch(`/api/perf-test/snapshots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await loadSnapshots() // Reload snapshots
      }
    } catch (err) {
      console.error('Failed to delete snapshot:', err)
    }
  }

  const handleRunSnapshot = (entry: HistoryEntry) => {
    setUrl(entry.url)
    setMethod(entry.method)
    // Switch to tester view
    setMainView('tester')
  }

  // Snapshot detail view
  const [showSnapshotDetail, setShowSnapshotDetail] = useState(false)
  const [snapshotDetail, setSnapshotDetail] = useState<any>(null)

  const handleViewSnapshotDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/perf-test/snapshots/${id}`)
      const data = await res.json()
      setSnapshotDetail(data)
      setShowSnapshotDetail(true)
    } catch (err) {
      console.error('Failed to load snapshot detail:', err)
      toast({
        title: 'Error',
        description: 'Error loading snapshot details',
        type: 'error'
      })
    }
  }

  // Snapshot comparison
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonData, setComparisonData] = useState<any>(null)

  const handleCompareSnapshots = async (id1: string, id2: string) => {
    try {
      const res = await fetch(`/api/perf-test/snapshots/compare/${id1}/${id2}`)
      const data = await res.json()
      setComparisonData(data)
      setShowComparison(true)
    } catch (err) {
      console.error('Failed to compare snapshots:', err)
      toast({
        title: 'Error',
        description: 'Error comparing snapshots',
        type: 'error'
      })
    }
  }


  // ============ SAVED API CONFIGS STATE ============
  const [savedConfigs, setSavedConfigs] = useState<SavedApiConfig[]>([])
  const [showSaveConfigModal, setShowSaveConfigModal] = useState(false)
  const [configLoadMode, setConfigLoadMode] = useState<'all' | 'auth' | 'params'>('all')

  // ============ ASSERTIONS STATE ============
  const [assertions, setAssertions] = useState<Assertion[]>([])

  // ============ ENVIRONMENTS STATE ============
  interface EnvProfile { id: string; name: string; base_url: string; color?: string; is_active?: boolean; variables?: Array<{ key: string; value: string }> }
  const [environments, setEnvironments] = useState<EnvProfile[]>([])
  const [activeEnvironment, setActiveEnvironment] = useState<EnvProfile | null>(null)

  // Load environments function (reusable)
  const loadEnvironments = () => {
    fetch('/api/perf-test/environments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEnvironments(data)
          // Set active environment if marked
          const active = data.find((e: EnvProfile) => e.is_active)
          if (active) setActiveEnvironment(active)
        }
      })
      .catch(err => console.error('Failed to load environments:', err))
  }

  useEffect(() => {
    loadEnvironments()
  }, [])

  // Function to replace URL with environment base
  const applyEnvironmentToUrl = (inputUrl: string): string => {
    if (!activeEnvironment || !inputUrl) return inputUrl
    // If URL is relative, prepend the active environment base URL
    if (inputUrl.startsWith('/')) {
      return activeEnvironment.base_url.replace(/\/$/, '') + inputUrl
    }
    return inputUrl
  }

  // Function to replace {{VAR_NAME}} with environment variable values
  const replaceVariables = (input: string): string => {
    if (!activeEnvironment?.variables || !input) return input
    let result = input
    // Match {{VAR_NAME}} pattern
    const regex = /\{\{([^}]+)\}\}/g
    result = result.replace(regex, (match, varName) => {
      const variable = activeEnvironment.variables?.find(v => v.key === varName.trim())
      return variable ? variable.value : match // Keep original if not found
    })
    return result
  }

  // Switch active environment
  const handleSwitchEnvironment = async (envId: string) => {
    const env = environments.find(e => e.id === envId)
    if (!env) return
    try {
      await fetch('/api/perf-test/environments/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: envId })
      })
      setActiveEnvironment(env)
      toast({ title: `✓ Switched to ${env.name}` })
    } catch (e) {
      console.error('Failed to switch environment')
    }
  }

  // Fetch presets from backend
  useEffect(() => {
    fetch('/api/perf-test/presets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedConfigs(data.map((item: any) => ({
            id: item.id,
            name: item.name,
            url: item.url,
            method: item.method,
            headers: item.config.headers,
            queryParams: item.config.queryParams,
            body: item.config.body,
            bodyType: item.config.bodyType,
            authType: item.config.authType,
            // Include all auth credentials
            authUsername: item.config.authUsername,
            authPassword: item.config.authPassword,
            authToken: item.config.authToken,
            authKeyName: item.config.authKeyName,
            authKeyValue: item.config.authKeyValue,
            assertions: item.assertions || [],
            created: item.created
          })))
        }
      })
      .catch(err => console.error('Failed to load presets:', err))
  }, [])

  // Load default auth from settings on mount
  // TEMPORARILY DISABLED - Settings endpoint returns 404
  // TODO: Fix when backend settings endpoint is properly configured
  /*
  useEffect(() => {
    fetch('/api/perf-test/settings')
      .then(res => res.json())
      .then(data => {
        const settings = data.default_auth || {};
        
        // Apply default auth if it's set in settings
        if (settings.type && settings.type !== 'none') {
          setAuthType(settings.type);
          
          if (settings.type === 'basic') {
            if (settings.basic_user) setAuthUsername(settings.basic_user);
            if (settings.basic_pass) setAuthPassword(settings.basic_pass);
          } else if (settings.type === 'bearer') {
            if (settings.bearer_token) setAuthToken(settings.bearer_token);
          } else if (settings.type === 'apikey') {
            if (settings.apikey_key) setAuthKeyName(settings.apikey_key);
            if (settings.apikey_value) setAuthKeyValue(settings.apikey_value);
          }
        }
      })
      .catch(err => console.error('Failed to load settings:', err))
  }, [])
  */

  const handleSaveConfig = async (name: string, groupId: string = 'ungrouped', action: 'create' | 'update' = 'create') => {
    const configData = {
      headers: requestHeaders,
      queryParams,
      body: requestBody,
      bodyType,
      authType,
      authUsername,
      authPassword,
      authToken,
      authKeyName,
      authKeyValue
    }

    // Save to Backend
    try {
      const isUpdate = action === 'update' && currentConfigId;
      const endpoint = isUpdate ? `/api/perf-test/preset/${currentConfigId}` : '/api/perf-test/presets';
      const payload = {
        name,
        url,
        method,
        config: configData,
        group_id: groupId
      };
      const response = await fetch(endpoint, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const savedPreset = await response.json();
      const configId = savedPreset.id || `config_${Date.now()}`;

      // Save assertions for this config
      if (assertions.length > 0) {
        await fetch('/api/perf-test/assertions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: configId,
            assertions
          })
        });
      }

      toast({
        title: 'Saved',
        description: 'Preset and assertions saved!',
        type: 'success'
      });

      // Reload presets
      const newConfig: SavedApiConfig = {
        id: configId,
        name,
        url,
        method,
        headers: requestHeaders,
        queryParams,
        body: requestBody,
        bodyType,
        authType,
        authUsername,
        authPassword,
        authToken,
        authKeyName,
        authKeyValue
      }
      setSavedConfigs([...savedConfigs, newConfig])
      // Track this config ID for snapshots and assertions
      setCurrentConfigId(configId)
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to save preset to backend',
        type: 'error'
      });
    }
  }

  // Save snapshot handler
  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a snapshot name',
        type: 'error'
      });
      return;
    }

    if (!result || !result.success) {
      toast({
        title: 'No Results',
        description: 'No test results to save',
        type: 'warning'
      });
      return;
    }

    try {
      // Use existing config ID or generate a unique one
      const configId = currentConfigId || `snapshot_${Date.now()}`;

      const response = await fetch('/api/perf-test/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: configId,
          snapshot_name: snapshotName,
          test_results: result,
          request_config: {
            url, method,
            headers: requestHeaders,
            queryParams,
            body: requestBody,
            bodyType,
            authType,
            authUsername,
            authPassword,
            authToken,
            authKeyName,
            authKeyValue
          },
          notes: snapshotNotes
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Snapshot Saved',
          description: `Snapshot "${snapshotName}" saved successfully!`,
          type: 'success'
        });
        setShowSnapshotModal(false);
        setSnapshotName('');
        setSnapshotNotes('');
        loadSnapshots(); // Reload list
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save snapshot: ' + (data.error || 'Unknown error'),
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Error saving snapshot:', err);
      toast({
        title: 'Error',
        description: 'Error saving snapshot',
        type: 'error'
      });
    }
  }

  // Delete preset
  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the config when clicking delete
    // if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
      const res = await fetch(`/api/perf-test/presets/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': (window as any).drupalSettings?.api_perf_tester?.csrf_token || ''
        }
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Deleted',
          description: 'Preset deleted successfully',
          type: 'success'
        });

        // Refresh presets
        fetch('/api/perf-test/presets')
          .then(res => res.json())
          .then(data => data && setSavedConfigs(data))
          .catch(console.error);

      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete preset',
          type: 'error'
        });
      }
    } catch (err) {
      console.error('Failed to delete preset:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete preset',
        type: 'error'
      });
    }
  }

  // cURL import
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlInput, setCurlInput] = useState('');

  // Reset handler
  const handleReset = () => {
    if (!confirm('Are you sure you want to reset the configuration?')) return;

    setUrl('')
    setMethod('GET')
    setRequestHeaders([{ key: '', value: '' }])
    setQueryParams([{ key: '', value: '' }])
    setRequestBody('')
    setBodyType('none')
    setAuthType('none')
    setAuthUsername('')
    setAuthPassword('')
    setAuthToken('')
    setAuthKeyName('')
    setAuthKeyValue('')
    setConcurrency(10)
    setIterations(100)
    setLoadPhaseConfig({
      enablePhasedLoad: false,
      spikeMode: false,
      preset: 'standard',
      warmupDuration: 5,
      warmupVUsPercent: 20,
      rampUpDuration: 10,
      sustainDuration: 30,
      rampDownDuration: 5
    })
    setResult(null)
    setError(null)
    setCurrentConfigId('')
    toast({
      title: 'Reset',
      description: 'Configuration reset to defaults.',
      type: 'success'
    })
  }

  const handleImportCurl = () => {
    try {
      // @ts-ignore - parse-curl doesn't have types
      const parsed = parseCurl(curlInput);

      if (parsed && parsed.url) {
        // Extract query parameters from URL
        let baseUrl = parsed.url;
        const queryParams: { key: string; value: string }[] = [];

        if (parsed.url.includes('?')) {
          const [base, queryString] = parsed.url.split('?');
          baseUrl = base;

          // Parse query parameters
          const params = new URLSearchParams(queryString);
          params.forEach((value, key) => {
            queryParams.push({ key, value });
          });
        }

        setUrl(baseUrl);
        setQueryParams(queryParams.length > 0 ? queryParams : [{ key: '', value: '' }]);
        setMethod(parsed.method || 'GET');

        // Convert headers object to array format
        const headersArray: { key: string; value: string }[] = [];
        if (parsed.header) {
          Object.entries(parsed.header).forEach(([key, value]) => {
            headersArray.push({ key, value: String(value) });
          });
        }
        setRequestHeaders(headersArray.length > 0 ? headersArray : [{ key: '', value: '' }]);

        // Set body
        setRequestBody(parsed.body || '');

        // Determine body type from Content-Type
        const contentType = parsed.header?.['Content-Type'] || parsed.header?.['content-type'] || '';
        let bodyType: 'none' | 'json' | 'form' | 'raw' = 'none';
        if (parsed.body) {
          if (contentType.includes('application/json')) {
            bodyType = 'json';
          } else if (contentType.includes('form')) {
            bodyType = 'form';
          } else {
            bodyType = 'raw';
          }
        }
        setBodyType(bodyType);

        setShowCurlImport(false);
        setCurlInput('');
        toast({
          title: 'cURL Imported',
          description: 'cURL command parsed and applied successfully.',
          type: 'success'
        });
      } else {
        toast({
          title: 'Import Failed',
          description: 'Could not parse the cURL command. Please check the syntax.',
          type: 'error'
        });
      }
    } catch (e) {
      console.error('Failed to parse cURL:', e);
      toast({
        title: 'Import Failed',
        description: `Failed to parse cURL command: ${(e as Error).message}`,
        type: 'error'
      });
    }
  };
  // Postman-style tabs state
  const [requestTab, setRequestTab] = useState<'params' | 'authorization' | 'headers' | 'body' | 'settings' | 'assertions'>('params')
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])
  const [requestHeaders, setRequestHeaders] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }])
  const [authType, setAuthType] = useState<'none' | 'basic' | 'bearer' | 'apikey'>('none')
  const [bodyType, setBodyType] = useState<'none' | 'json' | 'form' | 'raw'>('none')
  const [requestBody, setRequestBody] = useState('')

  // Auth credentials
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [authKeyName, setAuthKeyName] = useState('')
  const [authKeyValue, setAuthKeyValue] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [showAuthToken, setShowAuthToken] = useState(false)

  // Snapshot state
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotNotes, setSnapshotNotes] = useState('')
  const [currentConfigId, setCurrentConfigId] = useState('')
  const [currentConfigName, setCurrentConfigName] = useState('')

  // Apply default auth from settings when needed (removed auto-application)
  // User can manually click "Use Default Auth" button instead

  // Fetch test endpoints on mount
  const fetchTestEndpoints = async () => {
    try {
      const res = await fetch('/api/test')
      const data = await res.json()
      if (data.endpoints) setTestEndpoints(data.endpoints)
    } catch (e) { console.error('Failed to fetch test endpoints') }
  }

  // Fetch all discovered APIs from the system
  const fetchDiscoveredApis = async () => {
    setLoadingApis(true)
    try {
      const csrfToken = (window as any).drupalSettings?.api_perf_tester?.csrf_token;
      const res = await fetch('/api/discovery', {
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken || '' }
      })
      const data = await res.json()
      // Backend now returns APIs in data.apis array with proper structure
      if (data.apis) {
        // Add required 'auth' and 'format' properties to match the type
        const apisWithDefaults = data.apis.map((api: any) => ({
          ...api,
          auth: api.auth || 'cookie',
          format: api.format || 'json',
          category: 'Enabled REST Resources' // Use single category from backend
        }))
        setDiscoveredApis(apisWithDefaults)
      }
    } catch (e) { console.error('Failed to fetch discovered APIs') }
    finally { setLoadingApis(false) }
  }

  // Cancel test
  const cancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setLoading(false)
      setProgress(null)
      setError('Test cancelled by user')
    }
  }

  // Load test endpoints on mount
  useEffect(() => {
    fetchTestEndpoints()
  }, [])

  const runTest = async () => {
    if (!url) {
      setError('Please enter a valid endpoint URL')
      return
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)
    setResult(null)

    // Calculate actual total requests: VUs * iterations per VU
    const totalRequests = concurrency * iterations
    setProgress({ current: 0, total: totalRequests, startTime: Date.now() })

    let progressInterval: any; // Declare outside try to be accessible in finally

    try {
      const csrfToken = (window as any).drupalSettings?.api_perf_tester?.csrf_token;

      // Simulate progress since backend is synchronous (no streaming)
      // Calculate estimated duration
      let estimatedDuration = 10; // Default 10s for standard
      if (loadPhaseConfig.enablePhasedLoad) {
        estimatedDuration =
          (loadPhaseConfig.warmupDuration || 0) +
          (loadPhaseConfig.rampUpDuration || 0) +
          (loadPhaseConfig.sustainDuration || 0) +
          (loadPhaseConfig.rampDownDuration || 0);
      } else {
        // Estimate for standard test: 100ms per request assumption?
        // totalRequests / concurrency * 0.1s
        estimatedDuration = Math.max(5, (totalRequests / Math.max(concurrency, 1)) * 0.1);
      }

      // Update progress every 100ms
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (!prev) return null;
          // Logic: Increment based on elapsed time vs estimated duration
          const elapsed = (Date.now() - prev.startTime) / 1000;
          let percent = (elapsed / estimatedDuration);
          if (percent > 0.95) percent = 0.95; // Cap at 95% until done

          return {
            ...prev,
            current: Math.floor(prev.total * percent)
          };
        });
      }, 100);

      // Store interval ID to clear it later (we can't easily access the interval ID in finally block if defined here, 
      // but we can use a ref or just modify structure. 
      // Simpler: Wrap the fetch in a try/finally that has access to the interval)


      // Build auth config
      let authConfig: any = { type: authType };
      if (authType === 'basic') {
        authConfig.username = replaceVariables(authUsername);
        authConfig.password = replaceVariables(authPassword);
      } else if (authType === 'bearer') {
        authConfig.token = replaceVariables(authToken);
      } else if (authType === 'apikey') {
        authConfig.keyName = replaceVariables(authKeyName);
        authConfig.keyValue = replaceVariables(authKeyValue);
      }

      // Build URL with query params + apply environment base URL + variable replacement
      const validQueryParams = queryParams.filter(p => p.key.trim());
      let testUrl = applyEnvironmentToUrl(replaceVariables(url));
      if (validQueryParams.length > 0) {
        const queryString = validQueryParams.map(p => `${encodeURIComponent(replaceVariables(p.key))}=${encodeURIComponent(replaceVariables(p.value))}`).join('&');
        testUrl = testUrl.includes('?') ? `${testUrl}&${queryString}` : `${testUrl}?${queryString}`;
      }

      // Build headers object with variable replacement
      const headersObj: Record<string, string> = {};
      requestHeaders.filter(h => h.key.trim()).forEach(h => {
        headersObj[replaceVariables(h.key)] = replaceVariables(h.value);
      });

      // Apply variable replacement to body
      const processedBody = replaceVariables(requestBody || '');

      const res = await fetch('/api/perf-test/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ url: testUrl, method, concurrency, iterations, bypassCache: false, timeout: 30, auth: authConfig, assertions, headers: headersObj, body: processedBody, loadPhaseConfig }),
        signal: abortControllerRef.current.signal
      })

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }

      // Set progress to actual total after completion
      setProgress(prev => prev ? { ...prev, current: totalRequests } : null)

      if (data.error) {
        setError(data.error)
      } else if (!data.summary) {
        setError('Received invalid response format from server')
        console.error('Invalid response:', data)
      } else {
        setResult(data)

        // Save to history
        // History saving removed - using backend snapshots instead
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Test cancelled by user')
      } else {
        setError(err instanceof Error ? err.message : 'Request failed')
      }
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setLoading(false)
      setProgress(null)
      abortControllerRef.current = null
    }
  }

  const chartData = result?.requests.map((req, i) => ({
    time: `${i + 1}`,
    responseTime: req.totalTime,
    ttfb: req.ttfb,
    rps: result.stats.rps,
  })) || []

  // Metric Card Component
  const MetricCard = ({ title, value, subtext, trend, icon: Icon, trendValue }: any) => (
    <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit text-zinc-600 dark:text-zinc-400">
              <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</h3>
            </div>
            {trend && (
              <Badge variant={trend === 'up' ? 'default' : 'destructive'} className={`bg-${trend === 'up' ? 'emerald' : 'red'}-100 dark:bg-${trend === 'up' ? 'emerald' : 'red'}-900/10 text-${trend === 'up' ? 'emerald' : 'red'}-700 dark:text-${trend === 'up' ? 'emerald' : 'red'}-400 hover:bg-opacity-80 border-0`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {trendValue}
              </Badge>
            )}
          </div>
          {subtext && <p className="text-xs text-zinc-500 mt-4">{subtext}</p>}
        </div >
      </CardContent >
    </Card >
  )

  const calculateApdex = (stats: TestResult['stats']) => {
    const t = 500; // threshold ms
    if (stats.mean < t) return 1.0;
    if (stats.mean < t * 4) return 0.85;
    return 0.5;
  }

  // Handler for loading config from Bulk Runner
  const loadConfigForDebugging = (config: SavedApiConfig) => {
    setUrl(config.url)
    setMethod(config.method)
    setRequestHeaders(config.headers)
    setQueryParams(config.queryParams)
    setRequestBody(config.body)
    setBodyType((config.bodyType as 'none' | 'json' | 'form' | 'raw') || 'none')
    setAuthType(config.authType)
    setAuthUsername(config.authUsername || '')
    setAuthPassword(config.authPassword || '')
    setAuthToken(config.authToken || '')
    setAuthKeyName(config.authKeyName || '')
    setAuthKeyValue(config.authKeyValue || '')
    setAssertions(config.assertions || [])

    setMainView('tester')

    toast({
      title: "Configuration Loaded",
      description: `Loaded "${config.name}" into Tester view.`,
    })
  }

  // handleExportHistory removed with history feature


  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950/50 dark:text-zinc-100 font-sans">

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 1. Sidebar */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto
        w-72 h-screen overflow-y-auto border-r border-dashed border-zinc-200 dark:border-zinc-800 
        bg-white dark:bg-zinc-950 p-6 flex flex-col justify-between shrink-0
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">PerfTester</span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase px-3 mb-2 block tracking-wider">Dashboard</Label>
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'tester' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('tester')}
            >
              <Zap className="w-4 h-4 mr-3" /> Load Tester
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'discovery' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => { setMainView('discovery'); fetchDiscoveredApis(); }}
            >
              <List className="w-4 h-4 mr-3" /> API Discovery
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'bulk' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('bulk')}
            >
              <Play className="w-4 h-4 mr-3" /> Bulk Runner
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'chains' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('chains')}
            >
              <Code className="w-4 h-4 mr-3" /> Request Chains
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'configManager' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('configManager')}
            >
              <FolderOpen className="w-4 h-4 mr-3" /> Config Manager
            </Button>
            {/* Analytics removed - Snapshots feature kept */}
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'snapshots' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('snapshots')}
            >
              <Layers className="w-4 h-4 mr-3" /> Snapshots
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start px-3 ${mainView === 'settings' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              onClick={() => setMainView('settings')}
            >
              <Settings className="w-4 h-4 mr-3" /> Settings
            </Button>
          </div>
        </div>

      </aside>

      {/* 2. Main Area */}
      <main className="flex-1 h-screen flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Home className="w-4 h-4 hidden sm:block" />
            <ChevronRight className="w-4 h-4 text-zinc-300 hidden sm:block" />
            <span className="hidden sm:inline">Performance</span>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
              {mainView === 'tester' && 'Load Tester'}
              {mainView === 'discovery' && 'API Discovery'}
              {mainView === 'bulk' && 'Bulk Runner'}
              {mainView === 'chains' && 'Request Chains'}
              {mainView === 'configManager' && 'Config Manager'}
              {mainView === 'snapshots' && 'Snapshots'}
              {mainView === 'settings' && 'Settings'}
            </span>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="relative w-40 lg:w-64 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input className="w-full h-9 pl-9 pr-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border-none text-sm focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-400" placeholder="Search..." />
            </div>
            <Button variant="ghost" size="icon" className="text-zinc-500"><Bell className="w-5 h-5" /></Button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-200 to-indigo-200 border-2 border-white dark:border-zinc-950 ring-1 ring-zinc-200 dark:ring-zinc-800" />
          </div>
        </header>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-32">

          {/* API Discovery View */}
          {mainView === 'discovery' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">API Discovery</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Browse all APIs in your Drupal system and run performance tests.</p>
                </div>
                <Button onClick={fetchDiscoveredApis} variant="outline" className="h-10">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingApis ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {/* Search/Filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  className="w-full h-10 pl-10 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                  placeholder="Filter APIs by name, path, or category..."
                  value={apiFilter}
                  onChange={e => setApiFilter(e.target.value)}
                />
              </div>

              {/* API List */}
              {loadingApis ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group by category */}
                  {Array.from(new Set(discoveredApis.map(a => a.category))).map(category => {
                    const categoryApis = discoveredApis.filter(a =>
                      a.category === category &&
                      (apiFilter === '' ||
                        (a.name || '').toLowerCase().includes(apiFilter.toLowerCase()) ||
                        (a.path || '').toLowerCase().includes(apiFilter.toLowerCase()) ||
                        (a.category || '').toLowerCase().includes(apiFilter.toLowerCase()) ||
                        (a.description || '').toLowerCase().includes(apiFilter.toLowerCase()))
                    )
                    if (categoryApis.length === 0) return null
                    return (
                      <Card key={category} className="overflow-hidden border-zinc-200 dark:border-zinc-800">
                        <CardHeader className="py-3 px-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            {category}
                            <Badge variant="outline" className="ml-2 text-xs">{categoryApis.length}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {categoryApis.map((api, i) => (
                              <div key={i} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      {api.methods.map(m => (
                                        <Badge key={m} variant="outline" className={`text-xs ${m === 'GET' ? 'text-emerald-600 border-emerald-300' :
                                          m === 'POST' ? 'text-amber-600 border-amber-300' :
                                            m === 'PUT' ? 'text-blue-600 border-blue-300' :
                                              m === 'DELETE' ? 'text-red-600 border-red-300' :
                                                'text-purple-600 border-purple-300'
                                          }`}>
                                          {m}
                                        </Badge>
                                      ))}
                                      <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300 truncate">{api.path}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 truncate">{api.description}</p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                      <span>Auth: {api.auth}</span>
                                      <span>Format: {api.format}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8"
                                      onClick={() => navigator.clipboard.writeText(api.url)}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                                      onClick={() => {
                                        // Use global base URL if set, otherwise use discovered URL
                                        let finalUrl = api.url;
                                        if (settings.baseUrl && settings.baseUrl !== window.location.origin) {

                                          // If plain URL string manipulation is safer for preserving {id}
                                          const apiPath = api.path; // raw path e.g. /rest/test/{id}

                                          // Remove trailing slash from base and leading from path to join cleanly
                                          const cleanBase = settings.baseUrl.replace(/\/$/, '');
                                          const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;

                                          finalUrl = `${cleanBase}${cleanPath}`;
                                        }
                                        setUrl(finalUrl);
                                        setMethod(api.methods[0] || 'GET');
                                        setMainView('tester');
                                      }}
                                    >
                                      <Zap className="w-3 h-3 mr-1" /> Run Test
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                  {discoveredApis.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                      <List className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                      <p>No APIs discovered. Click Refresh to scan for APIs.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Load Tester View */}
          {mainView === 'tester' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Load Test Configuration</h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure and execute your API performance benchmarks.</p>
                </div>
                <div className="flex gap-3 items-center">
                  {/* Environment Selector */}
                  {environments.length > 0 && (
                    <Select value={activeEnvironment?.id || ''} onValueChange={handleSwitchEnvironment}>
                      <SelectTrigger className="w-40 h-10 border-zinc-300">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${activeEnvironment?.color === 'green' ? 'bg-emerald-500' : activeEnvironment?.color === 'yellow' ? 'bg-amber-500' : activeEnvironment?.color === 'red' ? 'bg-red-500' : activeEnvironment?.color === 'blue' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                          <span className="truncate">{activeEnvironment?.name || 'Select Env'}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-white border shadow-lg">
                        {environments.map(env => (
                          <SelectItem key={env.id} value={env.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${env.color === 'green' ? 'bg-emerald-500' : env.color === 'yellow' ? 'bg-amber-500' : env.color === 'red' ? 'bg-red-500' : env.color === 'blue' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                              {env.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" className="h-10" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" /> Reset</Button>
                  <Button onClick={runTest} disabled={loading} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
                    {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    {loading ? 'Testing...' : 'Start Load Test'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full md:w-auto border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => setShowCurlImport(true)}
                  >
                    <FileCode className="w-4 h-4 mr-2" />
                    Import cURL
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full md:w-auto border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => setShowSaveConfigModal(true)}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Preset
                  </Button>
                </div>
              </div>

              {/* Postman-style Request Builder - Light Theme */}
              <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                {/* Request Bar */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    {/* Method Dropdown - Simple styling */}
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className={`w-28 h-10 font-semibold text-sm rounded-md border border-zinc-300 dark:border-zinc-600 ${method === 'GET' ? 'text-emerald-600' :
                        method === 'POST' ? 'text-amber-600' :
                          method === 'PUT' ? 'text-blue-600' :
                            method === 'DELETE' ? 'text-red-600' :
                              method === 'PATCH' ? 'text-purple-600' :
                                'text-zinc-600'
                        }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg">
                        <SelectItem value="GET" className="text-emerald-600 font-semibold">GET</SelectItem>
                        <SelectItem value="POST" className="text-amber-600 font-semibold">POST</SelectItem>
                        <SelectItem value="PUT" className="text-blue-600 font-semibold">PUT</SelectItem>
                        <SelectItem value="DELETE" className="text-red-600 font-semibold">DELETE</SelectItem>
                        <SelectItem value="PATCH" className="text-purple-600 font-semibold">PATCH</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* URL Input */}
                    <div className="flex-1 relative">
                      <input
                        className="w-full h-10 px-4 pr-10 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 font-mono text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter request URL or select from test endpoints"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                      />
                      {/* Test Endpoints and Saved Configs Dropdowns */}
                      {(testEndpoints.length > 0 || savedConfigs.length > 0) && (
                        <div className="absolute right-0 top-0 h-10 flex gap-1">
                          {/* Saved Configs Dropdown */}
                          {savedConfigs.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => { setShowSavedConfigs(!showSavedConfigs); setShowEndpoints(false); }}
                                className="h-10 px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                title="Saved Configurations"
                              >
                                <Bookmark className="w-4 h-4" />
                              </button>
                              {showSavedConfigs && (
                                <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-[30rem] overflow-y-auto flex flex-col">
                                  <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                                    <div className="flex justify-between items-center mb-3">
                                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <Bookmark className="w-4 h-4 text-indigo-500" />
                                        Saved Presets
                                      </span>
                                      <button onClick={() => setShowSavedConfigs(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {/* Load Mode Selector */}
                                    <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg">
                                      <button
                                        onClick={() => setConfigLoadMode('all')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${configLoadMode === 'all'
                                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                          }`}
                                        title="Load Everything (URL, Auth, Params, Body)"
                                      >
                                        <RefreshCw className="w-3 h-3" /> All
                                      </button>
                                      <button
                                        onClick={() => setConfigLoadMode('auth')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${configLoadMode === 'auth'
                                          ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                          }`}
                                        title="Load Authentication Only (Keep current URL)"
                                      >
                                        <Lock className="w-3 h-3" /> Auth
                                      </button>
                                      <button
                                        onClick={() => setConfigLoadMode('params')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${configLoadMode === 'params'
                                          ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm'
                                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                          }`}
                                        title="Load Params Only (Keep current URL)"
                                      >
                                        <Sliders className="w-3 h-3" /> Params
                                      </button>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 mt-2 px-1 text-center">
                                      {configLoadMode === 'all' && "Replaces URL, Method, Auth, Headers, Body & Params"}
                                      {configLoadMode === 'auth' && "Keeps current URL. Updates Auth credentials only."}
                                      {configLoadMode === 'params' && "Keeps current URL. Updates Query Parameters only."}
                                    </div>
                                  </div>

                                  <div className="flex-1 overflow-y-auto">
                                    {savedConfigs.filter((config: any) => {
                                      // If we're just loading auth or params, we don't care about the URL/Method matching
                                      if (configLoadMode !== 'all') return true;

                                      if (!url) return true;

                                      // Filter by method first (POST vs GET are different)
                                      if (config.method !== method) return false;

                                      const currentUrl = url.split('?')[0];
                                      const configUrl = config.url.split('?')[0];

                                      // FORWARD matching: If current URL has path params like {id}, match the pattern
                                      if (currentUrl.includes('{')) {
                                        const pattern = currentUrl.replace(/\{[^}]+\}/g, '[^/]+');
                                        const regex = new RegExp(`^${pattern}$`);
                                        return regex.test(configUrl);
                                      }

                                      // REVERSE matching: If config URL has {id}, check if current URL matches that pattern
                                      if (configUrl.includes('{')) {
                                        const pattern = configUrl.replace(/\{[^}]+\}/g, '[^/]+');
                                        const regex = new RegExp(`^${pattern}$`);
                                        if (regex.test(currentUrl)) return true;
                                      }

                                      // Standard matching: URL substring match
                                      return configUrl.includes(currentUrl) || currentUrl.includes(configUrl);
                                    }).map((config: any, i: number) => (
                                      <div key={i} className="flex items-center w-full hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                                        <button
                                          onClick={() => {
                                            if (configLoadMode === 'all') {
                                              // FULL LOAD
                                              setUrl(config.url);
                                              setMethod(config.method || 'GET');

                                              if (config.headers) setRequestHeaders(config.headers);
                                              if (config.queryParams) setQueryParams(config.queryParams);
                                              setRequestBody(config.body || '');
                                              setBodyType(config.bodyType || 'none');

                                              setAuthType(config.authType || 'none');
                                              setAuthUsername(config.authUsername || '');
                                              setAuthPassword(config.authPassword || '');
                                              setAuthToken(config.authToken || '');
                                              setAuthKeyName(config.authKeyName || '');
                                              setAuthKeyValue(config.authKeyValue || '');
                                              setAssertions(config.assertions || []);
                                              setCurrentConfigId(config.id);
                                              setCurrentConfigName(config.name);

                                              toast({ title: 'Config Loaded', description: `Full configuration "${config.name}" loaded.` });

                                            } else if (configLoadMode === 'auth') {
                                              // AUTH ONLY
                                              setAuthType(config.authType || 'none');
                                              setAuthUsername(config.authUsername || '');
                                              setAuthPassword(config.authPassword || '');
                                              setAuthToken(config.authToken || '');
                                              setAuthKeyName(config.authKeyName || '');
                                              setAuthKeyValue(config.authKeyValue || '');

                                              // Switch tab to show user
                                              setRequestTab('authorization');
                                              toast({ title: 'Auth Applied', description: `Applied authentication from "${config.name}".` });

                                            } else if (configLoadMode === 'params') {
                                              // PARAMS ONLY
                                              if (config.queryParams) {
                                                setQueryParams(config.queryParams);
                                                setRequestTab('params');
                                                toast({ title: 'Params Applied', description: `Applied query params from "${config.name}".` });
                                              } else {
                                                toast({ title: 'No Params', description: `Preset "${config.name}" has no query parameters.`, type: 'warning' });
                                              }
                                            }

                                            setShowSavedConfigs(false);
                                          }}
                                          className="flex-1 text-left px-4 py-3"
                                        >
                                          <div className="flex items-center justify-between pointer-events-none">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className={`text-xs ${config.method === 'GET' ? 'text-emerald-600' : config.method === 'POST' ? 'text-amber-600' : 'text-zinc-600'}`}>
                                                {config.method || 'GET'}
                                              </Badge>
                                              <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{config.name}</span>
                                            </div>
                                            <span className="text-xs text-zinc-400">
                                              {new Date(config.created * 1000).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p className="text-xs text-zinc-500 mt-1 truncate pointer-events-none">{config.url}</p>
                                          {config.config?.body && (
                                            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">cURL Command:</span>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Build headers array, add Content-Type if body exists
                                                    const headers = config.config.headers?.filter((h: any) => h.key) || [];
                                                    const hasContentType = headers.some((h: any) => h.key.toLowerCase() === 'content-type');

                                                    let headerStr = headers.map((h: any) => ` \\\n  -H "${h.key}: ${h.value}"`).join('');

                                                    // Add Content-Type for JSON if not already present
                                                    if (config.config.body && !hasContentType) {
                                                      const bodyType = config.config.bodyType || 'json';
                                                      if (bodyType === 'json') {
                                                        headerStr += ` \\\n  -H "Content-Type: application/json"`;
                                                      }
                                                    }

                                                    const curlCommand = `curl -X ${config.method} "${config.url}"${headerStr}${config.config.body ? ` \\\n  -d '${config.config.body}'` : ''}`;
                                                    navigator.clipboard.writeText(curlCommand);
                                                    toast({
                                                      title: 'Copied',
                                                      description: 'cURL copied to clipboard!',
                                                      type: 'success'
                                                    });
                                                  }}
                                                  className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                                                >
                                                  Copy
                                                </button>
                                              </div>
                                              <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 p-2 rounded overflow-x-auto max-h-20">
                                                {(() => {
                                                  const headers = config.config.headers?.filter((h: any) => h.key) || [];
                                                  const hasContentType = headers.some((h: any) => h.key.toLowerCase() === 'content-type');

                                                  let headerStr = headers.map((h: any) => ` \\\n  -H "${h.key}: ${h.value}"`).join('');

                                                  if (config.config.body && !hasContentType) {
                                                    const bodyType = config.config.bodyType || 'json';
                                                    if (bodyType === 'json') {
                                                      headerStr += ` \\\n  -H "Content-Type: application/json"`;
                                                    }
                                                  }

                                                  const bodyPreview = config.config.body?.length > 50
                                                    ? config.config.body.substring(0, 50) + '...'
                                                    : config.config.body;

                                                  return `curl -X ${config.method} "${config.url}"${headerStr}${config.config.body ? ` \\\n  -d '${bodyPreview}'` : ''}`;
                                                })()}
                                              </pre>
                                            </div>
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => handleDeletePreset(config.id, e)}
                                          className="p-2 mr-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                                          title="Delete Preset"
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Test Endpoints Dropdown */}
                          {testEndpoints.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => { setShowEndpoints(!showEndpoints); setShowSavedConfigs(false); }}
                                className="h-10 px-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                title="Select from test endpoints"
                              >
                                <List className="w-4 h-4" />
                              </button>
                              {showEndpoints && (
                                <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                  <div className="p-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Test Endpoints</span>
                                    <button onClick={() => setShowEndpoints(false)} className="text-zinc-400 hover:text-zinc-600">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {testEndpoints.map((ep, i) => (
                                    <button
                                      key={i}
                                      onClick={() => { setUrl(ep.url); setMethod(ep.method === 'ANY' ? 'GET' : ep.method); setShowEndpoints(false); }}
                                      className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`text-xs ${ep.method === 'GET' ? 'text-emerald-600' : ep.method === 'POST' ? 'text-amber-600' : 'text-zinc-600'}`}>
                                          {ep.method}
                                        </Badge>
                                        <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{ep.name}</span>
                                      </div>
                                      <p className="text-xs text-zinc-500 mt-1">{ep.description}</p>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* cURL Copy Button */}
                    <Button
                      variant="outline"
                      className="h-10 px-3 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                      onClick={() => {
                        // Build URL with query params + apply variables
                        const validParams = queryParams.filter(p => p.key.trim());
                        let curlUrl = applyEnvironmentToUrl(replaceVariables(url));
                        if (validParams.length > 0) {
                          const queryString = validParams.map(p => `${encodeURIComponent(replaceVariables(p.key))}=${encodeURIComponent(replaceVariables(p.value))}`).join('&');
                          curlUrl = curlUrl.includes('?') ? `${curlUrl}&${queryString}` : `${curlUrl}?${queryString}`;
                        }
                        // Build auth string based on auth type (with variable replacement)
                        let authStr = '';
                        if (authType === 'basic' && authUsername) {
                          authStr = ` \\\n  -u "${replaceVariables(authUsername)}:${replaceVariables(authPassword)}"`;
                        } else if (authType === 'bearer' && authToken) {
                          authStr = ` \\\n  -H "Authorization: Bearer ${replaceVariables(authToken)}"`;
                        }
                        const curl = `curl -X ${method} "${curlUrl}"${requestHeaders.filter(h => h.key).map(h => ` \\\n  -H "${replaceVariables(h.key)}: ${replaceVariables(h.value)}"`).join('')}${authStr}${bodyType !== 'none' && requestBody ? ` \\\n  -d '${replaceVariables(requestBody)}'` : ''}`;
                        navigator.clipboard.writeText(curl);
                        toast({
                          title: '✓ Copied!',
                          description: 'cURL command copied to clipboard',
                        });
                      }}
                      title="Copy as cURL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>

                    {/* Send Button */}
                    <Button
                      onClick={runTest}
                      disabled={loading}
                      className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                      {loading ? 'Testing...' : 'Send'}
                    </Button>
                  </div>
                </div>

                {/* Postman-style Tabs */}
                <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                    {['Params', 'Authorization', 'Headers', 'Body', 'Settings', 'Assertions'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setRequestTab(tab.toLowerCase() as any)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${requestTab === tab.toLowerCase()
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-950'
                          : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {requestTab === 'params' && (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-zinc-500 uppercase mb-2">Query Parameters</div>
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-zinc-500 mb-1">
                        <div className="col-span-5">Key</div>
                        <div className="col-span-6">Value</div>
                      </div>
                      {queryParams.map((param, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            className="col-span-5 h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono"
                            placeholder="key"
                            value={param.key}
                            onChange={e => {
                              const newParams = [...queryParams];
                              newParams[i].key = e.target.value;
                              setQueryParams(newParams);
                            }}
                          />
                          <input
                            className="col-span-6 h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono"
                            placeholder="value"
                            value={param.value}
                            onChange={e => {
                              const newParams = [...queryParams];
                              newParams[i].value = e.target.value;
                              setQueryParams(newParams);
                            }}
                          />
                          <button
                            onClick={() => setQueryParams(queryParams.filter((_, idx) => idx !== i))}
                            className="col-span-1 h-9 flex items-center justify-center text-zinc-400 hover:text-red-500"
                          >×</button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => setQueryParams([...queryParams, { key: '', value: '' }])} className="text-xs">
                        + Add Parameter
                      </Button>
                    </div>
                  )}

                  {requestTab === 'authorization' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">Type</Label>
                        <Select value={authType} onValueChange={(v: any) => setAuthType(v)}>
                          <SelectTrigger className="w-48 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Auth</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {authType === 'basic' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Username</Label>
                              <input value={authUsername} onChange={e => setAuthUsername(e.target.value)} className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm" placeholder="Username" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Password</Label>
                              <div className="relative">
                                <input
                                  type={showAuthPassword ? "text" : "password"}
                                  value={authPassword}
                                  onChange={e => setAuthPassword(e.target.value)}
                                  className="w-full h-9 px-3 pr-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm"
                                  placeholder="Password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-0 top-0 h-full px-3 text-zinc-500 hover:text-zinc-700"
                                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                                >
                                  {showAuthPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          {settings.defaultAuthType === 'basic' && settings.defaultUsername && !settings.defaultUsername.startsWith('http') && (
                            <Button size="sm" variant="outline" onClick={() => {
                              // Defensive: Don't use baseUrl as username
                              const username = settings.defaultUsername.startsWith('http') ? '' : settings.defaultUsername;
                              setAuthUsername(username);
                              setAuthPassword(settings.defaultPassword);
                            }}>
                              Use Default Auth
                            </Button>
                          )}
                        </div>
                      )}
                      {authType === 'bearer' && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Token</Label>
                            <div className="relative">
                              <input
                                type={showAuthToken ? "text" : "password"}
                                value={authToken}
                                onChange={e => setAuthToken(e.target.value)}
                                className="w-full h-9 px-3 pr-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono"
                                placeholder="Enter bearer token"
                              />
                              <button
                                type="button"
                                className="absolute right-0 top-0 h-full px-3 text-zinc-500 hover:text-zinc-700"
                                onClick={() => setShowAuthToken(!showAuthToken)}
                              >
                                {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          {settings.defaultAuthType === 'bearer' && settings.defaultToken && (
                            <Button size="sm" variant="outline" onClick={() => setAuthToken(settings.defaultToken)}>
                              Use Default Token
                            </Button>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                  {requestTab === 'headers' && (
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-zinc-500 uppercase mb-2">Request Headers</div>
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-zinc-500 mb-1">
                        <div className="col-span-5">Key</div>
                        <div className="col-span-6">Value</div>
                      </div>
                      {requestHeaders.map((header, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            className="col-span-5 h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono"
                            placeholder="Header name"
                            value={header.key}
                            onChange={e => {
                              const newHeaders = [...requestHeaders];
                              newHeaders[i].key = e.target.value;
                              setRequestHeaders(newHeaders);
                            }}
                          />
                          <input
                            className="col-span-6 h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono"
                            placeholder="Header value"
                            value={header.value}
                            onChange={e => {
                              const newHeaders = [...requestHeaders];
                              newHeaders[i].value = e.target.value;
                              setRequestHeaders(newHeaders);
                            }}
                          />
                          <button
                            onClick={() => setRequestHeaders(requestHeaders.filter((_, idx) => idx !== i))}
                            className="col-span-1 h-9 flex items-center justify-center text-zinc-400 hover:text-red-500"
                          >×</button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => setRequestHeaders([...requestHeaders, { key: '', value: '' }])} className="text-xs">
                        + Add Header
                      </Button>
                    </div>
                  )}

                  {requestTab === 'body' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 mb-3">
                        <Label className="text-sm">Content Type</Label>
                        <Select value={bodyType} onValueChange={(v: any) => setBodyType(v)}>
                          <SelectTrigger className="w-40 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="form">Form Data</SelectItem>
                            <SelectItem value="raw">Raw</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {bodyType !== 'none' && (
                        <div>
                          {bodyType === 'json' && (
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={() => {
                                  try {
                                    const parsed = JSON.parse(requestBody);
                                    setRequestBody(JSON.stringify(parsed, null, 2));
                                  } catch (e) {
                                    toast({
                                      title: 'Invalid JSON',
                                      description: 'The request body could not be parsed as JSON.',
                                      type: 'error'
                                    })
                                  }
                                }}
                                className="text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded flex items-center gap-1"
                              >
                                <Braces className="w-3.5 h-3.5 mr-1.5" />
                                Beautify JSON
                              </button>
                            </div>
                          )}
                          {bodyType === 'json' ? (
                            <CodeEditor
                              value={requestBody}
                              onChange={setRequestBody}
                              placeholder='{\n  "key": "value"\n}'
                              language="json"
                              minHeight="200px"
                            />
                          ) : (
                            <textarea
                              className="w-full h-32 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder='Enter request body...'
                              value={requestBody}
                              onChange={e => setRequestBody(e.target.value)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {requestTab === 'settings' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-zinc-500 uppercase">Virtual Users (max 100)</Label>
                          <input
                            type="number"
                            className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono text-center"
                            value={concurrency}
                            onChange={e => setConcurrency(Math.min(100, Math.max(1, +e.target.value || 1)))}
                            min={1}
                            max={100}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-zinc-500 uppercase">Iterations (max 1000)</Label>
                          <input
                            type="number"
                            className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono text-center"
                            value={iterations}
                            onChange={e => setIterations(Math.min(1000, Math.max(1, +e.target.value || 1)))}
                            min={1}
                            max={1000}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-zinc-500 uppercase">Timeout (s)</Label>
                          <input
                            type="number"
                            className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm font-mono text-center"
                            defaultValue={30}
                            min={1}
                            max={120}
                          />
                        </div>
                      </div>

                      {/* Phased Load Testing */}
                      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <Label className="text-sm font-medium">Phased Load Testing</Label>
                            <p className="text-xs text-zinc-500">Gradually ramp up VUs for realistic load simulation</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLoadPhaseConfig(prev => ({ ...prev, enablePhasedLoad: !prev.enablePhasedLoad }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loadPhaseConfig.enablePhasedLoad ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loadPhaseConfig.enablePhasedLoad ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>

                        {loadPhaseConfig.enablePhasedLoad && (
                          <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Test Type Presets */}
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setLoadPhaseConfig(prev => ({
                                  ...prev,
                                  spikeMode: false,
                                  preset: 'standard',
                                  warmupDuration: 5,
                                  warmupVUsPercent: 20,
                                  rampUpDuration: 10,
                                  sustainDuration: 30,
                                  rampDownDuration: 5
                                }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${loadPhaseConfig.preset === 'standard' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                Standard Load
                              </button>
                              <button
                                type="button"
                                onClick={() => setLoadPhaseConfig(prev => ({
                                  ...prev,
                                  spikeMode: true,
                                  preset: 'spike',
                                  warmupDuration: 0,
                                  warmupVUsPercent: 100,
                                  rampUpDuration: 1,
                                  sustainDuration: 10,
                                  rampDownDuration: 1
                                }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${loadPhaseConfig.preset === 'spike' ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Spike Test
                              </button>
                              <button
                                type="button"
                                onClick={() => setLoadPhaseConfig(prev => ({
                                  ...prev,
                                  spikeMode: false,
                                  preset: 'stress',
                                  warmupDuration: 10,
                                  warmupVUsPercent: 30,
                                  rampUpDuration: 20,
                                  sustainDuration: 60,
                                  rampDownDuration: 10
                                }))}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${loadPhaseConfig.preset === 'stress' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                <Flame className="w-3.5 h-3.5" />
                                Stress Test
                              </button>
                            </div>

                            {loadPhaseConfig.spikeMode && (
                              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                                <p className="text-xs text-rose-700 dark:text-rose-300">
                                  <strong>⚡ Spike Test Mode:</strong> Instant burst to max VUs with minimal ramp. Tests system's ability to handle sudden traffic surges.
                                </p>
                              </div>
                            )}

                            {/* Phase Duration Inputs */}
                            <div className="grid grid-cols-5 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-zinc-500">Warmup (s)</Label>
                                <input
                                  type="number"
                                  className="w-full h-8 px-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm font-mono text-center"
                                  value={loadPhaseConfig.warmupDuration}
                                  onChange={e => setLoadPhaseConfig(prev => ({ ...prev, warmupDuration: Math.max(0, +e.target.value || 0) }))}
                                  min={0}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zinc-500">Warmup VUs %</Label>
                                <input
                                  type="number"
                                  className="w-full h-8 px-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm font-mono text-center"
                                  value={loadPhaseConfig.warmupVUsPercent}
                                  onChange={e => setLoadPhaseConfig(prev => ({ ...prev, warmupVUsPercent: Math.min(100, Math.max(5, +e.target.value || 20)) }))}
                                  min={5}
                                  max={100}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zinc-500">Ramp Up (s)</Label>
                                <input
                                  type="number"
                                  className="w-full h-8 px-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm font-mono text-center"
                                  value={loadPhaseConfig.rampUpDuration}
                                  onChange={e => setLoadPhaseConfig(prev => ({ ...prev, rampUpDuration: Math.max(0, +e.target.value || 0) }))}
                                  min={0}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zinc-500">Sustain (s)</Label>
                                <input
                                  type="number"
                                  className="w-full h-8 px-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-sm font-mono text-center"
                                  value={loadPhaseConfig.sustainDuration}
                                  onChange={e => setLoadPhaseConfig(prev => ({ ...prev, sustainDuration: Math.max(0, +e.target.value || 0) }))}
                                  min={0}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-zinc-500">Ramp Down (s)</Label>
                                <input
                                  type="number"
                                  className="w-full h-8 px-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded text-sm font-mono text-center"
                                  value={loadPhaseConfig.rampDownDuration}
                                  onChange={e => setLoadPhaseConfig(prev => ({ ...prev, rampDownDuration: Math.max(0, +e.target.value || 0) }))}
                                  min={0}
                                />
                              </div>
                            </div>

                            {/* Visual Phase Timeline */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3">
                              <div className="flex items-end h-12 gap-0.5">
                                {/* Warmup */}
                                {loadPhaseConfig.warmupDuration > 0 && (
                                  <div
                                    className="bg-amber-400 rounded-l transition-all"
                                    style={{
                                      width: `${(loadPhaseConfig.warmupDuration / (loadPhaseConfig.warmupDuration + loadPhaseConfig.rampUpDuration + loadPhaseConfig.sustainDuration + loadPhaseConfig.rampDownDuration || 1)) * 100}%`,
                                      height: `${loadPhaseConfig.warmupVUsPercent}%`
                                    }}
                                    title={`Warmup: ${loadPhaseConfig.warmupDuration}s @ ${loadPhaseConfig.warmupVUsPercent}% VUs`}
                                  />
                                )}
                                {/* Ramp Up */}
                                {loadPhaseConfig.rampUpDuration > 0 && (
                                  <div
                                    className="bg-blue-400 transition-all"
                                    style={{
                                      width: `${(loadPhaseConfig.rampUpDuration / (loadPhaseConfig.warmupDuration + loadPhaseConfig.rampUpDuration + loadPhaseConfig.sustainDuration + loadPhaseConfig.rampDownDuration || 1)) * 100}%`,
                                      height: '70%',
                                      clipPath: 'polygon(0 100%, 100% 0, 100% 100%)'
                                    }}
                                    title={`Ramp Up: ${loadPhaseConfig.rampUpDuration}s`}
                                  />
                                )}
                                {/* Sustain */}
                                {loadPhaseConfig.sustainDuration > 0 && (
                                  <div
                                    className="bg-emerald-400 transition-all"
                                    style={{
                                      width: `${(loadPhaseConfig.sustainDuration / (loadPhaseConfig.warmupDuration + loadPhaseConfig.rampUpDuration + loadPhaseConfig.sustainDuration + loadPhaseConfig.rampDownDuration || 1)) * 100}%`,
                                      height: '100%'
                                    }}
                                    title={`Sustain: ${loadPhaseConfig.sustainDuration}s @ 100% VUs`}
                                  />
                                )}
                                {/* Ramp Down */}
                                {loadPhaseConfig.rampDownDuration > 0 && (
                                  <div
                                    className="bg-rose-400 rounded-r transition-all"
                                    style={{
                                      width: `${(loadPhaseConfig.rampDownDuration / (loadPhaseConfig.warmupDuration + loadPhaseConfig.rampUpDuration + loadPhaseConfig.sustainDuration + loadPhaseConfig.rampDownDuration || 1)) * 100}%`,
                                      height: '70%',
                                      clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
                                    }}
                                    title={`Ramp Down: ${loadPhaseConfig.rampDownDuration}s`}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-zinc-500">
                                <span>0s</span>
                                <span>Total: {loadPhaseConfig.warmupDuration + loadPhaseConfig.rampUpDuration + loadPhaseConfig.sustainDuration + loadPhaseConfig.rampDownDuration}s</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {requestTab === 'assertions' && (
                    <AssertionBuilder assertions={assertions} setAssertions={setAssertions} />
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/20 p-4 flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
              </Card>

              {/* Progress Bar - Shows during test */}
              {loading && progress && (
                <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden animate-in fade-in duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Running Performance Test</h3>
                          <p className="text-sm text-zinc-500">Testing {concurrency} VUs × {iterations} iterations = {concurrency * iterations} total requests</p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={cancelTest}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" /> Cancel Test
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{Math.round((progress.current / progress.total) * 100)}% complete</span>
                        <span>~{Math.round((Date.now() - progress.startTime) / 1000)}s elapsed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Results Area */}
              {result && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">

                  {/* Save Snapshot Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setShowSnapshotModal(true)}
                      className="bg-indigo-600 hover:bg-indigo-700"
                      title="Save this test result as a snapshot"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save as Snapshot
                    </Button>
                  </div>

                  {/* k6-style Load Summary Chart
                  {result.timeSeries && result.timeSeries.length > 0 && (
                    <>
                      <LoadSummaryChart
                        timeSeries={result.timeSeries}
                        totalVUs={concurrency}
                        totalRequests={result.stats.requests}
                        testDuration={result.summary?.totalTime || 0}
                      />
                      <ErrorRateChart timeSeries={result.timeSeries} />
                      <LatencyHeatmap timeSeries={result.timeSeries} />
                      <ThroughputLatencyChart timeSeries={result.timeSeries} />
                    </>
                  )} */}

                  {/* Assertion Results */}
                  {result.assertions && result.assertions.length > 0 && (
                    <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium">Assertion Results</CardTitle>
                          <Badge variant={result.assertions_passed === result.assertions_total ? 'default' : 'destructive'}>
                            {result.assertions_passed} / {result.assertions_total} Passed
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {result.assertions.map((assertion: AssertionResult, i: number) => (
                            <div key={i} className={`p-3 rounded-md border text-sm flex items-center justify-between ${assertion.passed
                              ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                              : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-800 dark:text-red-300'
                              }`}>
                              <div className="flex items-center gap-3">
                                {assertion.passed ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                                <div className="flex flex-col">
                                  <span className="font-semibold">{assertion.type} {assertion.operator.replace('_', ' ')} {assertion.expected}</span>
                                  {!assertion.passed && (
                                    <span className="text-xs opacity-90">{assertion.message}</span>
                                  )}
                                  {assertion.passed && (
                                    <span className="text-xs opacity-75">Actual: {String(assertion.actual)}</span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className={assertion.passed ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}>
                                {assertion.passed ? 'PASS' : 'FAIL'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Important Metrics Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <MetricCard
                      title="Total Requests"
                      value={result.stats.requests.toLocaleString()}
                      icon={List}
                      trend="up"
                      trendValue="Complete"
                      subtext={result.stats.requests > (concurrency * iterations)
                        ? `Expected ${(concurrency * iterations).toLocaleString()} • Phased testing runs time-based batches`
                        : "Total API calls made"
                      }
                    />
                    <MetricCard
                      title="Avg Latency"
                      value={`${result.stats.mean.toFixed(0)}ms`}
                      icon={Activity}
                      trend={result.stats.mean < 200 ? 'up' : result.stats.mean < 500 ? 'neutral' : 'down'}
                      trendValue={result.stats.mean < 200 ? 'Fast' : result.stats.mean < 500 ? 'OK' : 'Slow'}
                      subtext="Average response time"
                    />
                    <MetricCard
                      title="Cache Hit Rate"
                      value={`${result.stats.requests > 0 ? ((result.stats.cacheHits / result.stats.requests) * 100).toFixed(1) : '0.0'}%`}
                      icon={Zap}
                      trend={(result.stats.cacheHits / result.stats.requests) > 0.5 ? 'up' : 'neutral'}
                      trendValue={`${result.stats.cacheHits} hits`}
                      subtext={`${result.stats.cacheMisses} misses`}
                    />
                    <MetricCard
                      title="Error Rate"
                      value={`${result.stats.errorRate.toFixed(1)}%`}
                      icon={AlertCircle}
                      trend={result.stats.errorRate === 0 ? 'up' : 'down'}
                      trendValue={result.stats.errorRate === 0 ? 'Perfect' : `${result.stats.errorCount} failed`}
                      subtext="Failed requests"
                    />
                  </div>
                  {/* k6-style Load Summary Chart */}
                  {result.timeSeries && result.timeSeries.length > 0 && (
                    <LoadSummaryChart
                      timeSeries={result.timeSeries}
                      totalVUs={concurrency}
                      totalRequests={result.stats.requests}
                      testDuration={result.summary?.totalTime || 0}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <Card className="col-span-2 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Performance Trends</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                              Real-time Latency
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                              Throughput
                            </span>
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.3} />
                              <XAxis dataKey="time" hide />
                              <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} rps`} />
                              <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                              <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ strokeDasharray: '3 3' }}
                                labelStyle={{ display: 'none' }}
                              />
                              <Area yAxisId="left" type="monotone" dataKey="rps" fill="url(#colorRps)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} name="Throughput" />
                              <defs>
                                <linearGradient id="colorRps" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area yAxisId="right" type="monotone" dataKey="responseTime" stroke="#f43f5e" strokeWidth={2} fill="none" name="Latency" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Performance Insights */}
                        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <div className="text-center">
                            <p className="text-xs text-zinc-500 mb-1">Peak RPS</p>
                            <p className="text-lg font-semibold text-indigo-600">
                              {chartData.length > 0 ? Math.max(...chartData.map(d => d.rps)).toFixed(1) : '0'}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500 mb-1">Min Latency</p>
                            <p className="text-lg font-semibold text-emerald-600">
                              {chartData.length > 0 ? Math.min(...chartData.filter(d => d.responseTime > 0).map(d => d.responseTime)).toFixed(0) : '0'}ms
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500 mb-1">Peak Latency</p>
                            <p className="text-lg font-semibold text-rose-600">
                              {chartData.length > 0 ? Math.max(...chartData.map(d => d.responseTime)).toFixed(0) : '0'}ms
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-zinc-500 mb-1">Stability</p>
                            <p className="text-lg font-semibold text-amber-600">
                              {(() => {
                                if (chartData.length < 2) return '—';
                                const rpsValues = chartData.map(d => d.rps);
                                const avg = rpsValues.reduce((a, b) => a + b, 0) / rpsValues.length;
                                const variance = rpsValues.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / rpsValues.length;
                                const cv = avg > 0 ? (Math.sqrt(variance) / avg) * 100 : 0;
                                return cv < 10 ? 'Stable' : cv < 30 ? 'Moderate' : 'Volatile';
                              })()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* New Insights Column */}
                    <div className="space-y-6">
                      {/* Apdex Score */}
                      <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-medium">Apdex Score</CardTitle>
                          <CardDescription>User Satisfaction</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end gap-3">
                            <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{calculateApdex(result.stats)}</span>
                            <span className="mb-1.5 text-sm text-zinc-500 font-medium">
                              {calculateApdex(result.stats) > 0.9 ? 'Excellent' : calculateApdex(result.stats) > 0.7 ? 'Fair' : 'Poor'}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${calculateApdex(result.stats) * 100}%` }} />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Status Codes */}
                      <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-medium">Status Codes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-zinc-600 dark:text-zinc-400">200 OK</span>
                            </div>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100">{result.stats.successCount}</span>
                          </div>
                          {result.stats.errorCount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-zinc-600 dark:text-zinc-400">Errors</span>
                              </div>
                              <span className="font-mono text-zinc-900 dark:text-zinc-100">{result.stats.errorCount}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Throughput Gauge */}
                      <ThroughputGauge rps={result.stats.rps} />
                    </div>
                  </div>

                  {/* Stress & Scalability Analysis */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Stress Analysis - Vertical Sidebar Card */}
                    <Card className="row-span-2 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-500" /> Stress Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 flex-1 flex flex-col pt-4">
                        <div className="space-y-4">
                          {/* Load Status */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Load Stability</span>
                              <Badge variant={result.stats.errorRate > 5 ? 'destructive' : result.stats.errorRate > 1 ? 'outline' : 'secondary'} className={result.stats.errorRate > 5 ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' : result.stats.errorRate > 1 ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200'}>
                                {result.stats.errorRate > 5 ? 'CRITICAL' : result.stats.errorRate > 1 ? 'DEGRADED' : 'HEALTHY'}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {result.stats.errorRate > 5
                                ? 'High error rates detected. System is struggling to handle the current load.'
                                : result.stats.errorRate > 1
                                  ? 'Minor instability detected. Some requests are failing but system is operational.'
                                  : 'System is performing optimally with minimal errors under load.'}
                            </p>
                          </div>

                          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                          {/* Stress Status */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Stress Resilience</span>
                              <Badge variant="outline" className={`${result.testing.coldWarmRatio > 3 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                {result.testing.coldWarmRatio > 3 ? 'STRAINED' : 'RESILIENT'}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {result.testing.coldWarmRatio > 3
                                ? 'Significant performance degradation observed over time.'
                                : 'Performance remains consistent continuously throughout the test.'}
                            </p>
                          </div>

                          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                          {/* Latency Rating */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Response Quality</span>
                              <Badge className={`${result.stats.mean < 200 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : result.stats.mean < 500 ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                {result.stats.mean < 200 ? 'EXCELLENT' : result.stats.mean < 500 ? 'GOOD' : 'POOR'}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              {result.stats.mean < 200
                                ? 'Avg response time is under 200ms. Excellent user experience.'
                                : result.stats.mean < 500
                                  ? 'Avg response time is 200-500ms. Acceptable for most use cases.'
                                  : 'Avg response time exceeds 500ms. Optimization recommended.'}
                            </p>
                          </div>
                        </div>

                        {/* Error Trend Chart - Premium Look */}
                        {result.timeSeries && result.timeSeries.length > 0 && (
                          <div className="flex-1 min-h-[140px] mt-2 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Error Trend</span>
                              </div>
                              <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 text-zinc-600 bg-white">
                                {result.timeSeries.reduce((acc, curr) => acc + (curr.errorCount || 0), 0)} ERRORS
                              </Badge>
                            </div>
                            <div className="flex-1 w-full min-h-[80px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={result.timeSeries}>
                                  <defs>
                                    <linearGradient id="colorErrors2" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" className="dark:stroke-zinc-800" />
                                  <XAxis dataKey="timestamp" hide />
                                  <YAxis hide />
                                  <Tooltip
                                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#ef4444' }}
                                    labelFormatter={() => ''}
                                    formatter={(value: any) => [value, 'Errors']}
                                    cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '2 2' }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="errorCount"
                                    stroke="#ef4444"
                                    fillOpacity={1}
                                    fill="url(#colorErrors2)"
                                    strokeWidth={2}
                                    animationDuration={1000}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Cold/Warm Analysis */}
                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-auto">
                          <div className="text-xs font-medium text-zinc-500 uppercase mb-3">Cache Performance & Cold Start</div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                              <div className="text-lg font-mono font-semibold">{result.testing.coldStart.toFixed(0)}ms</div>
                              <div className="text-xs text-zinc-500">Cold Start</div>
                            </div>
                            <div className="text-center p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                              <div className="text-lg font-mono font-semibold">{result.testing.warmAvg.toFixed(0)}ms</div>
                              <div className="text-xs text-zinc-500">Warm Avg</div>
                            </div>
                            <div className="text-center p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                              <div className="text-lg font-mono font-semibold">{result.testing.coldWarmRatio}x</div>
                              <div className="text-xs text-zinc-500">Ratio</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Latency Analysis Card */}
                    <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-indigo-500" /> Latency Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs font-medium text-zinc-500 uppercase mb-3">Response Time Percentiles</div>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          {[
                            { name: 'P50', value: result.chartData.percentiles.p50, color: 'bg-indigo-100 text-indigo-700' },
                            { name: 'P75', value: result.chartData.percentiles.p75, color: 'bg-indigo-200 text-indigo-800' },
                            { name: 'P90', value: result.chartData.percentiles.p90, color: 'bg-indigo-300 text-indigo-800' },
                            { name: 'P95', value: result.chartData.percentiles.p95, color: 'bg-indigo-400 text-white' },
                            { name: 'P99', value: result.chartData.percentiles.p99, color: 'bg-indigo-600 text-white' },
                          ].map(p => (
                            <div key={p.name} className={`${p.color} rounded-lg p-2 text-center`}>
                              <div className="text-[10px] font-medium opacity-80">{p.name}</div>
                              <div className="text-sm font-bold">{p.value.toFixed(0)}ms</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs border-t border-zinc-100 dark:border-zinc-800 pt-3">
                          <div>
                            <span className="text-zinc-500 mr-2">Performance Grade:</span>
                            <Badge className={`${result.chartData.percentiles.p95 < 100 ? 'bg-emerald-100 text-emerald-700' :
                              result.chartData.percentiles.p95 < 300 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                              {result.chartData.percentiles.p95 < 100 ? 'Excellent' :
                                result.chartData.percentiles.p95 < 300 ? 'Good' :
                                  result.chartData.percentiles.p95 < 500 ? 'Fair' : 'Slow'}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-zinc-500 mr-2">P99/P50 Ratio:</span>
                            <span className="font-mono font-medium">{(result.chartData.percentiles.p99 / Math.max(result.chartData.percentiles.p50, 1)).toFixed(1)}x</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Timing Breakdown (Bottleneck) */}
                    <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">Timing Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(Object.entries(result.bottleneck) as [string, number][]).map(([k, v], i) => {
                            const values = Object.values(result.bottleneck) as number[];
                            const total = values.reduce((a, b) => a + b, 0);
                            const percent = total > 0 ? (v / total) * 100 : 0;
                            const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-red-400', 'bg-purple-400'];
                            return (
                              <div key={k}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded ${colors[i]}`} />
                                    <span className="text-zinc-600 dark:text-zinc-400">{k.toUpperCase()}</span>
                                  </span>
                                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{v.toFixed(1)}ms <span className="text-zinc-400">({percent.toFixed(0)}%)</span></span>
                                </div>
                                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${colors[i]} rounded-full`} style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                          {(() => {
                            const entries = Object.entries(result.bottleneck) as [string, number][];
                            const [bottleneck] = entries.reduce((a, b) => b[1] > a[1] ? b : a, ['', 0] as [string, number]);
                            const total = entries.reduce((a, [, v]) => a + v, 0);
                            return (
                              <div className="text-[11px]">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-zinc-500">Primary Bottleneck</span>
                                  <span className="font-medium text-amber-600">{bottleneck.toUpperCase()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-500">Total Time</span>
                                  <span className="font-mono font-medium">{total.toFixed(1)}ms</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Latency Distribution Heatmap */}
                    {result.timeSeries && result.timeSeries.length > 0 && (
                      <LatencyHeatmap
                        timeSeries={result.timeSeries}
                        className="col-span-1 lg:col-span-2"
                      />
                    )}
                  </div>

                  {/* API Response Viewer - VS Code Style */}
                  <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                    <CardHeader className="pb-0 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <Code className="w-4 h-4 text-indigo-500" /> Response Inspector
                        </CardTitle>
                        <Badge variant="outline" className="text-xs font-mono">
                          {result.firstResponse.status} {result.firstResponse.status === 200 ? 'OK' : ''}
                        </Badge>
                      </div>
                      {/* VS Code Style Tabs */}
                      <div className="flex mt-3 border-b border-zinc-200 dark:border-zinc-700">
                        <button
                          onClick={() => setActiveTab('headers')}
                          className={`px-4 py-2 text-xs font-medium transition-colors relative ${activeTab === 'headers'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                          Headers
                          {activeTab === 'headers' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                        </button>
                        <button
                          onClick={() => setActiveTab('body')}
                          className={`px-4 py-2 text-xs font-medium transition-colors relative ${activeTab === 'body'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                          Body
                          {activeTab === 'body' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                        </button>
                        <button
                          onClick={() => setActiveTab('preview')}
                          className={`px-4 py-2 text-xs font-medium transition-colors relative ${activeTab === 'preview'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                          Preview
                          {activeTab === 'preview' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2">
                      {activeTab === 'headers' ? (
                        <CodeSnippet
                          code={`HTTP/1.1 ${result.firstResponse.status}\n${Object.entries(result.firstResponse.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}`}
                          language="markup"
                          title="headers.txt"
                          maxHeight="250px"
                          showLineNumbers={true}
                        />
                      ) : activeTab === 'body' ? (
                        <CodeSnippet
                          code={(() => {
                            try {
                              return JSON.stringify(JSON.parse(result.firstResponse.body), null, 2);
                            } catch {
                              return result.firstResponse.body;
                            }
                          })()}
                          language="json"
                          title="response.json"
                          maxHeight="250px"
                          showLineNumbers={true}
                        />
                      ) : (
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white max-h-80 overflow-y-auto">
                          <iframe
                            srcDoc={result.firstResponse.body}
                            className="w-full min-h-[500px] bg-white"
                            sandbox="allow-same-origin allow-scripts"
                            title="Response Preview"
                            style={{ border: 'none' }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Request Details Table with Pagination */}
                  <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Request Timeline</CardTitle>
                      <CardDescription>Detailed breakdown of all {result.requests.length} requests</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800">
                              <th className="text-left py-3 px-4 font-medium text-zinc-500">#</th>
                              <th className="text-left py-3 px-4 font-medium text-zinc-500">Status</th>
                              <th className="text-left py-3 px-4 font-medium text-zinc-500">Cache</th>
                              <th className="text-right py-3 px-4 font-medium text-zinc-500">TTFB</th>
                              <th className="text-right py-3 px-4 font-medium text-zinc-500">Total Time</th>
                              <th className="text-right py-3 px-4 font-medium text-zinc-500">Size</th>
                              <th className="py-3 px-4 font-medium text-zinc-500">Timeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.requests.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((req, i) => {
                              const maxTime = Math.max(...result.requests.map(r => r.totalTime));
                              return (
                                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                  <td className="py-3 px-4 font-mono text-zinc-500">{(currentPage - 1) * pageSize + i + 1}</td>
                                  <td className="py-3 px-4">
                                    <Badge variant={req.status === 200 ? 'default' : 'destructive'} className="text-xs">{req.status}</Badge>
                                  </td>
                                  <td className="py-3 px-4">
                                    <Badge variant="outline" className={`text-xs ${req.cache === 'HIT' ? 'border-emerald-500 text-emerald-600' : 'border-zinc-300 text-zinc-500'}`}>
                                      {req.cache === 'HIT' ? 'HIT' : 'MISS'}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono text-sm">{req.ttfb.toFixed(0)}ms</td>
                                  {/* Total Time with Timeline Tooltip */}
                                  <td className="py-3 px-4 text-right font-mono text-sm">
                                    <div className="group relative inline-block cursor-help">
                                      <span className="underline decoration-dotted">{req.totalTime.toFixed(0)}ms</span>
                                      {req.timing && (
                                        <div className="absolute z-50 hidden group-hover:block right-0 top-full mt-1 w-64 p-3 bg-zinc-900 text-white rounded-lg shadow-xl border border-zinc-700">
                                          <div className="text-xs font-semibold mb-2 text-zinc-400 uppercase">Request Timeline</div>
                                          <div className="space-y-1.5">
                                            {[
                                              { label: 'DNS Lookup', value: req.timing.dns, color: 'bg-blue-400' },
                                              { label: 'TCP Handshake', value: req.timing.tcp, color: 'bg-green-400' },
                                              { label: 'SSL/TLS', value: req.timing.ssl, color: 'bg-yellow-400' },
                                              { label: 'Waiting (TTFB)', value: req.timing.wait, color: 'bg-purple-400' },
                                              { label: 'Download', value: req.timing.download, color: 'bg-emerald-400' },
                                            ].map(item => (
                                              <div key={item.label} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                  <div className={`w-2 h-2 rounded ${item.color}`} />
                                                  <span className="text-zinc-300">{item.label}</span>
                                                </div>
                                                <span className="font-mono text-zinc-100">{item.value.toFixed(2)}ms</span>
                                              </div>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-zinc-700 flex justify-between font-semibold text-xs">
                                              <span className="text-emerald-400">Total</span>
                                              <span className="text-emerald-400 font-mono">{req.totalTime.toFixed(2)}ms</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  {/* Size with Tooltip */}
                                  <td className="py-3 px-4 text-right font-mono text-sm">
                                    <div className="group relative inline-block cursor-help">
                                      <span className="underline decoration-dotted">{(req.size / 1024).toFixed(1)}KB</span>
                                      {req.sizeDetails && (
                                        <div className="absolute z-50 hidden group-hover:block right-0 top-full mt-1 w-56 p-3 bg-zinc-900 text-white rounded-lg shadow-xl border border-zinc-700">
                                          <div className="text-xs font-semibold mb-2 text-zinc-400 uppercase">Size Breakdown</div>
                                          <div className="space-y-2">
                                            <div>
                                              <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-blue-400 flex items-center gap-1">↓ Response Size</span>
                                                <span className="font-mono">{((req.sizeDetails.responseHeaders + req.sizeDetails.responseBody) / 1024).toFixed(2)}KB</span>
                                              </div>
                                              <div className="pl-3 space-y-0.5 text-zinc-400">
                                                <div className="flex justify-between text-xs">
                                                  <span>Headers</span>
                                                  <span className="font-mono">{req.sizeDetails.responseHeaders}B</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                  <span>Body</span>
                                                  <span className="font-mono">{(req.sizeDetails.responseBody / 1024).toFixed(2)}KB</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-700">
                                            Sizes are approximate
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${(req.totalTime / maxTime) * 100}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Numbered Pagination */}
                      {(() => {
                        const totalPages = Math.ceil(result.requests.length / pageSize);
                        const getPageNumbers = () => {
                          const pages: (number | string)[] = [];
                          if (totalPages <= 7) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            if (currentPage > 3) pages.push('...');
                            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                              pages.push(i);
                            }
                            if (currentPage < totalPages - 2) pages.push('...');
                            pages.push(totalPages);
                          }
                          return pages;
                        };
                        return (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {getPageNumbers().map((page, idx) => (
                                typeof page === 'number' ? (
                                  <button
                                    key={idx}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${currentPage === page
                                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                      }`}
                                  >
                                    {page}
                                  </button>
                                ) : (
                                  <span key={idx} className="w-9 h-9 flex items-center justify-center text-zinc-400">...</span>
                                )
                              ))}
                            </div>
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage >= totalPages}
                              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                            >
                              Next <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              )
              }

              {
                !result && !loading && (
                  <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 h-96 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                      <BarChart3 className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No test results yet</h3>
                    <p className="max-w-sm text-zinc-500 dark:text-zinc-400 mt-2">Enter an endpoint above and click "Start Load Test" to see real-time performance metrics here.</p>
                  </div>
                )
              }
            </>
          )}

          {mainView === 'settings' && (
            <SettingsView settings={settings} setSettings={setSettings} />
          )}

          {mainView === 'snapshots' && (
            <SnapshotsView
              snapshots={snapshots}
              onRunTest={handleRunSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onViewDetails={handleViewSnapshotDetails}
              onCompare={handleCompareSnapshots}
            />
          )}

          {/* Bulk Runner View */}
          {mainView === 'bulk' && (
            <BulkTestView savedConfigs={savedConfigs} onLoadPreset={loadConfigForDebugging} />
          )}

          {/* Request Chains View */}
          {mainView === 'chains' && (
            <ChainBuilderView />
          )}

          {/* Config Manager View */}
          {mainView === 'configManager' && (
            <ConfigManagerView onEnvironmentChange={loadEnvironments} />
          )}


        </div>
      </main >

      {/* Snapshot Detail Modal */}
      < Dialog open={showSnapshotDetail} onOpenChange={setShowSnapshotDetail} >
        <DialogContent className="sm:max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Snapshot Details</DialogTitle>
            <DialogDescription>
              Full request and response data for this snapshot
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full">
            <div className="space-y-6 py-4">
              {snapshotDetail && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Snapshot Info</h3>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md text-sm space-y-1">
                      <p><strong>Name:</strong> {snapshotDetail.snapshot_name}</p>
                      <p><strong>Created:</strong> {new Date(snapshotDetail.created * 1000).toLocaleString()}</p>
                      <p><strong>Status:</strong> {snapshotDetail.status_code}</p>
                      <p><strong>Response Time:</strong> {snapshotDetail.response_time}ms</p>
                    </div>
                  </div>

                  {snapshotDetail.request_config && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Request</h3>
                      <CodeSnippet
                        code={JSON.stringify(snapshotDetail.request_config, null, 2)}
                        language="json"
                        title="request.json"
                        maxHeight="300px"
                      />
                    </div>
                  )}

                  {snapshotDetail.response_body && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Response Body</h3>
                      <CodeSnippet
                        code={typeof snapshotDetail.response_body === 'string'
                          ? snapshotDetail.response_body
                          : JSON.stringify(snapshotDetail.response_body, null, 2)}
                        language="json"
                        title="response.json"
                        maxHeight="350px"
                      />
                    </div>
                  )}

                  {snapshotDetail.notes && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Notes</h3>
                      <p className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md text-sm">
                        {snapshotDetail.notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog >

      {/* Snapshot Comparison Modal */}
      < Dialog open={showComparison} onOpenChange={setShowComparison} >
        <DialogContent className="sm:max-w-6xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Snapshot Comparison</DialogTitle>
            <DialogDescription>
              Side-by-side comparison of two snapshots
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] w-full">
            <div className="py-4">
              {comparisonData && (
                <div className="space-y-6">
                  {/* Performance Metrics Comparison */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-zinc-500">Snapshot 1</h4>
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md text-sm space-y-1">
                          <p><strong>Name:</strong> {comparisonData.snapshot1?.snapshot_name}</p>
                          <p><strong>Status:</strong> {comparisonData.snapshot1?.status_code}</p>
                          <p><strong>Response Time:</strong> {comparisonData.snapshot1?.response_time}ms</p>
                          <p><strong>Created:</strong> {new Date(comparisonData.snapshot1?.created * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-zinc-500">Snapshot 2</h4>
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-md text-sm space-y-1">
                          <p><strong>Name:</strong> {comparisonData.snapshot2?.snapshot_name}</p>
                          <p><strong>Status:</strong> {comparisonData.snapshot2?.status_code}</p>
                          <p><strong>Response Time:</strong> {comparisonData.snapshot2?.response_time}ms</p>
                          <p><strong>Created:</strong> {new Date(comparisonData.snapshot2?.created * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Differences Summary */}
                  {comparisonData.differences && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Differences Found</h3>
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-md">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(comparisonData.differences, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Side-by-side Request Comparison */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Request Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2">Snapshot 1</h4>
                        <CodeSnippet
                          code={JSON.stringify(comparisonData.snapshot1?.request_config, null, 2)}
                          language="json"
                          title="config.json"
                          maxHeight="300px"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2">Snapshot 2</h4>
                        <CodeSnippet
                          code={JSON.stringify(comparisonData.snapshot2?.request_config, null, 2)}
                          language="json"
                          title="config.json"
                          maxHeight="300px"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Side-by-side Response Comparison */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Response Body</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2">Snapshot 1</h4>
                        <CodeSnippet
                          code={typeof comparisonData.snapshot1?.response_body === 'string'
                            ? comparisonData.snapshot1?.response_body
                            : JSON.stringify(comparisonData.snapshot1?.response_body, null, 2)}
                          language="json"
                          title="response.json"
                          maxHeight="350px"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-zinc-500 mb-2">Snapshot 2</h4>
                        <CodeSnippet
                          code={typeof comparisonData.snapshot2?.response_body === 'string'
                            ? comparisonData.snapshot2?.response_body
                            : JSON.stringify(comparisonData.snapshot2?.response_body, null, 2)}
                          language="json"
                          title="response.json"
                          maxHeight="350px"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog >

      {/* Import cURL Modal */}
      < Dialog open={showCurlImport} onOpenChange={setShowCurlImport} >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from cURL</DialogTitle>
            <DialogDescription>
              Paste your cURL command below to auto-populate the request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <textarea
              className="w-full h-48 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`curl -X POST "https://api.example.com/endpoint" \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`}
              value={curlInput}
              onChange={(e) => setCurlInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCurlImport(false); setCurlInput(''); }}>
                Cancel
              </Button>
              <Button onClick={handleImportCurl} disabled={!curlInput.trim()}>
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Snapshot Save Modal */}
      < Dialog open={showSnapshotModal} onOpenChange={setShowSnapshotModal} >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-indigo-600" />
              Save API Snapshot
            </DialogTitle>
            <DialogDescription>
              Save this test result as a versioned snapshot to track API changes over time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name / Version *</Label>
              <input
                id="snapshot-name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., v1.0.0 - Initial Release"
                className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-notes">Notes (Optional)</Label>
              <textarea
                id="snapshot-notes"
                value={snapshotNotes}
                onChange={(e) => setSnapshotNotes(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-sm resize-none"
              />
            </div>
            {!currentConfigId && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Please save this request as a preset first to enable versioning.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowSnapshotModal(false);
                setSnapshotName('');
                setSnapshotNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSnapshot}
              disabled={!currentConfigId || !snapshotName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Snapshot
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      <SaveConfigDialog
        open={showSaveConfigModal}
        onOpenChange={setShowSaveConfigModal}
        onSave={handleSaveConfig}
        currentUrl={url}
        loadedPresetId={currentConfigId || null}
        loadedPresetName={currentConfigName || null}
      />
    </div >
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
      <Toaster />
    </ToastProvider>
  )
}

export default App
