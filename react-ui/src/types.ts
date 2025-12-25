export interface SettingsConfig {
    baseUrl: string;
    defaultAuthType: 'none' | 'basic' | 'bearer';
    defaultUsername: string;
    defaultPassword: string;
    defaultToken: string;
    defaultApiKey: string;
    defaultTimeout: number;
    defaultConcurrency: number;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    url: string;
    method: string;
    status: number;
    duration: number;
    totalRequests: number; // Added
    avgTime: number;      // Added
    errorCount: number;   // Added
    config_id: string;    // Added for grouping
    snapshot_name: string; // Added for version display
}

export interface SavedApiConfig {
    id: string;
    name: string;
    url: string;
    method: string;
    headers: Array<{ key: string; value: string }>;
    queryParams: Array<{ key: string; value: string }>;
    body: string;
    bodyType?: string;
    authType: 'none' | 'basic' | 'bearer' | 'apikey'; // apikey kept for backward compatibility
    // Auth credentials
    authUsername?: string;
    authPassword?: string;
    authToken?: string;
    authKeyName?: string;
    authKeyValue?: string;
    assertions?: Assertion[];
}

export interface RequestStat {
    index: number;
    status: number;
    totalTime: number;
    ttfb: number;
    size: number;
    cache: string;
    error: string | null;
    timing?: {
        dns: number;
        tcp: number;
        ssl: number;
        wait: number;
        download: number;
    };
    sizeDetails?: {
        responseHeaders: number;
        responseBody: number;
    };
}

export interface TestStats {
    requests: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    rps: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    stddev: number;
    p95: number;
    p99: number;
    cacheHits: number;
    cacheMisses: number;
}

export interface TestResult {
    success: boolean;
    stats: TestStats;
    testing: any;
    chartData: any;
    bottleneck: any;
    firstResponse: any;
    requests: RequestStat[];
    summary: any;
    assertions?: AssertionResult[];
    assertions_passed?: number;
    assertions_total?: number;
    timeSeries?: TimeSeriesPoint[];
}

export interface TimeSeriesPoint {
    time: number;
    timestamp: string;
    activeVUs: number;
    rps: number;
    responseTimeP50: number;
    responseTimeP95: number;
    responseTimeP99: number;
    successCount: number;
    errorCount: number;
    phase?: 'warmup' | 'rampup' | 'sustain' | 'rampdown';
}

export interface Assertion {
    id?: string;
    assertion_type: 'status_code' | 'response_time' | 'json_path' | 'header';
    field_path?: string;
    operator: string;
    expected_value: string;
    enabled: boolean;
}

export interface AssertionResult {
    type: string;
    operator: string;
    expected: string;
    actual: any;
    passed: boolean;
    message: string;
}

export interface EnvVariable {
    key: string;
    value: string;
}

export type EnvironmentColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

export interface EnvironmentProfile {
    id: string;
    name: string;
    base_url: string;
    color?: EnvironmentColor;
    is_active?: boolean;
    variables?: EnvVariable[];
}

export interface LoadPhaseConfig {
    enablePhasedLoad: boolean;
    warmupDuration: number;      // seconds
    warmupVUsPercent: number;    // % of max VUs during warmup (5-100)
    rampUpDuration: number;      // seconds
    sustainDuration: number;     // seconds  
    rampDownDuration: number;    // seconds
}
