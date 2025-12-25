# API Insight Lab

![Module Status](https://img.shields.io/badge/status-stable-green)
![Drupal Version](https://img.shields.io/badge/drupal-10%20%7C%2011-blue)
![PHP Version](https://img.shields.io/badge/php-%5E8.1-purple)

A comprehensive Drupal module for testing and monitoring API performance, response times, and validating API responses with assertions. Built with a modern React frontend and powered by Guzzle's concurrent request handling.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### 🚀 Core Testing Capabilities
- **Load Testing**: Run concurrent requests with configurable Virtual Users (VUs) and iterations
- **Multiple HTTP Methods**: Full support for GET, POST, PUT, DELETE, and PATCH
- **Authentication**: Built-in support for Basic Auth, Bearer Token, and API Key
- **Request Customization**: Configure headers, query parameters, and request body (JSON, form-data, raw)
- **cURL Import**: Parse and import cURL commands directly

### 📉 Phased Load Testing (NEW!)
- **Load Presets**: Standard Load, Stress Test, and Spike Test modes
- **Phase Configuration**: Customizable Warmup, Ramp-up, Sustain, and Ramp-down durations
- **Visual Analytics**: Interactive charts showing phase transitions and real-time load
- **Spike Functionality**: Instant burst mode for testing sudden traffic surges

### 📊 Performance Metrics
- **Dashboard Overview**: Key metrics cards showing VUs, Avg RPS, Peak RPS, and Error Rate
- **Load Summary**: Interactive chart showing VUs vs RPS trend with phase markers
- **Throughput Gauge**: Visual gauge for Requests Per Second (RPS) with performance grading
- **Performance Trends**: Real-time line chart tracking latency and throughput
- **Comprehensive Statistics**: Min, max, mean, median, standard deviation, P50-P99 percentiles
- **Bottleneck Analysis**: DNS lookup, TCP connection, TLS handshake, server processing, download time
- **Cache Analytics**: Track Drupal cache hits/misses via `X-Drupal-Cache` header
- **Detailed Insights**: Peak RPS, Min/Peak Latency, and Stability scoring

### ✅ Automated Validation
- **Assertions**: Validate responses with status codes, response times, JSONPath matching, headers
- **Multiple Operators**: equals, contains, gt, lt, exists, not_exists, and more

### 🔗 Request Chaining (NEW!)
- **Multi-Step Chains**: Link multiple API requests together
- **Variable Extraction**: Extract values from responses using JSONPath (e.g., `$.users[0].id`)
- **Global Variables**: Define reusable variables like `{{base_url}}`, `{{api_key}}`
- **Dynamic Substitution**: Use `{{variableName}}` in URLs, headers, and body
- **Response Inspector**: View full response body and headers for each step

### 💾 Configuration Management
- **Saved Presets**: Save and load complete test configurations
- **Snapshot Management**: Version history with comparison and diff tools
- **API Discovery**: Automatically discover enabled REST resources
- **Export/Import**: Export configs with optional auth data, import with URL mapping

### 🌐 Environment Management (NEW!)
- **Multiple Environments**: Create Dev, Staging, Prod profiles
- **Quick Switch**: Dropdown in Load Tester header
- **Color Coding**: Visual distinction (green, yellow, red, blue, gray)
- **Environment Variables**: Store API keys/tokens per environment
- **Variable Substitution**: Use `{{API_KEY}}` syntax in URLs, headers, body
- **Auto Base URL**: Relative URLs automatically get environment base URL

### 📁 Config Manager (NEW!)
- **Centralized Management**: Single view for presets, chains, and environments
- **Bulk Operations**: Select groups/items, bulk delete/export
- **Search & Filter**: Filter by name, URL, or HTTP method
- **Export Dialog**: Choose whether to include sensitive auth data

### 🎨 Modern UI
- **Dark/Light Mode**: Full theme support
- **Postman-like Interface**: Familiar tabbed interface
- **Response Preview**: HTML preview tab for rendering responses
- **Code Highlighting**: Syntax-highlighted response bodies

## Requirements

| Requirement | Version |
|-------------|---------|
| Drupal Core | ^10.0 \|\| ^11.0 |
| PHP | ^8.1 |
| GuzzleHTTP | (included with Drupal core) |
| Browser | Modern browser with JavaScript enabled |

## Installation

### Via Composer (Recommended)

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

## Quick Start

1. Navigate to `/admin/config/development/api-perf-tester`
2. Enter an API URL (e.g., `/jsonapi/node/article`)
3. Click **Run Test**
4. View results with performance metrics, charts, and response data

For detailed usage instructions, see **[USER_MANUAL.md](USER_MANUAL.md)**.

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Overview and quick start (this file) |
| [USER_MANUAL.md](USER_MANUAL.md) | Detailed user guide with step-by-step instructions |
| [STRUCTURE.md](STRUCTURE.md) | Architecture and technical documentation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

## API Reference

### Test Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/perf-test/run` | Execute performance test |
| GET | `/api/perf-test/settings` | Get global settings |
| POST | `/api/perf-test/settings` | Save global settings |

### Preset Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/perf-test/presets` | List all presets |
| POST | `/api/perf-test/presets` | Create preset |
| DELETE | `/api/perf-test/presets/{id}` | Delete preset |

### Snapshot Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/perf-test/snapshots` | List all snapshots |
| POST | `/api/perf-test/snapshots` | Create snapshot |
| GET | `/api/perf-test/snapshots/{id}` | Get snapshot details |
| DELETE | `/api/perf-test/snapshots/{id}` | Delete snapshot |
| GET | `/api/perf-test/snapshots/compare/{id1}/{id2}` | Compare two snapshots |

### Request Chains

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/perf-test/chains` | List all chains |
| POST | `/api/perf-test/chains` | Create chain |
| PUT | `/api/perf-test/chains/{id}` | Update chain |
| DELETE | `/api/perf-test/chains/{id}` | Delete chain |
| POST | `/api/perf-test/chains/run` | Execute chain |

### Environment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/perf-test/environments` | List all environments |
| POST | `/api/perf-test/environments` | Create/update environment |
| DELETE | `/api/perf-test/environments/{id}` | Delete environment |
| POST | `/api/perf-test/environments/active` | Set active environment |

### Export/Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/perf-test/export` | Export configs (with auth option) |
| POST | `/api/perf-test/import` | Import configs |

### Test APIs (for Development)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/test/health` | Health check |
| POST | `/api/test/echo` | Echo request data |
| GET | `/api/test/delay?ms=500` | Simulated delay |
| GET | `/api/test/status/{code}` | Return specific status code |
| GET | `/api/test/users` | Get test users |
| GET | `/api/test/users/{id}` | Get user by ID |
| GET | `/api/test/users/{id}/posts` | Get user's posts |
| POST | `/api/test/login` | Simulated login (returns token) |
| GET | `/api/test/protected` | Protected resource (requires Bearer token) |
| POST | `/api/test/orders` | Create test order |
| GET | `/api/test/random` | Random data generator |

## Troubleshooting

### Common Issues

**"Maximum requests exceeded" error**
- Total requests (VUs × Iterations) exceeds 20,000
- Solution: Reduce either VUs or iterations

**404 on API endpoints**
- Routes not registered
- Solution: Run `drush cr` to clear caches

**Frontend not loading**
- JavaScript disabled or build missing
- Solution: Enable JS, run `npm run build` in react-ui/

**Database table not found**
- Entity schema not installed
- Solution: Run `drush php:eval "\Drupal::entityDefinitionUpdateManager()->installEntityType(\Drupal::entityTypeManager()->getDefinition('request_chain'));"`

**Variable extraction not working**
- Incorrect JSONPath syntax
- Solution: Use `$.path.to.value` format (e.g., `$.users[0].id`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Coding standards
- Testing requirements
- Pull request process
- Issue reporting

## Maintainers

Current maintainers:
- [Your Name](https://www.drupal.org/u/your-username)

## License

This project is licensed under the GPL-2.0-or-later license. See [LICENSE.txt](LICENSE.txt) for details.

---

**⚠️ Note**: This module is intended for development and staging environments. Using load testing in production may impact server performance.
