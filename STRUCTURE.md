# API Insight Lab - Architecture & Structure

This document provides a technical overview of the module's architecture, data flows, and implementation details for developers and contributors.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Data Models](#data-models)
- [API Specification](#api-specification)
- [Build & Deployment](#build--deployment)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)

## Directory Structure

```
api_insight_lab/
├── README.md                          # Overview and quick start
├── USER_MANUAL.md                     # Detailed user guide
├── STRUCTURE.md                       # This file (architecture docs)
├── CONTRIBUTING.md                    # Contribution guidelines
├── LICENSE.txt                        # GPL-2.0-or-later
│
├── api_insight_lab.info.yml          # Module metadata
├── api_insight_lab.routing.yml       # Route definitions (~260 lines)
├── api_insight_lab.links.menu.yml    # Admin menu links
├── api_insight_lab.install           # Install/update hooks
├── api_insight_lab.libraries.yml     # Asset library definitions
│
├── config/
│   ├── install/                      # Default configuration
│   │   └── api_insight_lab.settings.yml
│   └── schema/                       # Configuration schema
│       └── api_insight_lab.schema.yml
│
├── src/
│   ├── Controller/
│   │   ├── ApiTestController.php     # Main REST controller (~2000 lines)
│   │   ├── ConfigExportController.php # Config export/import, environments
│   │   └── TestApiController.php     # Test API endpoints for development
│   │
│   ├── Entity/
│   │   ├── ApiTestConfig.php         # Saved configurations
│   │   ├── TestResult.php            # Test execution results
│   │   ├── ApiSnapshot.php           # Versioned snapshots
│   │   ├── RequestChain.php          # Request chain definitions
│   │   ├── EnvironmentProfile.php    # Environment profiles with variables
│   │   └── Assertion.php             # Validation rules
│   │
│   └── Form/
│       └── SettingsForm.php          # Drupal settings form
│
├── js/react-app/                     # Compiled frontend (production)
│   ├── app.js                        # Bundled React application (~920KB)
│   ├── app.css                       # Bundled styles (~70KB)
│   └── index.html                    # Entry point
│
└── react-ui/                         # React source code
    ├── src/
    │   ├── App.tsx                   # Main application component (~2600 lines)
    │   ├── main.tsx                  # React entry point
    │   ├── index.css                 # Global styles + Tailwind
    │   ├── types.ts                  # TypeScript interfaces
    │   ├── lib/utils.ts              # Utility functions
    │   │
    │   ├── hooks/                    # Custom React hooks
    │   │   └── use-toast.ts          # Toast notification hook
    │   │
    │   └── components/
    │       ├── ui/                   # shadcn/ui components
    │       │   ├── button.tsx
    │       │   ├── card.tsx
    │       │   ├── dialog.tsx
    │       │   ├── tabs.tsx
    │       │   └── ... (20+ components)
    │       │
    │       │
    │       ├── CodeSnippet.tsx       # Syntax-highlighted code display
    │       ├── ThroughputGauge.tsx   # RPS gauge with performance grading
    │       ├── LatencyHeatmap.tsx    # Heatmap visualization
    │       ├── LoadSummaryChart.tsx  # Interactive load chart with phases
    │       │
    │       └── views/                # Feature view components
    │           ├── SettingsView.tsx      # Global settings
    │           ├── SnapshotsView.tsx     # Snapshot management
    │           ├── BulkTestView.tsx      # Bulk testing
    │           └── ChainBuilderView.tsx  # Request chain builder
    │
    ├── package.json                  # Node dependencies
    ├── tsconfig.json                 # TypeScript configuration
    ├── vite.config.ts                # Vite build configuration
    └── tailwind.config.ts            # Tailwind CSS configuration
```

## Backend Architecture

### Controllers

#### ApiTestController (Primary)

Handles all performance testing operations:

| Method | Route | Description |
|--------|-------|-------------|
| `runTest()` | POST /api/perf-test/run | Execute performance test |
| `runLoadTest()` | (internal) | Guzzle Pool concurrent execution |
| `buildResults()` | (internal) | Calculate statistics |
| `evaluateAssertions()` | (internal) | Validate response against rules |
| `getPresets()` | GET /api/perf-test/presets | List saved configs |
| `savePreset()` | POST /api/perf-test/presets | Create new config |
| `getSnapshots()` | GET /api/perf-test/snapshots | List snapshots |
| `compareSnapshots()` | GET /api/perf-test/snapshots/compare/{id1}/{id2} | Diff snapshots |
| `discovery()` | GET /api/discovery | Scan for REST resources |
| `getChains()` | GET /api/perf-test/chains | List chains |

#### ConfigExportController (Config Management)

Handles configuration export/import and environment management:

| Method | Route | Description |
|--------|-------|-------------|
| `export()` | POST /api/perf-test/export | Export configs with auth option |
| `import()` | POST /api/perf-test/import | Import configs |
| `getEnvironmentProfiles()` | GET /api/perf-test/environments | List environments |
| `saveEnvironmentProfile()` | POST /api/perf-test/environments | Save environment |
| `deleteEnvironmentProfile()` | DELETE /api/perf-test/environments/{id} | Delete environment |
| `setActiveEnvironment()` | POST /api/perf-test/environments/active | Set active env |
| `saveChain()` | POST /api/perf-test/chains | Save chain |
| `runChain()` | POST /api/perf-test/chains/run | Execute chain |

#### TestApiController (Development)

Provides test endpoints for development and testing:

| Method | Route | Description |
|--------|-------|-------------|
| `health()` | GET /api/test/health | Health check |
| `echo()` | ANY /api/test/echo | Echo request |
| `delay()` | GET /api/test/delay | Simulated delay |
| `status()` | GET /api/test/status/{code} | Return status code |
| `users()` | GET /api/test/users | List users |
| `user()` | GET /api/test/users/{id} | Get user |
| `userPosts()` | GET /api/test/users/{id}/posts | Get user posts |
| `login()` | POST /api/test/login | Simulated auth |
| `protectedResource()` | GET /api/test/protected | Protected endpoint |
| `createOrder()` | POST /api/test/orders | Create order |
| `random()` | GET /api/test/random | Random data |

### Request Flow

```
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │ POST /api/perf-test/run
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ApiTestController::runTest()                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse JSON request body                                  │
│ 2. Validate URL and parameters                              │
│ 3. Build authentication headers                             │
│ 4. Execute load test via runLoadTest()                      │
│ 5. Calculate statistics via buildResults()                  │
│ 6. Evaluate assertions (if provided)                        │
│ 7. Return JSON response                                     │
└─────────────────────────────────────────────────────────────┘
```

### Request Chain Flow

```
┌─────────────────┐
│  ChainBuilder   │
└────────┬────────┘
         │ POST /api/perf-test/chains/run
         │ {steps: [...], globalVariables: {...}}
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ApiTestController::runChain()                                │
├─────────────────────────────────────────────────────────────┤
│ 1. Initialize variables = globalVariables                   │
│ 2. For each step:                                           │
│    a. Replace {{variables}} in URL, headers, body           │
│    b. Execute HTTP request                                  │
│    c. Extract values via JSONPath                           │
│    d. Store in variables for next step                      │
│    e. Return response with body + headers                   │
│ 3. Return all step results + final variables                │
└─────────────────────────────────────────────────────────────┘
```

### Performance Testing Engine

Uses **Guzzle Pool** for concurrent request execution:

```php
$pool = new Pool($client, $requestsGenerator, [
    'concurrency' => $concurrency,  // Max concurrent requests
    'options' => [
        'on_stats' => function (TransferStats $stats): void {
            // Collect: total_time, namelookup_time, connect_time,
            //          appconnect_time, starttransfer_time, pretransfer_time
        },
    ],
    'fulfilled' => function (ResponseInterface $response, $index): void {
        // Store: status, headers, body size
    },
    'rejected' => function ($reason, $index): void {
        // Handle connection errors, timeouts
    },
]);
```

**Metrics Collected:**

| Metric | Description |
|--------|-------------|
| `total_time` | Complete request duration |
| `namelookup_time` | DNS resolution |
| `connect_time` | TCP connection establishment |
| `appconnect_time` | TLS/SSL handshake |
| `starttransfer_time` | Time to First Byte (TTFB) |
| `pretransfer_time` | Time before transfer starts |

### Entity Layer

All entities use Drupal's Content Entity API with `admin_permission = "administer site configuration"`.

#### ApiTestConfig (Saved Presets)

```yaml
Fields:
  - name: string          # Preset name
  - url: string           # API endpoint URL
  - method: string        # HTTP method
  - config_json: string   # JSON: {headers, params, body, auth*}
  - created: timestamp    # Creation date
```

#### ApiSnapshot (Version History)

```yaml
Fields:
  - config_id: string           # Parent preset ID
  - snapshot_name: string       # Version label
  - version_number: integer     # Auto-incremented
  - request_config: string      # JSON request details
  - response_body: string       # Full response body
  - response_headers: string    # JSON headers
  - status_code: integer        # HTTP status
  - response_time: float        # Mean response time (ms)
  - performance_metrics: string # JSON: {stats, bottleneck}
  - notes: string               # User notes
  - created: timestamp          # Creation date
```

#### RequestChain (Chain Definitions)

```yaml
Fields:
  - name: string           # Chain name
  - description: string    # Optional description
  - steps_json: string     # JSON array of steps
  - created: timestamp     # Creation date
  - changed: timestamp     # Last modified
```

#### Assertion (Validation Rules)

```yaml
Fields:
  - config_id: string          # Parent preset ID
  - assertion_type: string     # status_code|response_time|json_path|header
  - field_path: string         # JSONPath or header name
```

#### EnvironmentProfile (Environment Management)

```yaml
Fields:
  - name: string           # Environment name (e.g., "Production")
  - base_url: string       # Base URL for API calls
  - color: string          # Color code (green|yellow|red|blue|gray)
  - variables: string      # JSON array of {key, value} pairs
  - is_active: boolean     # Active environment flag
  - operator: string           # equals|contains|gt|lt|gte|lte|exists|not_exists
  - expected_value: string     # Expected value
  - enabled: boolean           # Active/inactive
```

## Frontend Architecture

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.x | Build tool & dev server |
| Tailwind CSS | 4.x | Utility-first styling |
| Radix UI | - | Accessible primitives |
| shadcn/ui | - | Component library |
| Recharts | - | Data visualization |
| Prism.js | - | Syntax highlighting |

### Component Hierarchy

```
App.tsx (Main Component)
├── Sidebar Navigation
│   ├── View selector (Tester, Discovery, Snapshots, Bulk, Chains, Settings)
│   └── Settings panel
│
├── Main Content Area
│   ├── TesterView (default)
│   │   ├── URL Input + Method Selector
│   │   ├── Saved Configs Dropdown
│   │   ├── Request Tabs (Params, Headers, Body, Auth, Assertions)
│   │   ├── Run Button + Progress
│   │   └── Results Panel
│   │       ├── Summary Cards
│   │       ├── Load Summary Chart (VUs, RPS, Phases)
│   │       ├── Performance Trends Chart (Latency, Throughput, Stability)
│   │       ├── Throughput Gauge (RPS circular gauge)
│   │       ├── Latency Percentiles (with grades, P99/P50 ratio)
│   │       ├── Latency Heatmap (Distribution over time)
│   │       ├── Timing Breakdown (bottleneck analysis)
│   │       └── Response Inspector (Headers, Body, Preview)
│   │
│   ├── DiscoveryView
│   │   └── Discovered APIs List
│   │
│   ├── SnapshotsView
│   │   ├── Snapshot List
│   │   └── Comparison Modal
│   │
│   ├── BulkTestView
│   │   └── Multi-config test runner
│   │
│   ├── ConfigManagerView (NEW)
│   │   ├── Tabs (Presets, Chains, Environments)
│   │   ├── Presets Tab
│   │   │   ├── Group selection checkboxes
│   │   │   ├── Search & filter by method
│   │   │   └── Bulk delete/export
│   │   ├── Chains Tab
│   │   │   └── Chain list with search
│   │   └── Environments Tab
│   │       ├── Environment cards (color-coded)
│   │       ├── Set Active button
│   │       ├── Clone environment
│   │       └── Variables management
│   │
│   ├── ChainBuilderView
│   │   ├── Global Variables Panel
│   │   ├── Saved Chains List
│   │   ├── Extracted Variables Panel
│   │   ├── Step Cards (expandable)
│   │   │   ├── URL + Method
│   │   │   ├── Headers Tab
│   │   │   ├── Body Tab
│   │   │   ├── Extractions Tab
│   │   │   └── Response Viewer (Body/Headers with CodeSnippet)
│   │   └── Run/Save Controls
│   │
│   └── SettingsView
│       └── Global configuration form
│
└── Toast Notifications
```

### State Management

React useState hooks manage all state. Key state variables:

```typescript
// Request Configuration
const [url, setUrl] = useState('')
const [method, setMethod] = useState<HttpMethod>('GET')
const [requestHeaders, setRequestHeaders] = useState<KeyValue[]>([])
const [queryParams, setQueryParams] = useState<KeyValue[]>([])
const [requestBody, setRequestBody] = useState('')
const [authType, setAuthType] = useState<AuthType>('none')
const [assertions, setAssertions] = useState<Assertion[]>([])

// Test Execution
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [result, setResult] = useState<TestResult | null>(null)

// Application State
const [mainView, setMainView] = useState<ViewType>('tester')
const [savedConfigs, setSavedConfigs] = useState<SavedApiConfig[]>([])
const [snapshots, setSnapshots] = useState<Snapshot[]>([])
```

### ChainBuilderView State

```typescript
const [steps, setSteps] = useState<ChainStep[]>([...])
const [globalVariables, setGlobalVariables] = useState<KeyValue[]>([
    { key: 'base_url', value: 'https://example.com' }
])
const [result, setResult] = useState<ChainResult | null>(null)
```

### API Communication

All API calls use the Fetch API with CSRF token:

```typescript
const csrfToken = window.drupalSettings?.api_insight_lab?.csrf_token;

const response = await fetch('/api/perf-test/run', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken || ''
  },
  body: JSON.stringify(payload)
});

const text = await response.text();
const data = JSON.parse(text); // Safe parsing with error handling
```

## Data Models

### Test Result Response

```typescript
interface TestResult {
  success: boolean;
  stats: {
    requests: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    rps: number;           // Requests per second
    mean: number;          // Average response time (ms)
    median: number;
    min: number;
    max: number;
    stddev: number;
    p95: number;
    p99: number;
    cacheHits: number;
    cacheMisses: number;
  };
  bottleneck: {
    dns: number;
    tcp: number;
    tls: number;
    server: number;
    download: number;
  };
  chartData: {
    responseTime: { labels: string[]; totalTime: number[]; ttfb: number[] };
    percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
  };
  firstResponse: {
    status: number;
    headers: Record<string, string[]>;
    size: number;
    body: string;
  };
  assertions?: Array<{
    type: string;
    operator: string;
    expected: string;
    actual: any;
    passed: boolean;
    message: string;
  }>;
}
```

### Chain Result Response

```typescript
interface ChainResult {
  success: boolean;
  steps: StepResult[];
  variables: Record<string, any>;
  totalDuration: number;
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
```

## Build & Deployment

### Development

```bash
cd react-ui
npm install
npm run dev    # Start Vite dev server with HMR
```

Dev server runs on port 5173 and proxies API requests to Drupal.

### Production Build

```bash
cd react-ui
npm run build
```

**Build Process:**
1. TypeScript compilation (`tsc -b`)
2. Vite bundling with Rollup
3. CSS processing with Tailwind
4. Output to `../js/react-app/`

**Output:**
- `js/react-app/app.js` - Single bundle (~920KB, ~272KB gzipped)
- `js/react-app/app.css` - Compiled styles (~70KB, ~12KB gzipped)

### After Code Changes

```bash
# Rebuild frontend
cd web/modules/custom/api_insight_lab/react-ui
npm run build

# Clear Drupal cache
drush cr
```

### Entity Schema Updates

If entity definitions change:

```bash
# Install new entity types
drush php:eval "\Drupal::entityDefinitionUpdateManager()->installEntityType(\Drupal::entityTypeManager()->getDefinition('request_chain'));"
```

## Security Model

### Access Control

- All routes require `administer site configuration` permission
- All entities define `admin_permission` in annotations
- CSRF tokens validated on all POST requests

### Request Security

- URLs validated with `filter_var(FILTER_VALIDATE_URL)`
- Total requests capped at 20,000 per test
- Timeout configurable (1-120 seconds)

### Data Security

- Entity API prevents SQL injection
- React auto-escapes XSS in output
- Sensitive credentials should use secrets management
- Password fields support show/hide toggle

## Performance Considerations

### Backend Optimizations

- **Connection Pooling**: Guzzle reuses connections
- **Async Execution**: Non-blocking concurrent requests
- **Streaming Stats**: Metrics collected during transfer
- **Memory Limits**: Response bodies truncated at 10KB

### Frontend Optimizations

- **Code Splitting**: Views can be lazy-loaded
- **Memoization**: Expensive calculations cached
- **Virtual Scrolling**: Large result sets paginated
- **Debouncing**: Input handlers debounced

### Recommended Limits

| Parameter | Recommended Max | Hard Limit |
|-----------|-----------------|------------|
| Virtual Users | 50 | 100 |
| Iterations per VU | 200 | 1,000 |
| Total Requests | 5,000 | 20,000 |
| Timeout | 30s | 120s |
| Response Body | 10KB | 10KB (truncated) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

GPL-2.0-or-later
