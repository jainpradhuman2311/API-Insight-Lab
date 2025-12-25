# API Insight Lab - User Manual

A comprehensive guide to using the API Insight Lab module effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Running Your First Test](#running-your-first-test)
3. [Understanding Results](#understanding-results)
4. [Request Configuration](#request-configuration)
5. [Authentication](#authentication)
6. [Assertions](#assertions)
7. [Environment Management](#environment-management)
8. [Environment Variables](#environment-variables)
9. [Request Chains](#request-chains)
10. [Config Manager](#config-manager)
11. [Snapshots & History](#snapshots--history)
12. [Settings](#settings)
13. [Test APIs](#test-apis)
14. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Accessing the Module

1. Log in to your Drupal site as an administrator
2. Navigate to: **Administration → Configuration → Development → API Insight Lab**
3. Or go directly to: `/admin/config/development/api-perf-tester`

### Interface Overview

The interface has a sidebar with navigation icons:

| Icon | View | Description |
|------|------|-------------|
| 🏠 Home | Tester | Main API testing interface |
| 🔍 Search | Discovery | Discover available REST APIs |
| 📷 Camera | Snapshots | View and compare saved snapshots |
| 📋 List | Bulk Test | Run multiple tests at once |
| 🔗 Chain | Request Chains | Create multi-step request workflows |
| 📁 Folder | Config Manager | Export, import, and manage environments |
| ⚙️ Settings | Settings | Configure global defaults |

---

## Running Your First Test

### Step 1: Enter the URL

In the URL field, enter:
- **Relative URL**: `/jsonapi/node/article` (uses base URL from settings)
- **Full URL**: `https://example.com/api/endpoint`

### Step 2: Select HTTP Method

Choose from the dropdown:
- **GET** - Retrieve data
- **POST** - Create data
- **PUT** - Update data (replace)
- **PATCH** - Update data (partial)
- **DELETE** - Remove data

### Step 3: Configure Load Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Virtual Users (VUs)** | Number of concurrent connections | 1 |
| **Iterations per VU** | Requests each VU makes | 1 |

**Example**: 10 VUs × 5 iterations = 50 total requests

### Step 4: Run the Test

Click the **▶ Run Test** button. You'll see:
- Progress indicator during execution
- Results panel with metrics and charts when complete

### Phased Load Testing (Advanced)

Toggle the **Phased Load Testing** switch for more realistic load simulation.

#### Test Presets
- **📈 Standard Load**: Gradual ramp-up (5s warmup → 10s ramp → 30s sustain → 5s ramp-down)
- **⚡ Spike Test**: Instant burst to max VUs (tests sudden traffic surges)
- **🔥 Stress Test**: Extended high load to test stability

#### Phase Configuration
You can manually adjust the durations for each phase:
- **Warmup**: Initial period with low load (default 20% VUs)
- **Ramp Up**: Gradually increases VUs to 100%
- **Sustain**: Maintains 100% VUs
- **Ramp Down**: Gradually decreases VUs

> **Note**: The total number of requests is capped at `VUs × Iterations`. If the phase durations are too long for the iteration count, the test will finish early when the request limit is reached.

---

## Understanding Results

### Results Dashboard

#### Summary Metrics (Top Cards)
| Metric | Description |
|--------|-------------|
| **VUs Created** | Total Virtual Users configured for the test |
| **Avg RPS** | Average Requests Per Second throughout the test |
| **Peak RPS** | Maximum throughput achieved (highest 1s window) |
| **Error Rate** | Percentage of failed requests |

#### Interactive Charts
**1. Load Summary (Combined)**
- Shows active VUs (purple) vs RPS (orange) over time
- Displays phase markers (Warmup, Sustain, etc.) for phased tests
- Toggle metrics (VUs, RPS, P95, P99) visibility

**2. Performance Trends**
- Real-time line chart comparing Latency vs Throughput
- **Detailed Insights** below chart:
    - **Peak RPS**: Maximum throughput achieved
    - **Min/Peak Latency**: Best and worst response times
    - **Stability**: Score (Stable/Moderate/Volatile) based on RPS variance

**3. Throughput Gauge**
- Circular gauge showing current RPS
- Color-coded performance levels:
    - 🟢 Excellent (≥100 RPS)
    - 🔵 Good (≥50 RPS)
    - 🟠 Moderate (≥20 RPS)
    - 🔴 Low (<20 RPS)

**4. Latency Distribution (Heatmap)**
- Visualizes response time distribution over the test duration
- Helps identify specific periods of high latency

### Latency Percentiles

Shows response time distribution:

| Percentile | Meaning |
|------------|---------|
| **P50** | 50% of requests faster than this |
| **P75** | 75% of requests faster than this |
| **P90** | 90% of requests faster than this |
| **P95** | 95% of requests faster than this |
| **P99** | 99% of requests faster than this |

**Performance Grades:**
- 🟢 **Excellent**: P95 < 100ms
- 🟡 **Good**: P95 < 300ms
- 🟠 **Fair**: P95 < 1000ms
- 🔴 **Slow**: P95 ≥ 1000ms

### Timing Breakdown (Bottleneck Analysis)

Shows where time is spent:

| Metric | Description |
|--------|-------------|
| **DNS** | Domain name resolution |
| **TCP** | TCP connection establishment |
| **TLS** | SSL/TLS handshake |
| **Server** | Server processing (TTFB) |
| **Download** | Response transfer time |

### Response Inspector

Tabs to view the first response:
- **Headers**: Response headers in raw format
- **Body**: Response body with syntax highlighting
- **Preview**: Rendered HTML (for HTML responses)

---

## Request Configuration

### Query Parameters

1. Click the **Params** tab
2. Click **+ Add Parameter**
3. Enter key-value pairs

Example:
| Key | Value |
|-----|-------|
| `page` | `1` |
| `limit` | `10` |
| `filter[status]` | `published` |

### Request Headers

1. Click the **Headers** tab
2. Click **+ Add Header**
3. Enter header name and value

Common headers:
| Header | Example Value |
|--------|--------------|
| `Content-Type` | `application/json` |
| `Accept` | `application/vnd.api+json` |
| `X-Custom-Header` | `your-value` |

### Request Body

1. Click the **Body** tab
2. Select body type:
   - **None**: No body
   - **JSON**: JSON object
   - **Form Data**: Key-value pairs
   - **Raw**: Plain text

Example JSON body:
```json
{
  "data": {
    "type": "node--article",
    "attributes": {
      "title": "New Article"
    }
  }
}
```

### cURL Import

1. Click the **Import cURL** button
2. Paste your cURL command
3. Click **Import**

The module parses:
- URL
- Method
- Headers
- Body

---

## Authentication

### No Authentication

Default option. No credentials sent.

### Basic Auth

1. Select **Basic** from the Auth dropdown
2. Enter username
3. Enter password (click 👁 to show/hide)

### Bearer Token

1. Select **Bearer** from the Auth dropdown
2. Enter the token (click 👁 to show/hide)

Common tokens:
- JWT tokens
- OAuth2 access tokens
- API keys

### API Key

1. Select **API Key** from the Auth dropdown
2. Enter the header name (e.g., `X-API-Key`)
3. Enter the key value

---

## Assertions

Assertions validate API responses automatically.

### Adding Assertions

1. Click the **Assertions** tab
2. Click **+ Add Assertion**
3. Configure:
   - **Type**: What to validate
   - **Field Path**: Where to look (for JSON/Header types)
   - **Operator**: How to compare
   - **Expected Value**: What to expect

### Assertion Types

| Type | Description | Example |
|------|-------------|---------|
| **Status Code** | HTTP status code | 200, 201, 404 |
| **Response Time** | Max allowed time (ms) | 500 |
| **JSON Path** | Value in JSON response | `$.data.id` |
| **Header** | Response header value | `Content-Type` |

### Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact match |
| `contains` | Contains substring |
| `gt` | Greater than |
| `lt` | Less than |
| `gte` | Greater than or equal |
| `lte` | Less than or equal |
| `exists` | Field exists |
| `not_exists` | Field doesn't exist |

### Example Assertions

**Status code is 200:**
- Type: Status Code
- Operator: equals
- Value: 200

**Response time under 500ms:**
- Type: Response Time
- Operator: lt
- Value: 500

**JSON field exists:**
- Type: JSON Path
- Path: `$.data.id`
- Operator: exists

---

## Environment Management

Environments let you easily switch between different servers (Dev, Staging, Prod).

### Creating an Environment

1. Click the **📁 Config Manager** icon in the sidebar
2. Click the **Environments** tab
3. Click **Add Environment**
4. Configure:
   - **Name**: Environment name (e.g., "Production")
   - **Base URL**: Full base URL (e.g., `https://api.prod.example.com`)
   - **Color**: Visual indicator (green=Dev, yellow=Staging, red=Prod)
5. Click **Save**

### Setting Active Environment

1. In the Environments tab, click **Set Active** on the desired environment
2. Or use the dropdown in the Load Tester header to switch quickly

Active environment is indicated by a ✓ badge.

### Environment Features

| Feature | Description |
|---------|-------------|
| **Color Coding** | Visual distinction (green, yellow, red, blue, gray) |
| **Quick Switch** | Dropdown in Load Tester header |
| **Clone** | Duplicate existing environment |
| **Variables** | Store API keys and tokens per environment |

---

## Environment Variables

Store sensitive data (API keys, tokens) per environment and use them in your requests.

### Adding Variables

1. Edit an environment
2. Click **+ Add Variable**
3. Enter **Key** (e.g., `API_KEY`) and **Value** (e.g., `your-secret-key`)
4. Click **Save**

### Using Variables in Requests

Use `{{VARIABLE_NAME}}` syntax anywhere in your request:

| Location | Example |
|----------|---------|
| **URL** | `/api/users?key={{API_KEY}}` |
| **Header Value** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | `{"api_key": "{{API_KEY}}"}` |
| **Query Parameter** | Value: `{{SECRET}}` |
| **Auth Token** | `{{MY_TOKEN}}` |

### How It Works

1. **Type** `{{API_KEY}}` in any field
2. **When you run the test**, it gets replaced with the actual value from the active environment
3. **When you copy cURL**, it also uses the replaced value

> **Note**: The input field still shows `{{API_KEY}}` for editing. Replacement happens on test execution.

---

## Request Chains

Chain multiple API requests together, passing data between them.

### Accessing Request Chains

1. Click the **🔗 Chain** icon in the sidebar
2. Or navigate to: `/admin/config/development/api-perf-tester` and select Chains

### Creating a Chain

#### Step 1: Add Steps

1. Click **+ Add Step**
2. Configure each step:
   - **Step Name**: Descriptive name (e.g., "Login")
   - **Method**: GET, POST, etc.
   - **URL**: Full URL or use `{{base_url}}/path`

#### Step 2: Define Global Variables

In the **Global Variables** panel:
1. Click **+ Add Variable**
2. Enter name and value

Example:
| Name | Value |
|------|-------|
| `base_url` | `https://my-lando-app.lndo.site` |
| `api_key` | `sk_live_abc123` |
| `user_email` | `test@example.com` |

#### Step 3: Configure Extractions

To pass data from one step to another:

1. Expand the step
2. Click **Extractions** tab
3. Click **+ Add Extraction**
4. Configure:
   - **Variable Name**: Name for the extracted value (e.g., `user_id`)
   - **Source**: Body (JSON), Header, or Status
   - **Path**: JSONPath to the value (e.g., `$.users[0].id`)

#### Step 4: Use Variables

In subsequent steps, use `{{variable}}` syntax:

- **URL**: `{{base_url}}/api/test/users/{{user_id}}`
- **Headers**: `Authorization: Bearer {{token}}`
- **Body**: `{"user_id": "{{user_id}}"}`

### Example Chain: User Login Flow

**Step 1: Login**
```
Method: POST
URL: {{base_url}}/api/test/login
Body: {"username": "admin", "password": "secret"}
Extract: token from $.token
```

**Step 2: Get Protected Resource**
```
Method: GET
URL: {{base_url}}/api/test/protected
Header: Authorization: Bearer {{token}}
```

**Step 3: Get User Profile**
```
Method: GET
URL: {{base_url}}/api/test/users/1
```

### Running & Saving Chains

- Click **Run Chain** to execute all steps
- Click **Save Chain** to save for later
- View responses in the **Body** and **Headers** tabs for each step

### JSONPath Reference

| Expression | Description | Example |
|------------|-------------|---------|
| `$.prop` | Root property | `$.token` |
| `$.obj.prop` | Nested property | `$.data.id` |
| `$.arr[0]` | First array item | `$.users[0]` |
| `$.arr[*]` | All array items | `$.users[*].id` |
| `$.arr[0].prop` | Property of first item | `$.users[0].id` |

---

## Config Manager

The Config Manager provides centralized management for all your presets, chains, and environments.

### Accessing Config Manager

Click the **📁 Config Manager** icon in the sidebar.

### Tabs

| Tab | Description |
|-----|-------------|
| **Presets** | View/manage saved API test configurations |
| **Request Chains** | View/manage multi-step request chains |
| **Environments** | Manage environment profiles (Dev, Staging, Prod) |

### Bulk Operations

**Selecting Items:**
- Click the checkbox next to a group to select all items in that group
- Click individual checkboxes to select specific items

**Actions:**
- **Export**: Export selected presets and chains to JSON file
- **Delete**: Delete selected items

### Exporting Configurations

1. Select presets and/or chains
2. Click **Export**
3. In the dialog:
   - Choose whether to **Include authentication data** (passwords, tokens)
4. Click **Export** to download the JSON file

### Importing Configurations

1. Click **Import**
2. Select a JSON file
3. Map URLs if needed (for different environments)
4. Choose whether to **Replace existing presets** (same name = overwrite)
5. Click **Import**

### Search & Filter

- **Search**: Filter by name or URL
- **Method Filter**: Show only specific HTTP methods (GET, POST, etc.)

---

## Snapshots & History

### Saving a Snapshot

1. After running a test, click **Save Snapshot**
2. Enter a name and optional notes
3. Click **Save**

Snapshots include:
- Request configuration
- Response data
- Performance metrics
- Timestamp

### Viewing Snapshots

1. Click the **📷 Snapshots** icon in the sidebar
2. View list of saved snapshots
3. Click a snapshot to view details

### Comparing Snapshots

1. Select two snapshots
2. Click **Compare**
3. View side-by-side:
   - Performance metrics
   - Response body diff

---

## Settings

### Accessing Settings

1. Click the **⚙️ Settings** icon in the sidebar
2. Or click the gear icon in any view

### Global Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Base URL** | Default URL prefix | `https://your-site.com` |
| **Default Timeout** | Request timeout (seconds) | 30 |
| **Default Concurrency** | Default VUs | 1 |
| **Default Method** | Default HTTP method | GET |

### Default Authentication

Configure credentials that apply to all tests:

- **Basic Auth**: Username and password
- **Bearer Token**: Default token

---

## Test APIs

The module includes built-in test endpoints for development:

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test/health` | GET | Health check, returns `{"status": "ok"}` |
| `/api/test/echo` | ANY | Returns whatever you send |
| `/api/test/delay?ms=500` | GET | Simulates slow response |
| `/api/test/status/404` | GET | Returns specified status code |
| `/api/test/users` | GET | List of test users |
| `/api/test/users/1` | GET | User by ID |
| `/api/test/users/1/posts` | GET | User's posts |
| `/api/test/login` | POST | Returns auth token |
| `/api/test/protected` | GET | Requires Bearer token |
| `/api/test/orders` | POST | Create order |
| `/api/test/random` | GET | Random data |

### Example: Test Chain with Built-in APIs

**Global Variables:**
```
base_url = https://my-lando-app.lndo.site
```

**Step 1: Get Users**
```
GET {{base_url}}/api/test/users
Extract: user_id from $.users[0].id
```

**Step 2: Get User Details**
```
GET {{base_url}}/api/test/users/{{user_id}}
```

---

## Tips & Best Practices

### Performance Testing

- Start with low VUs (1-5) to establish baseline
- Gradually increase to find breaking points
- Run multiple iterations for consistent results
- Test at different times of day

### Request Chains

- Use meaningful variable names
- Test each step individually first
- Check JSONPath syntax with online validators
- Use global variables for environment-specific values

### Security

- Don't store production credentials in presets
- Use environment variables for sensitive data
- Clear cache after testing with credentials
- Test on staging, not production

### Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 errors | Clear Drupal cache: `drush cr` |
| Variable not replaced | Check JSONPath syntax, ensure extraction ran |
| Slow UI | Reduce VUs or iterations |
| Auth failures | Verify credentials, check token expiry |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Run test |
| `Ctrl/Cmd + S` | Save preset |

---

## Support

- **Issue Queue**: Report bugs and request features
- **Documentation**: Full technical docs in STRUCTURE.md
- **Contributing**: See CONTRIBUTING.md

---

**Happy Testing! 🚀**
