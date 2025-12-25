# API Insight Lab

The API Insight Lab module provides a comprehensive API performance testing and
monitoring solution for Drupal. It enables developers to run load tests,
validate API responses with assertions, chain multiple requests together, save
response snapshots for comparison, and manage multiple environment profiles.

Built with a modern React frontend providing a Postman-like interface and
powered by Guzzle's concurrent request handling for high-performance testing.

For a full description of the module, visit the project page (custom module).

Submit bug reports and feature suggestions in the issue queue (if published).

## Table of contents

- Requirements
- Recommended modules
- Installation
- Configuration
- Features
- Troubleshooting
- FAQ
- Maintainers

## Requirements

This module requires the following:

- Drupal 10.0 or higher, or Drupal 11.0 or higher
- PHP 8.1 or higher
- GuzzleHTTP (included with Drupal core)
- Modern browser with JavaScript enabled

## Recommended modules

- [REST UI](https://www.drupal.org/project/restui): Provides a user interface
  for managing REST resources, useful for the API discovery feature.

## Installation

Install as you would normally install a contributed Drupal module. For further
information, see
[Installing Drupal Modules](https://www.drupal.org/docs/extending-drupal/installing-drupal-modules).

### Via Composer

```bash
composer require drupal/api_insight_lab
drush en api_insight_lab -y
drush cr
```

### Manual Installation

1. Download and extract to `modules/custom/api_insight_lab/`
2. Enable the module:
   ```bash
   drush en api_insight_lab -y
   drush cr
   ```

### Frontend Development (Optional)

If modifying the React UI:

```bash
cd web/modules/custom/api_insight_lab/react-ui
npm install
npm run build
```

## Configuration

1. Navigate to Administration » Configuration » Development » API Insight Lab
   (`/admin/config/development/api-insight-lab`).
2. The module requires the "Administer site configuration" permission to access
   the testing interface.
3. Configure default settings in the Settings view:
   - Base URL for API requests
   - Default authentication type (None, Basic, Bearer, API Key)
   - Default timeout and concurrency values

## Features

### Load Testing

The Load Tester provides comprehensive API performance testing capabilities:

- **Virtual Users (VUs)**: Configure concurrent users from 1 to 100
- **Iterations**: Set the number of requests per VU (1 to 1000)
- **HTTP Methods**: Support for GET, POST, PUT, DELETE, and PATCH
- **Request Body**: JSON, form-data, and raw body formats
- **Authentication**: Basic Auth, Bearer Token, and API Key support
- **Headers**: Add custom request headers
- **Query Parameters**: Configure URL query parameters
- **Cache Bypass**: Option to bypass Drupal cache with unique request IDs
- **Timeout**: Configurable request timeout (1-120 seconds)

#### Phased Load Testing

Enable sophisticated load patterns with phase configuration:

- **Warmup Phase**: Start with a percentage of max VUs to warm up the system
- **Ramp-up Phase**: Gradually increase VUs to maximum over specified duration
- **Sustain Phase**: Maintain peak load for testing stability
- **Ramp-down Phase**: Gradually decrease VUs to simulate traffic reduction

Presets available:
- Standard Load: Balanced test for normal traffic simulation
- Stress Test: Aggressive ramp-up to find breaking points
- Spike Test: Instant burst mode for sudden traffic surges

### Performance Metrics

After running a test, view comprehensive metrics:

- **Dashboard Cards**: VUs, Average RPS, Peak RPS, Error Rate
- **Load Summary Chart**: Interactive chart showing VUs vs RPS with phase markers
- **Response Time Distribution**: Min, Max, Mean, Median, Standard Deviation
- **Percentiles**: P50, P75, P90, P95, P99 latency values
- **Bottleneck Analysis**: DNS, TCP, TLS, Server Processing, Download timing
- **Cache Analytics**: Track Drupal cache hits/misses via `X-Drupal-Cache` header
- **Performance Grades**: Automatic grading (Excellent, Good, Acceptable, Slow)

### Snapshots

Save and compare API response snapshots to track changes over time:

#### Creating Snapshots
1. Run a test in the Load Tester
2. Click "Save Snapshot" in the results panel
3. Enter a descriptive name for the snapshot
4. The snapshot stores: URL, method, headers, response body, response time,
   status code, and performance metrics

#### Viewing Snapshots
1. Navigate to the Snapshots view from the sidebar
2. Snapshots are grouped by API endpoint (URL + method)
3. Click a group to expand and see all versions
4. Click "View" to see full snapshot details including response body

#### Comparing Snapshots
1. In the Snapshots view, click "Compare Mode"
2. Select exactly two snapshots to compare
3. Click "Compare Selected"
4. View side-by-side comparison showing:
   - Performance metrics differences
   - Request configuration differences
   - Response body differences with visual diff

#### Snapshot Management
- Delete individual snapshots using the trash icon
- Snapshots are stored as Drupal entities for persistence
- Export snapshots via the Config Manager

### Environments

Manage multiple environment profiles for testing across different servers:

#### Creating Environments
1. Navigate to Config Manager from the sidebar
2. Click the "Environments" tab
3. Click "Add Environment"
4. Configure:
   - **Name**: Descriptive name (e.g., "Production API")
   - **Base URL**: The base URL for this environment (e.g., `https://api.example.com`)
   - **Color**: Visual identifier (green, yellow, red, blue, gray)
   - **Variables**: Key-value pairs for environment-specific values

#### Environment Variables
Define variables for each environment to store:
- API keys: `API_KEY=abc123`
- Auth tokens: `AUTH_TOKEN=bearer-token`
- User IDs: `TEST_USER_ID=42`

Use variables in requests with `{{VARIABLE_NAME}}` syntax:
- URL: `{{BASE_URL}}/api/users/{{TEST_USER_ID}}`
- Headers: `Authorization: Bearer {{AUTH_TOKEN}}`
- Body: `{"api_key": "{{API_KEY}}"}`

#### Switching Environments
1. In the Load Tester header, use the environment dropdown
2. Select the active environment
3. All `{{variable}}` placeholders are automatically replaced
4. Relative URLs (starting with `/`) automatically use the environment's base URL

#### Environment Colors
Visual distinction for quick identification:
- **Green**: Development environments
- **Yellow**: Staging/QA environments
- **Red**: Production environments (use with caution)
- **Blue**: Testing/sandbox environments
- **Gray**: Other/unspecified environments

### Request Chaining

Create multi-step API workflows with variable passing:

#### Creating a Chain
1. Navigate to Chain Builder from the sidebar
2. Click "Add Step" for each API request
3. Configure each step with URL, method, headers, and body
4. Define variable extractions using JSONPath

#### Variable Extraction
Extract values from responses for use in subsequent steps:
- Path: JSONPath expression (e.g., `$.data.user.id`)
- Variable Name: Name to reference (e.g., `userId`)
- Use in next steps: `{{userId}}`

Example flow:
1. POST `/login` → Extract `{{token}}` from `$.access_token`
2. GET `/user/profile` → Use `Authorization: Bearer {{token}}`
3. GET `/user/{{userId}}/orders`

#### Running Chains
1. Click "Run Chain" to execute all steps sequentially
2. View step-by-step results with response data
3. Extracted variables are shown for each step
4. Failed steps stop the chain execution

### Config Manager

Centralized management for all configurations:

#### Features
- **View All**: See presets, chains, and environments in one place
- **Search & Filter**: Filter by name, URL, or HTTP method
- **Bulk Select**: Use checkboxes to select multiple items
- **Group Selection**: Select all items in a group at once
- **Bulk Delete**: Delete multiple selected items
- **Bulk Export**: Export selected configurations

#### Export/Import
- Export configurations as JSON files
- Option to include or exclude sensitive auth data
- Import with URL mapping for environment migration
- Supports presets, chains, environments, and snapshots

### Assertions

Validate API responses automatically:

- **Status Code**: Validate HTTP status (equals, not equals)
- **Response Time**: Check latency thresholds (less than, greater than)
- **Body Contains**: Verify response contains specific text
- **JSONPath Match**: Validate specific JSON values
- **Header Check**: Verify response headers exist or match values

Operators available:
- `equals`, `not_equals`
- `contains`, `not_contains`
- `greater_than`, `less_than`
- `exists`, `not_exists`

### API Discovery

Automatically discover available REST resources:

1. Navigate to the Discovery view
2. The module scans for enabled REST resources
3. Click on a resource to populate the Load Tester
4. Useful for testing Drupal's JSON:API and REST endpoints

### UI Features

- **Dark/Light Mode**: Toggle theme from the header
- **Collapsible Sidebar**: Maximize testing workspace
- **Response Preview**: HTML rendering tab for web responses
- **Syntax Highlighting**: Color-coded JSON, HTML, and code responses
- **cURL Import**: Parse and import cURL commands directly
- **cURL Export**: Generate cURL commands from current request

## Troubleshooting

### Common Issues

**"Maximum requests exceeded" error**

Total requests (VUs × Iterations) exceeds the 100,000 limit. Reduce either the
number of Virtual Users or iterations per user.

**404 on API endpoints**

Routes may not be registered. Run `drush cr` to rebuild caches.

**Frontend not loading**

Ensure JavaScript is enabled. If developing locally, run `npm run build` in
the `react-ui/` directory.

**Database table not found**

Entity schema may not be installed. Run:
```bash
drush php:eval "\Drupal::entityDefinitionUpdateManager()->applyUpdates();"
```

**Variable extraction not working in chains**

Use correct JSONPath syntax: `$.path.to.value` (e.g., `$.data.users[0].id`).

**Environment variables not replacing**

- Ensure an environment is selected as active
- Check variable names match exactly (case-sensitive)
- Use double braces: `{{VARIABLE_NAME}}`

**Snapshots showing empty response body**

Some APIs return empty bodies or the response was too large and truncated.
Check the original test results for full response data.

## FAQ

**Q: Can I use this module in production?**

**A:** This module is intended for development and staging environments. Using
load testing in production may impact server performance and should be done
with extreme caution during low-traffic periods.

**Q: How do I import a cURL command?**

**A:** Click the "Import cURL" button in the Load Tester view, paste your cURL
command, and click Import. The module will parse and apply the URL, method,
headers, and body automatically.

**Q: How do I compare API responses over time?**

**A:** Save snapshots after running tests. Navigate to the Snapshots view,
enable Compare Mode, select two snapshots, and click "Compare Selected" to see
a side-by-side diff of response bodies and performance metrics.

**Q: How do I export my test configurations?**

**A:** Use the Config Manager view. Select the configurations you want to
export using checkboxes, click Export, and choose whether to include
authentication data. The export file is JSON format.

**Q: Can I test authenticated endpoints?**

**A:** Yes. Configure authentication in the Auth tab:
- Basic Auth: Enter username and password
- Bearer Token: Enter the access token
- API Key: Enter header name and value
You can also store auth credentials in environment variables.

**Q: How many concurrent requests can I run?**

**A:** The module supports up to 100 Virtual Users with up to 1000 iterations
each, for a maximum of 100,000 total requests per test.

**Q: How do I test across multiple environments?**

**A:** Create environment profiles in Config Manager with different base URLs
and variables. Switch between environments using the dropdown in the Load
Tester header. All requests will use the active environment's configuration.

