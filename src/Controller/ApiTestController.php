<?php

/**
 * @file
 * Contains \Drupal\api_insight_lab\Controller\ApiTestController.
 *
 * Provides REST API endpoints for testing API performance, managing test
 * configurations, snapshots, and discovering available APIs.
 */

declare(strict_types=1);

namespace Drupal\api_insight_lab\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Http\ClientFactory;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\TransferStats;
use Psr\Http\Message\ResponseInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request as SymfonyRequest;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\State\StateInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use GuzzleHttp\ClientInterface;
use Drupal\Component\Utility\Xss;
use Drupal\api_insight_lab\Entity\ApiTestConfig;
use Drupal\api_insight_lab\Entity\Assertion;
use Drupal\api_insight_lab\Entity\ApiSnapshot;
use Drupal\api_insight_lab\Entity\TestResult;
use Drupal\api_insight_lab\Entity\RequestChain;

/**
 * Provides REST API endpoints for API performance testing.
 *
 * This controller handles:
 * - Performance test execution with load testing capabilities
 * - Test configuration (preset) management
 * - Snapshot creation and comparison
 * - API discovery and analysis
 * - Global settings management
 *
 * @package Drupal\api_insight_lab\Controller
 */
class ApiTestController extends ControllerBase
{
    /**
     * Collected stats.
     */
    protected array $collectedStats = [];

    /**
     * Collected responses.
     */
    protected array $collectedResponses = [];

    /**
     * Collected bodies.
     */
    protected array $collectedBodies = [];

    /**
     * Collected phase markers for time-series data.
     */
    protected array $collectedPhases = [];

    /**
     * Start time of the test.
     */
    protected float $testStartTime = 0;

    /**
     * Configured concurrency (max VUs).
     */
    protected int $concurrency = 1;

    /**
     * The HTTP client factory.
     */
    protected ClientFactory $httpClientFactory;

    /**
     * Constructs the controller.
     */
    public function __construct(ClientFactory $http_client_factory)
    {
        $this->httpClientFactory = $http_client_factory;
    }

    /**
     * {@inheritdoc}
     */
    public static function create(ContainerInterface $container): static
    {
        return new static(
            $container->get('http_client_factory')
        );
    }

    /**
     * Build the React app.
     */
    public function build(): array
    {
        return [
            '#type' => 'markup',
            '#markup' => '<div id="api-insight-lab-app"></div>',
            '#attached' => [
                'library' => [
                    'api_insight_lab/react_app',
                ],
                'drupalSettings' => [
                    'api_insight_lab' => [
                        'csrf_token' => \Drupal::csrfToken()->get('rest'),
                    ],
                ],
            ],
        ];
    }

    /**
     * Run API performance test.
     *
     * @param \Symfony\Component\HttpFoundation\Request $request
     *   The request.
     *
     * @return \Symfony\Component\HttpFoundation\JsonResponse
     *   JSON response with test results.
     */
    public function runTest(SymfonyRequest $request): JsonResponse
    {
        $content = json_decode($request->getContent(), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            \Drupal::logger('api_insight_lab')->error('Invalid JSON: ' . $request->getContent());
            return new JsonResponse(['error' => 'Invalid JSON'], 400);
        }

        \Drupal::logger('api_insight_lab')->info('Run Test Request: ' . print_r($content, true));

        // Extract parameters.
        $url = $content['url'] ?? '';
        $method = strtoupper($content['method'] ?? 'GET');
        $headers = $content['headers'] ?? [];
        $body = $content['body'] ?? '';
        $concurrency = min(100, max(1, (int) ($content['concurrency'] ?? 1)));
        $iterations = min(1000, max(1, (int) ($content['iterations'] ?? 1))); // Iterations per VU
        $bypassCache = (bool) ($content['bypassCache'] ?? false);
        $timeout = min(120, max(1, (int) ($content['timeout'] ?? 30)));

        // Phased load testing configuration.
        $phaseConfig = $content['loadPhaseConfig'] ?? [];
        $enablePhasedLoad = (bool) ($phaseConfig['enablePhasedLoad'] ?? false);
        $warmupDuration = max(0, (int) ($phaseConfig['warmupDuration'] ?? 0));
        $warmupVUsPercent = max(5, min(100, (int) ($phaseConfig['warmupVUsPercent'] ?? 20)));
        $rampUpDuration = max(0, (int) ($phaseConfig['rampUpDuration'] ?? 0));
        $sustainDuration = max(0, (int) ($phaseConfig['sustainDuration'] ?? 0));
        $rampDownDuration = max(0, (int) ($phaseConfig['rampDownDuration'] ?? 0));

        // Auth handling.
        $auth = $content['auth'] ?? [];
        if (!empty($auth['type'])) {
            switch ($auth['type']) {
                case 'basic':
                    if (!empty($auth['username'])) {
                        $headers['Authorization'] = 'Basic ' . base64_encode($auth['username'] . ':' . ($auth['password'] ?? ''));
                    }
                    break;
                case 'bearer':
                    if (!empty($auth['token'])) {
                        $headers['Authorization'] = 'Bearer ' . $auth['token'];
                    }
                    break;
                case 'apikey':
                    if (!empty($auth['keyName']) && !empty($auth['keyValue'])) {
                        $headers[$auth['keyName']] = $auth['keyValue'];
                    }
                    break;
            }
        }

        // Validate URL.
        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return new JsonResponse(['error' => 'Invalid URL'], 400);
        }

        // Calculate total requests and validate limit
        $totalRequests = $concurrency * $iterations;
        if ($totalRequests > 100000) {
            return new JsonResponse([
                'error' => "Total requests ({$totalRequests}) exceeds maximum (100,000). Reduce VUs or iterations per VU."
            ], 400);
        }

        // Run the test.
        try {
            set_time_limit(0);
            $this->collectedStats = [];
            $this->collectedResponses = [];
            $this->collectedBodies = [];
            $this->collectedPhases = [];

            if ($enablePhasedLoad && ($warmupDuration > 0 || $rampUpDuration > 0 || $rampDownDuration > 0)) {
                // Run phased load test with actual ramp up/down
                $this->runPhasedLoadTest(
                    $url,
                    $method,
                    $headers,
                    $body,
                    $concurrency,
                    $iterations,
                    $bypassCache,
                    $timeout,
                    $warmupDuration,
                    $warmupVUsPercent,
                    $rampUpDuration,
                    $sustainDuration,
                    $rampDownDuration
                );
            } else {
                // Run standard load test (all VUs immediately)
                $this->runLoadTest($url, $method, $headers, $body, $concurrency, $iterations, $bypassCache, $timeout);
            }

            // Build response.
            $results = $this->buildResults();

            // Save result to Entity.
            if (!isset($results['error'])) {
                try {
                    /** @var \Drupal\api_insight_lab\Entity\TestResult $testResult */
                    $testResult = \Drupal\api_insight_lab\Entity\TestResult::create([
                        'url' => $url,
                        'method' => $method,
                        'status' => $results['firstResponse']['status'] ?? 0,
                        'duration' => is_array($results['stats']) ? ($results['stats']['requests'] * ($results['stats']['mean'] / 1000)) : 0,
                        'avg_time' => $results['stats']['mean'] / 1000,
                        'total_requests' => $results['stats']['requests'],
                        'error_count' => $results['stats']['errorCount'],
                    ]);
                    $testResult->save();
                } catch (\Exception $e) {
                    // Log error but don't fail the response
                    \Drupal::logger('api_insight_lab')->error('Failed to save test result: ' . $e->getMessage());
                }
            }

            // Evaluate assertions if assertions provided OR config_id exists
            $assertions = $content['assertions'] ?? [];

            // If config_id is present but no assertions passed, try to load them
            if (empty($assertions) && !empty($content['config_id'])) {
                $assertions = $this->getAssertionsForConfig($content['config_id']);
            }

            if (!empty($assertions) && !isset($results['error'])) {
                $responseData = [
                    'status' => $results['firstResponse']['status'] ?? 0,
                    'body' => $this->collectedBodies[0] ?? '',
                    'headers' => $this->collectedResponses[0]['headers'] ?? []
                ];

                $results['assertions'] = $this->evaluateAssertions(
                    $assertions, // Pass array of assertions directly
                    $responseData,
                    $results['stats']
                );

                $results['assertions_passed'] = count(array_filter($results['assertions'], fn($a) => $a['passed']));
                $results['assertions_total'] = count($results['assertions']);
            }
        } catch (\Throwable $e) {
            \Drupal::logger('api_insight_lab')->error('Test execution failed: ' . $e->getMessage());
            return new JsonResponse(['error' => 'Test execution failed: ' . $e->getMessage()], 500);
        }

        return new JsonResponse($results);
    }

    /**
     * Run load test.
     */
    protected function runLoadTest(string $url, string $method, array $headers, string $body, int $concurrency, int $iterations, bool $bypassCache, int $timeout): void
    {
        $client = $this->httpClientFactory->fromOptions([
            'timeout' => $timeout,
            'http_errors' => false,
            'verify' => false,
        ]);

        // Initialize stats
        $this->collectedStats = [];
        $this->collectedResponses = [];
        $this->collectedBodies = [];
        $this->collectedPhases = [];
        $this->concurrency = $concurrency;

        // Calculate total requests: VUs * iterations per VU (k6-style)
        $totalRequests = $concurrency * $iterations;

        $requests = function (int $total) use ($url, $method, $headers, $body, $bypassCache): \Generator {
            for ($i = 0; $i < $total; $i++) {
                $requestUrl = $url;
                if ($bypassCache) {
                    $separator = str_contains($url, '?') ? '&' : '?';
                    $requestUrl = $url . $separator . 'nocache=' . time() . '-' . mt_rand(1000, 9999) . '-' . $i;
                }
                $requestBody = in_array($method, ['POST', 'PUT', 'PATCH']) ? $body : null;
                yield new Request($method, $requestUrl, $headers, $requestBody);
            }
        };

        $this->testStartTime = microtime(true);
        $startTime = $this->testStartTime;

        $pool = new Pool($client, $requests($totalRequests), [
            'concurrency' => $concurrency,
            'options' => [
                'on_stats' => function (TransferStats $stats) use ($startTime): void {
                    $handlerStats = $stats->getHandlerStats();
                    $this->collectedStats[] = [
                        'total_time' => $handlerStats['total_time'] ?? 0,
                        'starttransfer_time' => $handlerStats['starttransfer_time'] ?? 0,
                        'namelookup_time' => $handlerStats['namelookup_time'] ?? 0,
                        'connect_time' => $handlerStats['connect_time'] ?? 0,
                        'appconnect_time' => $handlerStats['appconnect_time'] ?? 0,
                        'pretransfer_time' => $handlerStats['pretransfer_time'] ?? 0,
                        'elapsed_time' => microtime(true) - $startTime,
                    ];
                },
            ],
            'fulfilled' => function (ResponseInterface $httpResponse, $index): void {
                $bodyContent = (string) $httpResponse->getBody();
                $this->collectedResponses[$index] = [
                    'status' => $httpResponse->getStatusCode(),
                    'headers' => $httpResponse->getHeaders(),
                    'error' => null,
                    'size' => strlen($bodyContent),
                ];
                if ($index === 0) {
                    $this->collectedBodies[0] = $bodyContent;
                }
            },
            'rejected' => function ($reason, $index): void {
                $httpResponse = null;
                if ($reason instanceof \GuzzleHttp\Exception\RequestException) {
                    $httpResponse = $reason->getResponse();
                }

                $this->collectedResponses[$index] = [
                    'status' => $httpResponse ? $httpResponse->getStatusCode() : 0,
                    'headers' => $httpResponse ? $httpResponse->getHeaders() : [],
                    'error' => $reason instanceof \Throwable ? $reason->getMessage() : (string) $reason,
                    'size' => 0,
                ];
            },
        ]);

        $promise = $pool->promise();
        $promise->wait();
    }

    /**
     * Run phased load test with actual warmup, ramp up, sustain, and ramp down.
     *
     * @param string $url Target URL.
     * @param string $method HTTP method.
     * @param array $headers Request headers.
     * @param string $body Request body.
     * @param int $maxVUs Maximum virtual users.
     * @param int $iterations Iterations per VU.
     * @param bool $bypassCache Whether to bypass cache.
     * @param int $timeout Request timeout in seconds.
     * @param int $warmupDuration Warmup phase duration in seconds.
     * @param int $warmupVUsPercent Percentage of max VUs during warmup.
     * @param int $rampUpDuration Ramp up phase duration in seconds.
     * @param int $sustainDuration Sustain phase duration in seconds.
     * @param int $rampDownDuration Ramp down phase duration in seconds.
     */
    protected function runPhasedLoadTest(
        string $url,
        string $method,
        array $headers,
        string $body,
        int $maxVUs,
        int $iterations,
        bool $bypassCache,
        int $timeout,
        int $warmupDuration,
        int $warmupVUsPercent,
        int $rampUpDuration,
        int $sustainDuration,
        int $rampDownDuration
    ): void {
        $client = $this->httpClientFactory->fromOptions([
            'timeout' => $timeout,
            'http_errors' => false,
            'verify' => false,
        ]);

        $this->collectedStats = [];
        $this->collectedResponses = [];
        $this->collectedBodies = [];
        $this->collectedPhases = [];
        $this->concurrency = $maxVUs;

        $totalDuration = $warmupDuration + $rampUpDuration + $sustainDuration + $rampDownDuration;
        $warmupVUs = max(1, (int) ceil($maxVUs * $warmupVUsPercent / 100));
        $this->testStartTime = microtime(true);
        $startTime = (int) $this->testStartTime;
        $requestIndex = 0;
        $totalRequestsTarget = $maxVUs * $iterations;
        $totalRequestsSent = 0;

        // Helper to run a batch of requests
        $runBatch = function (int $currentVUs, int $batchIterations, string $phase) use ($client, $url, $method, $headers, $body, $bypassCache, &$requestIndex, $startTime, $totalRequestsTarget, &$totalRequestsSent): void {
            // Check if we've reached the target
            if ($totalRequestsSent >= $totalRequestsTarget) {
                return;
            }

            $batchRequests = $currentVUs * $batchIterations;
            // Cap to remaining requests
            $batchRequests = min($batchRequests, $totalRequestsTarget - $totalRequestsSent);

            if ($batchRequests <= 0) {
                return;
            }

            $requests = function (int $total) use ($url, $method, $headers, $body, $bypassCache, &$requestIndex): \Generator {
                for ($i = 0; $i < $total; $i++) {
                    $requestUrl = $url;
                    if ($bypassCache) {
                        $separator = str_contains($url, '?') ? '&' : '?';
                        $requestUrl = $url . $separator . 'nocache=' . time() . '-' . mt_rand(1000, 9999) . '-' . $requestIndex;
                    }
                    $requestBody = in_array($method, ['POST', 'PUT', 'PATCH']) ? $body : null;
                    yield new Request($method, $requestUrl, $headers, $requestBody);
                    $requestIndex++;
                }
            };

            $batchStartIndex = count($this->collectedStats);

            $pool = new Pool($client, $requests($batchRequests), [
                'concurrency' => min($currentVUs, $batchRequests),
                'options' => [
                    'on_stats' => function (TransferStats $stats) use ($phase, $startTime): void {
                        $handlerStats = $stats->getHandlerStats();
                        $this->collectedStats[] = [
                            'total_time' => $handlerStats['total_time'] ?? 0,
                            'starttransfer_time' => $handlerStats['starttransfer_time'] ?? 0,
                            'namelookup_time' => $handlerStats['namelookup_time'] ?? 0,
                            'connect_time' => $handlerStats['connect_time'] ?? 0,
                            'appconnect_time' => $handlerStats['appconnect_time'] ?? 0,
                            'pretransfer_time' => $handlerStats['pretransfer_time'] ?? 0,
                            'phase' => $phase,
                            'elapsed_time' => time() - $startTime,
                        ];
                    },
                ],
                'fulfilled' => function (ResponseInterface $httpResponse, $index) use ($batchStartIndex): void {
                    $actualIndex = $batchStartIndex + $index;
                    $bodyContent = (string) $httpResponse->getBody();
                    $this->collectedResponses[$actualIndex] = [
                        'status' => $httpResponse->getStatusCode(),
                        'headers' => $httpResponse->getHeaders(),
                        'error' => null,
                        'size' => strlen($bodyContent),
                    ];
                    if ($actualIndex === 0) {
                        $this->collectedBodies[0] = $bodyContent;
                    }
                },
                'rejected' => function ($reason, $index) use ($batchStartIndex): void {
                    $actualIndex = $batchStartIndex + $index;
                    $httpResponse = null;
                    if ($reason instanceof \GuzzleHttp\Exception\RequestException) {
                        $httpResponse = $reason->getResponse();
                    }
                    $this->collectedResponses[$actualIndex] = [
                        'status' => $httpResponse ? $httpResponse->getStatusCode() : 0,
                        'headers' => $httpResponse ? $httpResponse->getHeaders() : [],
                        'error' => $reason instanceof \Throwable ? $reason->getMessage() : (string) $reason,
                        'size' => 0,
                    ];
                },
            ]);

            $promise = $pool->promise();
            $promise->wait();

            $totalRequestsSent += $batchRequests;
        };

        // Calculate iterations per second based on total iterations and duration
        $totalIterations = $maxVUs * $iterations;
        $iterationsPerSecond = $totalDuration > 0 ? max(1, (int) ceil($totalIterations / $totalDuration)) : $totalIterations;

        // Phase 1: Warmup
        if ($warmupDuration > 0 && $totalRequestsSent < $totalRequestsTarget) {
            $this->collectedPhases[] = ['phase' => 'warmup', 'start' => 0, 'vus' => $warmupVUs];
            for ($sec = 0; $sec < $warmupDuration && $totalRequestsSent < $totalRequestsTarget; $sec++) {
                $runBatch($warmupVUs, max(1, (int) ceil($iterationsPerSecond / $warmupVUs)), 'warmup');
                if ($sec < $warmupDuration - 1 && $totalRequestsSent < $totalRequestsTarget) {
                    usleep(200000); // 200ms delay between batches
                }
            }
        }

        // Phase 2: Ramp Up
        if ($rampUpDuration > 0 && $totalRequestsSent < $totalRequestsTarget) {
            $this->collectedPhases[] = ['phase' => 'rampup', 'start' => $warmupDuration, 'vus' => $maxVUs];
            for ($sec = 0; $sec < $rampUpDuration && $totalRequestsSent < $totalRequestsTarget; $sec++) {
                // Linear ramp from warmupVUs to maxVUs
                $progress = ($sec + 1) / $rampUpDuration;
                $currentVUs = (int) ceil($warmupVUs + ($maxVUs - $warmupVUs) * $progress);
                $runBatch($currentVUs, max(1, (int) ceil($iterationsPerSecond / $currentVUs)), 'rampup');
                if ($sec < $rampUpDuration - 1 && $totalRequestsSent < $totalRequestsTarget) {
                    usleep(200000);
                }
            }
        }

        // Phase 3: Sustain
        if ($sustainDuration > 0 && $totalRequestsSent < $totalRequestsTarget) {
            $this->collectedPhases[] = ['phase' => 'sustain', 'start' => $warmupDuration + $rampUpDuration, 'vus' => $maxVUs];
            for ($sec = 0; $sec < $sustainDuration && $totalRequestsSent < $totalRequestsTarget; $sec++) {
                $runBatch($maxVUs, max(1, (int) ceil($iterationsPerSecond / $maxVUs)), 'sustain');
                if ($sec < $sustainDuration - 1 && $totalRequestsSent < $totalRequestsTarget) {
                    usleep(200000);
                }
            }
        }

        // Phase 4: Ramp Down
        if ($rampDownDuration > 0 && $totalRequestsSent < $totalRequestsTarget) {
            $this->collectedPhases[] = ['phase' => 'rampdown', 'start' => $warmupDuration + $rampUpDuration + $sustainDuration, 'vus' => $warmupVUs];
            for ($sec = 0; $sec < $rampDownDuration && $totalRequestsSent < $totalRequestsTarget; $sec++) {
                // Linear ramp from maxVUs to warmupVUs
                $progress = ($sec + 1) / $rampDownDuration;
                $currentVUs = (int) ceil($maxVUs - ($maxVUs - $warmupVUs) * $progress);
                $runBatch($currentVUs, max(1, (int) ceil($iterationsPerSecond / $currentVUs)), 'rampdown');
                if ($sec < $rampDownDuration - 1 && $totalRequestsSent < $totalRequestsTarget) {
                    usleep(200000);
                }
            }
        }
    }

    /**
     * Build results array.
     */
    protected function buildResults(): array
    {
        if (empty($this->collectedStats)) {
            // Check if we have response errors (e.g. DNS failure, connection refused)
            if (!empty($this->collectedResponses)) {
                $firstResponse = reset($this->collectedResponses);
                if (!empty($firstResponse['error'])) {
                    return ['error' => $firstResponse['error']];
                }
            }
            return ['error' => 'No results collected'];
        }

        // Even with stats, check if all requests failed (connection errors still generate stats)
        if (!empty($this->collectedResponses)) {
            $firstResponse = reset($this->collectedResponses);
            if (!empty($firstResponse['error']) && ($firstResponse['status'] ?? 0) === 0) {
                // All requests failed with connection error
                return ['error' => $firstResponse['error']];
            }
        }

        $totalTimes = array_column($this->collectedStats, 'total_time');
        $ttfbTimes = array_column($this->collectedStats, 'starttransfer_time');
        $totalCount = count($this->collectedStats);

        // Basic stats.
        sort($totalTimes);
        $sum = array_sum($totalTimes);
        $mean = $sum / $totalCount;
        $min = min($totalTimes);
        $max = max($totalTimes);
        $median = $totalCount % 2 === 0
            ? ($totalTimes[(int) ($totalCount / 2) - 1] + $totalTimes[(int) ($totalCount / 2)]) / 2
            : $totalTimes[(int) floor($totalCount / 2)];

        // Percentiles.
        $p95 = $totalTimes[(int) ceil(0.95 * $totalCount) - 1] ?? $max;
        $p99 = $totalTimes[(int) ceil(0.99 * $totalCount) - 1] ?? $max;

        // Standard deviation.
        $variance = 0;
        foreach ($totalTimes as $time) {
            $variance += pow($time - $mean, 2);
        }
        $stddev = sqrt($variance / $totalCount);

        // Status codes.
        $successCount = 0;
        $errorCount = 0;
        $cacheHits = 0;
        $cacheMisses = 0;

        foreach ($this->collectedResponses as $resp) {
            if ($resp['status'] >= 200 && $resp['status'] < 400) {
                $successCount++;
            } else {
                $errorCount++;
            }
            $cacheHeader = $resp['headers']['X-Drupal-Cache'][0] ?? $resp['headers']['x-drupal-cache'][0] ?? '';
            if ($cacheHeader === 'HIT') {
                $cacheHits++;
            } elseif ($cacheHeader === 'MISS') {
                $cacheMisses++;
            }
        }

        // RPS.
        $rps = $sum > 0 ? $totalCount / $sum : 0;
        $errorRate = ($errorCount / $totalCount) * 100;

        // First response details.
        $firstResponse = $this->collectedResponses[0] ?? [];
        $firstBody = $this->collectedBodies[0] ?? '';

        // Chart data.
        $chartData = [
            'responseTime' => [
                'labels' => array_map(fn($i) => 'R' . ($i + 1), array_keys($this->collectedStats)),
                'totalTime' => array_map(fn($t) => round($t * 1000, 2), array_column($this->collectedStats, 'total_time')),
                'ttfb' => array_map(fn($t) => round($t * 1000, 2), $ttfbTimes),
            ],
            'percentiles' => [
                'p50' => round($median * 1000, 2),
                'p75' => round(($totalTimes[(int) ceil(0.75 * $totalCount) - 1] ?? $median) * 1000, 2),
                'p90' => round(($totalTimes[(int) ceil(0.90 * $totalCount) - 1] ?? $p95) * 1000, 2),
                'p95' => round($p95 * 1000, 2),
                'p99' => round($p99 * 1000, 2),
            ],
            'statusCodes' => [
                'success' => $successCount,
                'redirect' => 0,
                'clientError' => 0,
                'serverError' => 0,
                'failed' => $errorCount,
            ],
        ];

        // Bottleneck analysis.
        $avgStats = [];
        foreach (['namelookup_time', 'connect_time', 'appconnect_time', 'starttransfer_time', 'total_time'] as $key) {
            $avgStats[$key] = array_sum(array_column($this->collectedStats, $key)) / $totalCount * 1000;
        }

        $bottleneck = [
            'dns' => $avgStats['namelookup_time'],
            'tcp' => max(0, $avgStats['connect_time'] - $avgStats['namelookup_time']),
            'tls' => max(0, $avgStats['appconnect_time'] - $avgStats['connect_time']),
            'server' => max(0, $avgStats['starttransfer_time'] - max($avgStats['appconnect_time'], $avgStats['connect_time'])),
            'download' => max(0, $avgStats['total_time'] - $avgStats['starttransfer_time']),
        ];

        // Testing insights.
        $firstTime = ($this->collectedStats[0]['total_time'] ?? 0) * 1000;
        $warmAvg = $totalCount > 1
            ? (array_sum(array_slice($totalTimes, 1)) / ($totalCount - 1)) * 1000
            : $firstTime;

        return [
            'success' => true,
            'stats' => [
                'requests' => $totalCount,
                'successCount' => $successCount,
                'errorCount' => $errorCount,
                'errorRate' => round($errorRate, 2),
                'rps' => round($rps, 1),
                'mean' => round($mean * 1000, 2),
                'median' => round($median * 1000, 2),
                'min' => round($min * 1000, 2),
                'max' => round($max * 1000, 2),
                'stddev' => round($stddev * 1000, 2),
                'p95' => round($p95 * 1000, 2),
                'p99' => round($p99 * 1000, 2),
                'cacheHits' => $cacheHits,
                'cacheMisses' => $cacheMisses,
            ],
            'testing' => [
                'coldStart' => round($firstTime, 2),
                'warmAvg' => round($warmAvg, 2),
                'coldWarmRatio' => $warmAvg > 0 ? round($firstTime / $warmAvg, 1) : 1,
                'variance' => round(($max - $min) * 1000, 2),
                'loadStatus' => $errorRate < 1 ? 'PASSED' : ($errorRate < 5 ? 'WARNING' : 'FAILED'),
                'stressStatus' => ($max * 1000 < 1000 && $errorRate < 5) ? 'STABLE' : ($max * 1000 < 2000 ? 'DEGRADED' : 'BREAKING'),
                'latencyStatus' => ($mean * 1000 < 200) ? 'EXCELLENT' : (($mean * 1000 < 500) ? 'ACCEPTABLE' : 'SLOW'),
            ],
            'chartData' => $chartData,
            'bottleneck' => $bottleneck,
            'firstResponse' => [
                'status' => $firstResponse['status'] ?? 0,
                'headers' => $firstResponse['headers'] ?? [],
                'size' => $firstResponse['size'] ?? 0,
                'body' => strlen($firstBody) > 10000 ? substr($firstBody, 0, 10000) . '...' : $firstBody,
            ],
            'requests' => array_map(function ($index) {
                $stats = $this->collectedStats[$index] ?? [];
                $dns = round(($stats['namelookup_time'] ?? 0) * 1000, 2);
                $tcp = round((($stats['connect_time'] ?? 0) - ($stats['namelookup_time'] ?? 0)) * 1000, 2);
                $ssl = round((($stats['appconnect_time'] ?? 0) - ($stats['connect_time'] ?? 0)) * 1000, 2);
                $ttfb = round((($stats['starttransfer_time'] ?? 0) - ($stats['appconnect_time'] ?? 0)) * 1000, 2);
                $download = round((($stats['total_time'] ?? 0) - ($stats['starttransfer_time'] ?? 0)) * 1000, 2);
                $total = round(($stats['total_time'] ?? 0) * 1000, 2);

                return [
                    'index' => $index + 1,
                    'status' => $this->collectedResponses[$index]['status'] ?? 0,
                    'totalTime' => $total,
                    'ttfb' => round(($stats['starttransfer_time'] ?? 0) * 1000, 2),
                    'size' => $this->collectedResponses[$index]['size'] ?? 0,
                    'cache' => $this->collectedResponses[$index]['headers']['X-Drupal-Cache'][0]
                        ?? $this->collectedResponses[$index]['headers']['x-drupal-cache'][0]
                        ?? '-',
                    'error' => $this->collectedResponses[$index]['error'] ?? null,
                    // Detailed timing breakdown
                    'timing' => [
                        'dns' => max(0, $dns),
                        'tcp' => max(0, $tcp),
                        'ssl' => max(0, $ssl),
                        'wait' => max(0, $ttfb),
                        'download' => max(0, $download),
                    ],
                    // Size breakdown
                    'sizeDetails' => [
                        'responseHeaders' => strlen(implode("\r\n", array_map(
                            fn($k, $v) => "$k: " . (is_array($v) ? implode(', ', $v) : $v),
                            array_keys($this->collectedResponses[$index]['headers'] ?? []),
                            array_values($this->collectedResponses[$index]['headers'] ?? [])
                        ))),
                        'responseBody' => $this->collectedResponses[$index]['size'] ?? 0,
                    ],
                ];
            }, array_keys($this->collectedStats)),
            'summary' => [
                'status' => $successCount > 0 ? 200 : ($errorCount > 0 ? 500 : 0),
                'totalTime' => round($sum, 2),
                'avgTime' => round($mean * 1000, 2),
                'totalRequests' => $totalCount,
                'errors' => $errorCount,
            ],
            'timeSeries' => $this->generateTimeSeries($this->collectedStats, $this->collectedResponses),
        ];
    }

    /**
     * Generate time-series data for k6-style chart visualization.
     *
     * Groups requests into time buckets and calculates metrics per bucket.
     * Uses actual phase data    /**
     * Helper to generate time-series data for charts.
     */
    private function generateTimeSeries(array $stats, array $responses, $startTime = null, $concurrency = 1)
    {
        if (empty($stats)) {
            return [];
        }

        $totalCount = count($stats);
        $startTime = $this->testStartTime;
        $concurrency = $this->concurrency;

        // Check if we have actual phase data from phased load test
        $hasPhaseData = isset($stats[0]['phase']);

        // Check if we have elapsed_time (from new runLoadTest or phased test)
        $hasElapsed = isset($stats[0]['elapsed_time']);

        if ($hasElapsed) {
            // TIME-BASED BUCKETING (Accurate)
            // Calculate total duration based on max elapsed time
            $maxElapsed = 0;
            foreach ($stats as $stat) {
                if (($stat['elapsed_time'] ?? 0) > $maxElapsed) {
                    $maxElapsed = $stat['elapsed_time'];
                }
            }

            // create 1-second buckets (or smaller if test is very short, but 1s is standard for RPS)
            $totalDuration = ceil($maxElapsed);
            if ($totalDuration < 1)
                $totalDuration = 1;

            // If test is very long (> 60s), we might want larger buckets, but for now 1s is best for "RPS"
            $bucketSize = 1.0;
            $numBuckets = (int) $totalDuration;

            // Initialize buckets
            $buckets = [];
            for ($i = 0; $i < $numBuckets; $i++) {
                $buckets[$i] = [
                    'count' => 0,
                    'times' => [],
                    'errors' => 0,
                    'success' => 0,
                    'phases' => [],
                    'activeVUs' => 0 // to be estimated
                ];
            }

            // Fill buckets
            foreach ($stats as $index => $stat) {
                $elapsed = $stat['elapsed_time'] ?? 0;
                $bucketIndex = (int) floor($elapsed / $bucketSize);

                // Handle edge case where elapsed matches duration exactly
                if ($bucketIndex >= $numBuckets) {
                    $bucketIndex = $numBuckets - 1;
                }

                $buckets[$bucketIndex]['count']++;
                $buckets[$bucketIndex]['times'][] = ($stat['total_time'] ?? 0) * 1000;

                if (isset($responses[$index])) {
                    $status = $responses[$index]['status'] ?? 0;
                    if ($status >= 200 && $status < 400) {
                        $buckets[$bucketIndex]['success']++;
                    } else {
                        $buckets[$bucketIndex]['errors']++;
                    }
                }

                if (isset($stat['phase'])) {
                    $buckets[$bucketIndex]['phases'][] = $stat['phase'];
                }
            }

            // Generate Time Series
            $timeSeries = [];
            foreach ($buckets as $i => $b) {
                if ($b['count'] === 0) {
                    // Empty bucket handling - preserve time continuity
                    $timeSeries[] = [
                        'time' => $i,
                        'timestamp' => date('c', (int) $startTime + $i),
                        'activeVUs' => 0,
                        'rps' => 0,
                        'responseTimeP50' => 0,
                        'responseTimeP95' => 0,
                        'responseTimeP99' => 0,
                        'successCount' => 0,
                        'errorCount' => 0,
                        'phase' => 'sustain',
                    ];
                    continue;
                }

                sort($b['times']);
                $count = count($b['times']);

                $p50Index = max(0, (int) ceil(0.50 * $count) - 1);
                $p95Index = max(0, (int) ceil(0.95 * $count) - 1);
                $p99Index = max(0, (int) ceil(0.99 * $count) - 1);

                // Determine Phase
                $phase = !empty($b['phases']) ? $this->getMostFrequent($b['phases']) : 'sustain';

                // Estimate Active VUs
                $activeVUs = $concurrency;

                if (!empty($b['phases'])) {
                    // Simple heuristic based on phase name if we have it
                    $phaseName = $this->getMostFrequent($b['phases']);
                    if ($phaseName === 'warmup') {
                        $activeVUs = max(1, round($concurrency * 0.3));
                    } elseif ($phaseName === 'rampup') {
                        $activeVUs = max(1, round($concurrency * 0.7));
                    } elseif ($phaseName === 'rampdown') {
                        $activeVUs = max(1, round($concurrency * 0.3));
                    }
                }

                $timeSeries[] = [
                    'time' => $i,
                    'timestamp' => date('c', (int) $startTime + $i),
                    'activeVUs' => $activeVUs,
                    'rps' => round($b['count'] / $bucketSize, 2),
                    'responseTimeP50' => round($b['times'][$p50Index] ?? 0, 2),
                    'responseTimeP95' => round($b['times'][$p95Index] ?? 0, 2),
                    'responseTimeP99' => round($b['times'][$p99Index] ?? 0, 2),
                    'successCount' => $b['success'],
                    'errorCount' => $b['errors'],
                    'phase' => $phase,
                ];
            }

            return $timeSeries;

        } else {
            // FALLBACK TO COUNT-BASED (Old logic) - Only if elapsed_time missing
            // For small tests, create synthetic time buckets based on request index
            $numBuckets = min(20, max(5, (int) ceil($totalCount / 5)));
            $requestsPerBucket = max(1, (int) ceil($totalCount / $numBuckets));

            $timeSeries = [];

            for ($bucket = 0; $bucket < $numBuckets; $bucket++) {
                $startIndex = $bucket * $requestsPerBucket;
                $endIndex = min($startIndex + $requestsPerBucket, $totalCount);

                if ($startIndex >= $totalCount) {
                    break;
                }

                $bucketStats = array_slice($stats, $startIndex, $endIndex - $startIndex);
                $bucketResponses = array_slice($responses, $startIndex, $endIndex - $startIndex);

                if (empty($bucketStats)) {
                    continue;
                }

                // Calculate metrics for this bucket
                $times = array_map(fn($s) => ($s['total_time'] ?? 0) * 1000, $bucketStats);
                sort($times);
                $bucketCount = count($times);

                $successCount = 0;
                $errorCount = 0;
                foreach ($bucketResponses as $resp) {
                    if (isset($resp['status']) && $resp['status'] >= 200 && $resp['status'] < 400) {
                        $successCount++;
                    } else {
                        $errorCount++;
                    }
                }

                // Calculate percentiles
                $p50Index = max(0, (int) ceil(0.50 * $bucketCount) - 1);
                $p95Index = max(0, (int) ceil(0.95 * $bucketCount) - 1);
                $p99Index = max(0, (int) ceil(0.99 * $bucketCount) - 1);

                // Determine VU count and phase
                // Fallback: Simulate VU ramp-up pattern for non-phased tests
                $vuRatio = 1.0;
                if ($bucket < $numBuckets * 0.2) {
                    // Warm-up: 20% to 80%
                    $vuRatio = 0.2 + (0.6 * ($bucket / ($numBuckets * 0.2)));
                } elseif ($bucket > $numBuckets * 0.8) {
                    // Ramp-down: 80% to 20%
                    $vuRatio = 0.8 - (0.6 * (($bucket - $numBuckets * 0.8) / ($numBuckets * 0.2)));
                } else {
                    // Sustain: 80% to 100%
                    $vuRatio = 0.8 + (0.2 * sin(($bucket - $numBuckets * 0.2) / ($numBuckets * 0.6) * M_PI));
                }
                $activeVUs = max(1, (int) round($bucketCount * $vuRatio));
                $dominantPhase = $bucket < $numBuckets * 0.2 ? 'warmup' :
                    ($bucket > $numBuckets * 0.8 ? 'rampdown' : 'sustain');


                $timeSeries[] = [
                    'time' => $bucket,
                    'timestamp' => date('c', $startTime + $bucket),
                    'activeVUs' => $activeVUs,
                    'rps' => round($bucketCount / 1, 1), // Simplified RPS per bucket
                    'responseTimeP50' => round($times[$p50Index] ?? 0, 2),
                    'responseTimeP95' => round($times[$p95Index] ?? 0, 2),
                    'responseTimeP99' => round($times[$p99Index] ?? 0, 2),
                    'successCount' => $successCount,
                    'errorCount' => $errorCount,
                    'phase' => $dominantPhase,
                ];
            }

            return $timeSeries;
        }
    }

    /**
     * Get the most frequent value in an array.
     */
    private function getMostFrequent(array $arr): string
    {
        $counts = array_count_values($arr);
        arsort($counts);
        return (string) array_key_first($counts);
    }

    /**
     * Save rate limit settings (Stub).
     */
    public function saveLimit(SymfonyRequest $request): JsonResponse
    {
        return new JsonResponse(['success' => true]);
    }

    /**
     * Get global settings.
     */
    public function getGlobalSettings(): JsonResponse
    {
        $config = \Drupal::config('api_insight_lab.settings');
        $data = [
            'default_auth' => [
                'type' => $config->get('default_auth.type') ?: 'none',
                'basic_user' => $config->get('default_auth.basic_user'),
                'basic_pass' => $config->get('default_auth.basic_pass'),
                'bearer_token' => $config->get('default_auth.bearer_token'),
                'apikey_key' => $config->get('default_auth.apikey_key'),
                'apikey_value' => $config->get('default_auth.apikey_value'),
            ],
        ];
        return new JsonResponse($data);
    }

    /**
     * Save global settings.
     */
    public function saveGlobalSettings(SymfonyRequest $request): JsonResponse
    {
        $content = json_decode($request->getContent(), true);
        // Only allow updating if data is provided
        if (!isset($content['default_auth'])) {
            return new JsonResponse(['error' => 'Missing default_auth data'], 400);
        }

        $auth = $content['default_auth'];
        $config = \Drupal::service('config.factory')->getEditable('api_insight_lab.settings');

        if (isset($auth['type'])) {
            $config->set('default_auth.type', $auth['type']);
        }
        if (isset($auth['basic_user'])) {
            $config->set('default_auth.basic_user', $auth['basic_user']);
        }
        if (isset($auth['basic_pass'])) {
            $config->set('default_auth.basic_pass', $auth['basic_pass']);
        }
        if (isset($auth['bearer_token'])) {
            $config->set('default_auth.bearer_token', $auth['bearer_token']);
        }
        if (isset($auth['apikey_key'])) {
            $config->set('default_auth.apikey_key', $auth['apikey_key']);
        }
        if (isset($auth['apikey_value'])) {
            $config->set('default_auth.apikey_value', $auth['apikey_value']);
        }

        $config->save();

        return new JsonResponse(['success' => true]);
    }

    /**
     * Delete preset.
     */
    public function deletePreset(string $id): JsonResponse
    {
        if (empty($id)) {
            return new JsonResponse(['error' => 'ID is required'], 400);
        }

        try {
            /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig|null $entity */
            $entity = \Drupal::entityTypeManager()->getStorage('api_test_config')->load($id);
            if ($entity) {
                $entity->delete();
                // Also delete associated assertions
                $assertions = \Drupal::entityTypeManager()->getStorage('api_assertion')->loadByProperties(['config_id' => $id]);
                if (!empty($assertions)) {
                    \Drupal::entityTypeManager()->getStorage('api_assertion')->delete($assertions);
                }
                return new JsonResponse(['success' => true]);
            }
            return new JsonResponse(['error' => 'Preset not found'], 404);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get saved presets.
     */
    public function getPresets(): JsonResponse
    {
        $storage = \Drupal::entityTypeManager()->getStorage('api_test_config');
        $query = $storage->getQuery()->sort('created', 'DESC')->accessCheck(true);
        $ids = $query->execute();
        $entities = $storage->loadMultiple($ids);

        $presets = [];
        /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig $entity */
        foreach ($entities as $entity) {
            // Load assertions for this config.
            $assertions = [];
            try {
                $assertionStorage = \Drupal::entityTypeManager()->getStorage('api_assertion');
                $assertionQuery = $assertionStorage->getQuery()
                    ->condition('config_id', $entity->id())
                    ->accessCheck(true);
                $assertionIds = $assertionQuery->execute();
                $assertionEntities = $assertionStorage->loadMultiple($assertionIds);

                /** @var \Drupal\api_insight_lab\Entity\Assertion $assertion */
                foreach ($assertionEntities as $assertion) {
                    $assertions[] = [
                        'id' => $assertion->id(),
                        'type' => $assertion->get('assertion_type')->value,
                        'field' => $assertion->get('field_path')->value,
                        'operator' => $assertion->get('operator')->value,
                        'value' => $assertion->get('expected_value')->value,
                        'enabled' => (bool) $assertion->get('enabled')->value,
                    ];
                }
            } catch (\Exception $e) {
                // Log error but continue loading presets without assertions
                \Drupal::logger('api_insight_lab')->error('Failed to load assertions for config ' . $entity->id() . ': ' . $e->getMessage());
            }

            $presets[] = [
                'id' => $entity->id(),
                'name' => $entity->label(),
                'url' => $entity->get('url')->value,
                'method' => $entity->get('method')->value,
                'config' => json_decode($entity->get('config_json')->value, true),
                'group_id' => $entity->get('group_id')->value ?? 'ungrouped',
                'assertions' => $assertions,
                'created' => $entity->get('created')->value,
            ];
        }

        return new JsonResponse($presets);
    }

    /**
     * Save preset.
     */
    public function savePreset(SymfonyRequest $request): JsonResponse
    {
        $content = json_decode($request->getContent(), true);
        $name = $content['name'] ?? 'Untitled Preset';
        $url = $content['url'] ?? '';
        $method = $content['method'] ?? 'GET';
        $config = $content['config'] ?? [];
        $groupId = $content['group_id'] ?? $this->detectGroupFromUrl($url);

        if (empty($url)) {
            return new JsonResponse(['error' => 'URL is required'], 400);
        }

        try {
            /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig $entity */
            $entity = \Drupal\api_insight_lab\Entity\ApiTestConfig::create([
                'name' => $name,
                'url' => $url,
                'method' => $method,
                'config_json' => json_encode($config),
                'group_id' => $groupId,
            ]);
            $entity->save();
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }

        return new JsonResponse([
            'success' => true,
            'id' => $entity->id(),
            'group_id' => $groupId,
        ]);
    }

    /**
     * Detect group ID from URL path.
     */
    private function detectGroupFromUrl(string $url): string
    {
        try {
            $parsed = parse_url($url);
            $path = $parsed['path'] ?? '';
            $parts = array_filter(explode('/', $path));

            // Check for /rest/resource pattern
            if (count($parts) >= 2) {
                $parts = array_values($parts);
                if (in_array($parts[0], ['rest', 'api'])) {
                    return $parts[0] . '_' . $parts[1];
                }
            }
        } catch (\Exception $e) {
            // Ignore parsing errors
        }
        return 'ungrouped';
    }

    /**
     * Update an existing preset.
     */
    public function updatePreset(string $id, SymfonyRequest $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig|null $entity */
            $entity = \Drupal::entityTypeManager()->getStorage('api_test_config')->load($id);

            if (!$entity) {
                return new JsonResponse(['error' => 'Preset not found'], 404);
            }

            // Update fields
            if (isset($content['name'])) {
                $entity->set('name', $content['name']);
            }
            if (isset($content['url'])) {
                $entity->set('url', $content['url']);
            }
            if (isset($content['method'])) {
                $entity->set('method', $content['method']);
            }
            if (isset($content['config'])) {
                $entity->set('config_json', json_encode($content['config']));
            }
            if (isset($content['group_id'])) {
                $entity->set('group_id', $content['group_id']);
            }

            $entity->save();

            return new JsonResponse([
                'success' => true,
                'id' => $entity->id(),
                'message' => 'Preset updated successfully',
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }


    /**
     * Get available groups.
     */
    public function getGroups(): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_test_config');
            $query = $storage->getQuery()->accessCheck(false);
            $ids = $query->execute();
            $presets = $storage->loadMultiple($ids);

            $groups = [];
            /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig $preset */
            foreach ($presets as $preset) {
                $groupId = $preset->get('group_id')->value ?? 'ungrouped';
                if (!isset($groups[$groupId])) {
                    $groups[$groupId] = [
                        'id' => $groupId,
                        'name' => $this->formatGroupName($groupId),
                        'count' => 0,
                    ];
                }
                $groups[$groupId]['count']++;
            }

            return new JsonResponse(array_values($groups));
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Format group ID to readable name.
     */
    private function formatGroupName(string $groupId): string
    {
        if ($groupId === 'ungrouped') {
            return 'Ungrouped';
        }
        // Convert api_insight_lab_test to "API Perf Tester Test"
        return ucwords(str_replace('_', ' ', $groupId));
    }

    /**
     * Save an API snapshot.
     */
    public function saveSnapshot(SymfonyRequest $request): JsonResponse
    {
        $content = json_decode($request->getContent(), true);

        $config_id = $content['config_id'] ?? '';
        $snapshot_name = $content['snapshot_name'] ?? 'Snapshot ' . date('Y-m-d H:i:s');
        $test_results = $content['test_results'] ?? [];

        if (empty($config_id)) {
            return new JsonResponse(['error' => 'Config ID is required'], 400);
        }

        try {
            // Get next version number for this config
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            $query = $storage->getQuery()
                ->condition('config_id', $config_id)
                ->accessCheck(false);
            $count = $query->count()->execute();
            $version_number = $count + 1;

            // Extract data from test results
            $first_response = $test_results['firstResponse'] ?? [];
            $stats = $test_results['stats'] ?? [];
            $bottleneck = $test_results['bottleneck'] ?? [];

            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot $snapshot */
            $snapshot = \Drupal\api_insight_lab\Entity\ApiSnapshot::create([
                'config_id' => $config_id,
                'snapshot_name' => $snapshot_name,
                'version_number' => $version_number,
                'request_config' => json_encode($content['request_config'] ?? []),
                'response_body' => $first_response['body'] ?? '',
                'response_headers' => json_encode($first_response['headers'] ?? []),
                'status_code' => $first_response['status'] ?? 0,
                'response_time' => $stats['mean'] ?? 0,
                'performance_metrics' => json_encode([
                    'stats' => $stats,
                    'bottleneck' => $bottleneck,
                ]),
                'notes' => $content['notes'] ?? '',
            ]);
            $snapshot->save();

            return new JsonResponse([
                'success' => true,
                'version' => $version_number,
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get snapshots for a config, or all snapshots if no config_id provided.
     */
    public function getSnapshots(?string $config_id = null): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            $query = $storage->getQuery()
                ->accessCheck(false);

            // Only filter by config_id if provided
            if ($config_id !== null) {
                $query->condition('config_id', $config_id);
            }

            $query->sort('created', 'DESC');
            $ids = $query->execute();
            $entities = $storage->loadMultiple($ids);

            $snapshots = [];
            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot $entity */
            foreach ($entities as $entity) {
                // Extract URL and method from request_config JSON
                $requestConfig = json_decode($entity->get('request_config')->value ?? '{}', true);

                $snapshots[] = [
                    'id' => $entity->id(),
                    'config_id' => $entity->get('config_id')->value,
                    'snapshot_name' => $entity->get('snapshot_name')->value,
                    'version_number' => $entity->get('version_number')->value,
                    'status_code' => $entity->get('status_code')->value,
                    'response_time' => $entity->get('response_time')->value,
                    'created' => $entity->get('created')->value,
                    'notes' => $entity->get('notes')->value,
                    'url' => $requestConfig['url'] ?? '',
                    'method' => $requestConfig['method'] ?? 'GET',
                ];
            }

            return new JsonResponse($snapshots);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a single snapshot.
     */
    public function getSnapshot(string $id): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot|null $snapshot */
            $snapshot = $storage->load($id);

            if (!$snapshot) {
                return new JsonResponse(['error' => 'Snapshot not found'], 404);
            }

            return new JsonResponse([
                'id' => $snapshot->id(),
                'snapshot_name' => $snapshot->get('snapshot_name')->value,
                'version_number' => $snapshot->get('version_number')->value,
                'request_config' => json_decode($snapshot->get('request_config')->value, true),
                'response_body' => $snapshot->get('response_body')->value,
                'response_headers' => json_decode($snapshot->get('response_headers')->value, true),
                'status_code' => $snapshot->get('status_code')->value,
                'response_time' => $snapshot->get('response_time')->value,
                'performance_metrics' => json_decode($snapshot->get('performance_metrics')->value, true),
                'notes' => $snapshot->get('notes')->value,
                'created' => $snapshot->get('created')->value,
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Compare two snapshots.
     */
    public function compareSnapshots(string $id1, string $id2): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot|null $snapshot1 */
            $snapshot1 = $storage->load($id1);
            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot|null $snapshot2 */
            $snapshot2 = $storage->load($id2);

            if (!$snapshot1 || !$snapshot2) {
                return new JsonResponse(['error' => 'One or both snapshots not found'], 404);
            }

            // Get response bodies directly (they are stored as strings)
            $body1 = $snapshot1->get('response_body')->value ?? '';
            $body2 = $snapshot2->get('response_body')->value ?? '';

            return new JsonResponse([
                'snapshot1' => [
                    'id' => $snapshot1->id(),
                    'name' => $snapshot1->get('snapshot_name')->value,
                    'version' => $snapshot1->get('version_number')->value,
                    'status_code' => $snapshot1->get('status_code')->value,
                    'response_time' => $snapshot1->get('response_time')->value,
                    'response_body' => $body1,
                    'request_config' => json_decode($snapshot1->get('request_config')->value ?? '{}', true),
                    'created' => $snapshot1->get('created')->value,
                ],
                'snapshot2' => [
                    'id' => $snapshot2->id(),
                    'name' => $snapshot2->get('snapshot_name')->value,
                    'version' => $snapshot2->get('version_number')->value,
                    'status_code' => $snapshot2->get('status_code')->value,
                    'response_time' => $snapshot2->get('response_time')->value,
                    'response_body' => $body2,
                    'request_config' => json_decode($snapshot2->get('request_config')->value ?? '{}', true),
                    'created' => $snapshot2->get('created')->value,
                ],
                'diff' => $this->calculateDiff(
                    json_decode($body1, true) ?? $body1,
                    json_decode($body2, true) ?? $body2
                ),
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get all snapshots (for history/snapshot list view).
     */
    public function getAllSnapshots(): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            $query = $storage->getQuery()
                ->sort('created', 'DESC')
                ->range(0, 100) // Limit to last 100 snapshots
                ->accessCheck(false);
            $ids = $query->execute();
            $entities = $storage->loadMultiple($ids);

            $snapshots = [];
            /** @var \Drupal\api_insight_lab\Entity\ApiSnapshot $entity */
            foreach ($entities as $entity) {
                // Decode request_config to get URL and method
                $requestConfig = json_decode($entity->get('request_config')->value ?? '{}', true);

                $snapshots[] = [
                    'id' => $entity->id(),
                    'snapshot_name' => $entity->get('snapshot_name')->value,
                    'config_id' => $entity->get('config_id')->value,
                    'version_number' => $entity->get('version_number')->value,
                    'status_code' => $entity->get('status_code')->value,
                    'response_time' => $entity->get('response_time')->value,
                    'created' => $entity->get('created')->value,
                    'notes' => $entity->get('notes')->value,
                    // Include URL and method from request_config for grouping
                    'url' => $requestConfig['url'] ?? '',
                    'method' => $requestConfig['method'] ?? 'GET',
                ];
            }

            return new JsonResponse($snapshots);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a snapshot by ID.
     */
    public function deleteSnapshot(string $id): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');
            $entity = $storage->load($id);

            if (!$entity) {
                return new JsonResponse(['error' => 'Snapshot not found'], 404);
            }

            $entity->delete();

            return new JsonResponse(['success' => true, 'message' => 'Snapshot deleted successfully']);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calculate differences between two arrays.
     */
    private function calculateDiff($data1, $data2): array
    {
        $diff = [
            'added' => [],
            'removed' => [],
            'changed' => [],
        ];

        // Find added and changed keys
        foreach ($data2 as $key => $value) {
            if (!isset($data1[$key])) {
                $diff['added'][$key] = $value;
            } elseif ($data1[$key] !== $value) {
                $diff['changed'][$key] = [
                    'old' => $data1[$key],
                    'new' => $value,
                ];
            }
        }

        // Find removed keys
        foreach ($data1 as $key => $value) {
            if (!isset($data2[$key])) {
                $diff['removed'][$key] = $value;
            }
        }

        return $diff;
    }

    /**
     * Get global settings from State API.
     */
    public function getSettings(): JsonResponse
    {
        $state = \Drupal::state();
        $settings = $state->get('api_insight_lab.settings', [
            'baseUrl' => '',
            'defaultAuthType' => 'none',
            'defaultUsername' => '',
            'defaultPassword' => '',
            'defaultToken' => '',
            'defaultApiKey' => '',
            'defaultTimeout' => 30,
            'defaultConcurrency' => 10,
        ]);

        return new JsonResponse($settings);
    }

    /**
     * Save global settings to State API.
     */
    public function saveSettings(SymfonyRequest $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!$data) {
            return new JsonResponse(['error' => 'Invalid JSON'], 400);
        }

        $state = \Drupal::state();

        // Ensure we have all required fields with defaults
        $settings = [
            'baseUrl' => $data['baseUrl'] ?? '',
            'defaultAuthType' => $data['defaultAuthType'] ?? 'none',
            'defaultUsername' => $data['defaultUsername'] ?? '',
            'defaultPassword' => $data['defaultPassword'] ?? '',
            'defaultToken' => $data['defaultToken'] ?? '',
            'defaultApiKey' => $data['defaultApiKey'] ?? '',
            'defaultTimeout' => $data['defaultTimeout'] ?? 30,
            'defaultConcurrency' => $data['defaultConcurrency'] ?? 10,
        ];

        $state->set('api_insight_lab.settings', $settings);

        return new JsonResponse(['success' => true]);
    }

    /**
     * Get assertions for a config (internal helper).
     */
    private function getAssertionsForConfig(string $config_id): array
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_assertion');
            $assertions = $storage->loadByProperties(['config_id' => $config_id]);
        } catch (\Exception $e) {
            \Drupal::logger('api_insight_lab')->error('Failed to load assertions logic for config ' . $config_id . ': ' . $e->getMessage());
            return [];
        }

        $result = [];
        /** @var \Drupal\api_insight_lab\Entity\Assertion $assertion */
        foreach ($assertions as $assertion) {
            $result[] = [
                'id' => $assertion->id(),
                'assertion_type' => $assertion->get('assertion_type')->value,
                'field_path' => $assertion->get('field_path')->value,
                'operator' => $assertion->get('operator')->value,
                'expected_value' => $assertion->get('expected_value')->value,
                'enabled' => (bool) $assertion->get('enabled')->value,
            ];
        }
        return $result;
    }

    /**
     * Get assertions for a config (API endpoint).
     */
    public function getAssertions(string $config_id): JsonResponse
    {
        $result = $this->getAssertionsForConfig($config_id);
        return new JsonResponse($result);
    }

    /**
     * Save assertions for a config.
     */
    public function saveAssertions(SymfonyRequest $request): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);
            $config_id = $data['config_id'] ?? '';
            $assertions = $data['assertions'] ?? [];

            if (empty($config_id)) {
                return new JsonResponse(['error' => 'config_id is required'], 400);
            }

            $storage = \Drupal::entityTypeManager()->getStorage('api_assertion');

            // Delete existing assertions for this config
            $existing = $storage->loadByProperties(['config_id' => $config_id]);
            foreach ($existing as $entity) {
                $entity->delete();
            }

            // Create new assertions
            foreach ($assertions as $assertion) {
                \Drupal\api_insight_lab\Entity\Assertion::create([
                    'config_id' => $config_id,
                    'assertion_type' => $assertion['assertion_type'] ?? 'status_code',
                    'field_path' => $assertion['field_path'] ?? '',
                    'operator' => $assertion['operator'] ?? 'equals',
                    'expected_value' => $assertion['expected_value'] ?? '',
                    'enabled' => $assertion['enabled'] ?? true,
                ])->save();
            }

            return new JsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete an assertion.
     */
    public function deleteAssertion(string $id): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('api_assertion');
            $entity = $storage->load($id);

            if (!$entity) {
                return new JsonResponse(['error' => 'Assertion not found'], 404);
            }

            $entity->delete();
            return new JsonResponse(['success' => true]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Evaluate assertions against test response.
     */
    /**
     * Evaluate assertions against test response.
     *
     * @param array $assertions List of assertion arrays (not entities)
     * @param array $responseData Response data [status, body, headers]
     * @param array $stats Test statistics
     */
    protected function evaluateAssertions(array $assertions, array $responseData, array $stats): array
    {
        try {
            $results = [];
            foreach ($assertions as $assertion) {
                // Handle both array (from frontend/helper) and Entity (just in case, though unlikely path here)
                $type = is_array($assertion) ? ($assertion['assertion_type'] ?? '') : $assertion->get('assertion_type')->value;
                $operator = is_array($assertion) ? ($assertion['operator'] ?? '') : $assertion->get('operator')->value;
                $expected = is_array($assertion) ? ($assertion['expected_value'] ?? '') : $assertion->get('expected_value')->value;
                $fieldPath = is_array($assertion) ? ($assertion['field_path'] ?? '') : $assertion->get('field_path')->value;

                $result = [
                    'type' => $type,
                    'operator' => $operator,
                    'expected' => $expected,
                    'actual' => null,
                    'passed' => false,
                    'message' => ''
                ];

                switch ($type) {
                    case 'status_code':
                        $result['actual'] = $responseData['status'] ?? 0;
                        $result['passed'] = $this->evaluateOperator(
                            $result['actual'],
                            $operator,
                            (int) $result['expected']
                        );
                        break;

                    case 'response_time':
                        $result['actual'] = round($stats['mean'] ?? 0, 2);
                        $result['passed'] = $this->evaluateOperator(
                            $result['actual'],
                            $operator,
                            (float) $result['expected']
                        );
                        $result['actual'] .= 'ms';
                        $result['expected'] .= 'ms';
                        break;

                    case 'json_path':
                        $jsonPath = $fieldPath;
                        $responseBody = is_string($responseData['body'] ?? '')
                            ? json_decode($responseData['body'], true) ?? []
                            : ($responseData['body'] ?? []);

                        $result['actual'] = $this->extractJsonPath($responseBody, $jsonPath);

                        if ($operator === 'exists') {
                            $result['passed'] = $result['actual'] !== null;
                            $result['expected'] = 'exists';
                        } elseif ($operator === 'not_exists') {
                            $result['passed'] = $result['actual'] === null;
                            $result['expected'] = 'not exists';
                        } else {
                            $result['passed'] = $this->evaluateOperator(
                                $result['actual'],
                                $operator,
                                $result['expected']
                            );
                        }
                        break;

                    case 'header':
                        $headerName = $fieldPath;
                        $headers = $responseData['headers'] ?? [];
                        // Handle Guzzle header array vs simple array
                        $headerValue = null;

                        // normalize headers to lowercase keys for case-insensitive lookup
                        $normalizedHeaders = [];
                        foreach ($headers as $k => $v) {
                            $normalizedHeaders[strtolower($k)] = $v;
                        }

                        $headerNameLower = strtolower($headerName);
                        if (isset($normalizedHeaders[$headerNameLower])) {
                            $val = $normalizedHeaders[$headerNameLower];
                            $headerValue = is_array($val) ? implode(', ', $val) : $val;
                        }

                        $result['actual'] = $headerValue;

                        if ($operator === 'exists') {
                            $result['passed'] = $result['actual'] !== null;
                            $result['expected'] = 'exists';
                        } elseif ($operator === 'not_exists') {
                            $result['passed'] = $result['actual'] === null;
                            $result['expected'] = 'not exists';
                        } else {
                            $result['passed'] = $this->evaluateOperator(
                                $result['actual'],
                                $operator,
                                $result['expected']
                            );
                        }
                        break;
                }

                if (!$result['passed']) {
                    $result['message'] = "Expected {$type} {$operator} {$result['expected']}, but got " . ($result['actual'] ?? 'null');
                }

                $results[] = $result;
            }

            return $results;
        } catch (\Exception $e) {
            \Drupal::logger('api_insight_lab')->error('Assertion evaluation error: ' . $e->getMessage());
            return [['type' => 'error', 'passed' => false, 'message' => 'Evaluation error: ' . $e->getMessage(), 'expected' => '', 'actual' => '', 'operator' => '']];
        }
    }

    /**
     * Evaluate operator comparison.
     */
    protected function evaluateOperator($actual, string $operator, $expected): bool
    {
        switch ($operator) {
            case 'equals':
                return $actual == $expected;
            case 'contains':
                return str_contains((string) $actual, (string) $expected);
            case 'gt':
                return $actual > $expected;
            case 'lt':
                return $actual < $expected;
            case 'gte':
                return $actual >= $expected;
            case 'lte':
                return $actual <= $expected;
            case 'neq':
                return $actual != $expected;
            default:
                return false;
        }
    }

    /**
     * Extract value from JSON using JSONPath-like syntax.
     */
    protected function extractJsonPath(array $data, string $path)
    {
        if (empty($path)) {
            return null;
        }

        // Simple JSONPath implementation for $.field.subfield
        $path = ltrim($path, '$.');
        $keys = explode('.', $path);

        $value = $data;
        foreach ($keys as $key) {
            if (!is_array($value) || !isset($value[$key])) {
                return null;
            }
            $value = $value[$key];
        }

        return $value;
    }

    /**
     * API Discovery endpoint.
     * Returns enabled REST and JSON:API resources, grouped by path.
     */
    public function discovery(): JsonResponse
    {
        try {
            $discoveredApis = [];
            $stats = ['total' => 0, 'rest' => 0, 'jsonapi' => 0];

            // 1. Discovery REST Resources
            $restResourceConfigStorage = \Drupal::entityTypeManager()->getStorage('rest_resource_config');
            $enabledConfigs = $restResourceConfigStorage->loadMultiple();

            // Get base URL
            $baseUrl = \Drupal::request()->getSchemeAndHttpHost();

            // Get route provider
            $routeProvider = \Drupal::service('router.route_provider');
            $allRoutes = $routeProvider->getAllRoutes();

            $restRoutesByPath = [];

            if (!empty($enabledConfigs)) {
                foreach ($allRoutes as $routeName => $route) {
                    // Only process REST routes
                    if (!str_contains($routeName, 'rest.')) {
                        continue;
                    }

                    $path = $route->getPath();
                    $methods = $route->getMethods() ?: ['GET'];
                    $resourceId = $this->extractRestResourceId($routeName);

                    // Check if enabled
                    $isEnabled = false;
                    foreach ($enabledConfigs as $config) {
                        if ($config->id() === $resourceId) {
                            $isEnabled = true;
                            break;
                        }
                    }

                    if (!$isEnabled) {
                        continue;
                    }

                    if (!isset($restRoutesByPath[$path])) {
                        $restRoutesByPath[$path] = [
                            'path' => $path,
                            'url' => $baseUrl . $path,
                            'methods' => [],
                            'resource_id' => $resourceId,
                            'description' => $this->extractRestDescription($routeName, $config),
                            'type' => 'REST',
                        ];
                    }

                    foreach ($methods as $method) {
                        if (!in_array($method, $restRoutesByPath[$path]['methods'])) {
                            $restRoutesByPath[$path]['methods'][] = $method;
                        }
                    }
                }
                $discoveredApis = array_values($restRoutesByPath);
                $stats['rest'] = count($discoveredApis);
            }

            // 2. Discover JSON:API Resources (if module enabled)
            if (\Drupal::moduleHandler()->moduleExists('jsonapi')) {
                $jsonApiRoutes = [];
                foreach ($allRoutes as $routeName => $route) {
                    if (!str_starts_with($routeName, 'jsonapi.')) {
                        continue;
                    }

                    // Filter out internal JSON:API routes (like entry point)
                    $path = $route->getPath();
                    if ($path === '/jsonapi') {
                        continue;
                    }

                    // Extract resource type from route defaults
                    $defaults = $route->getDefaults();
                    $resourceType = $defaults['resource_type'] ?? null;

                    if (!$resourceType) {
                        continue;
                    }

                    if (!isset($jsonApiRoutes[$path])) {
                        $jsonApiRoutes[$path] = [
                            'path' => $path,
                            'url' => $baseUrl . $path,
                            'methods' => [],
                            'resource_id' => $resourceType, // e.g. node--article
                            'description' => "JSON:API Resource: " . $resourceType,
                            'type' => 'JSON:API',
                        ];
                    }

                    $methods = $route->getMethods() ?: ['GET'];
                    foreach ($methods as $method) {
                        // Filter standard JSON:API methods
                        if (!in_array($method, $jsonApiRoutes[$path]['methods'])) {
                            $jsonApiRoutes[$path]['methods'][] = $method;
                        }
                    }
                }

                $jsonApiList = array_values($jsonApiRoutes);
                $discoveredApis = array_merge($discoveredApis, $jsonApiList);
                $stats['jsonapi'] = count($jsonApiList);
            }

            $stats['total'] = count($discoveredApis);

            return new JsonResponse([
                'success' => true,
                'message' => "Found {$stats['total']} resources ({$stats['rest']} REST, {$stats['jsonapi']} JSON:API)",
                'apis' => $discoveredApis, // Flat list for table
                'grouped' => [
                    'REST Resources' => array_filter($discoveredApis, fn($a) => $a['type'] === 'REST'),
                    'JSON:API Resources' => array_filter($discoveredApis, fn($a) => $a['type'] === 'JSON:API'),
                ],
                'stats' => $stats,
            ]);

        } catch (\Exception $e) {
            \Drupal::logger('api_insight_lab')->error('API discovery failed: ' . $e->getMessage());
            return new JsonResponse([
                'success' => false,
                'message' => 'API discovery failed: ' . $e->getMessage(),
                'apis' => [],
            ], 500);
        }
    }

    /**
     * Extract REST resource ID from route name.
     * Example: rest.entity.node.GET -> entity.node
     */
    private function extractRestResourceId(string $routeName): string
    {
        // Pattern: rest.{resource_id}.{METHOD}
        $parts = explode('.', $routeName);

        // Remove 'rest' prefix and method suffix
        if (count($parts) >= 3) {
            array_shift($parts); // Remove 'rest'
            array_pop($parts);   // Remove method (GET, POST, etc.)
            return implode('.', $parts);
        }

        return $routeName;
    }

    /**
     * Extract description for REST resource.
     */
    private function extractRestDescription(string $routeName, $config): string
    {
        $label = $config->label();

        if (!empty($label)) {
            return $label;
        }

        // Fallback: clean up route name
        $description = str_replace(['rest.', '_', '.'], ' ', $routeName);
        return ucwords(trim($description));
    }

    /**
     * Helper to determine if a route is likely an API route.
     */
    private function isLikelyApiRoute(string $routeName, string $path, $route): bool
    {
        // Check if path contains 'api' or 'json'
        if (str_contains($path, '/api/') || str_contains($path, '/json')) {
            return true;
        }

        // Check if route name suggests API
        if (str_contains($routeName, 'api.') || str_contains($routeName, '.api')) {
            return true;
        }

        // Check route defaults for JSON format
        $defaults = $route->getDefaults();
        if (isset($defaults['_format']) && $defaults['_format'] === 'json') {
            return true;
        }

        return false;
    }

    /**
     * Extract a human-readable description from route name/path.
     */
    private function extractApiDescription(string $routeName, string $path, string $type): string
    {
        if ($type === 'jsonapi') {
            // Extract entity type from JSON:API path
            // Pattern: /jsonapi/{entity_type}/{bundle}
            $parts = explode('/', trim($path, '/'));
            if (count($parts) >= 3) {
                $entityType = $parts[1] ?? '';
                $bundle = $parts[2] ?? '';
                return ucfirst($bundle) . ' (' . ucfirst($entityType) . ')';
            }
        }

        // Fallback: clean up route name
        $description = str_replace(['_', '.', '-'], ' ', $routeName);
        $description = ucwords($description);

        return $description;
    }

    /**
     * Bulk action for snapshots (delete, export, etc).
     */
    public function bulkSnapshotAction(SymfonyRequest $request): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);
            $action = $data['action'] ?? '';
            $ids = $data['ids'] ?? [];

            if (empty($action) || empty($ids)) {
                return new JsonResponse(['error' => 'Action and IDs are required'], 400);
            }

            $storage = \Drupal::entityTypeManager()->getStorage('api_snapshot');

            switch ($action) {
                case 'delete':
                    $entities = $storage->loadMultiple($ids);
                    $storage->delete($entities);
                    return new JsonResponse([
                        'success' => true,
                        'message' => count($ids) . ' snapshot(s) deleted'
                    ]);

                default:
                    return new JsonResponse(['error' => 'Unknown action'], 400);
            }
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get detailed information for a single snapshot.
     */
    public function getSnapshotDetail(string $id): JsonResponse
    {
        // This is the same as getSnapshot method
        return $this->getSnapshot($id);
    }

    // =========================================================================
    // REQUEST CHAIN METHODS
    // =========================================================================

    /**
     * Get all saved request chains.
     */
    public function getChains(): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('request_chain');
            $entities = $storage->loadMultiple();

            $chains = [];
            /** @var \Drupal\api_insight_lab\Entity\RequestChain $entity */
            foreach ($entities as $entity) {
                $stepsJson = $entity->get('steps_json')->value ?? '[]';
                $chains[] = [
                    'id' => $entity->id(),
                    'name' => $entity->get('name')->value,
                    'description' => $entity->get('description')->value ?? '',
                    'steps' => json_decode($stepsJson, true) ?? [],
                    'created' => $entity->get('created')->value,
                ];
            }

            return new JsonResponse($chains);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Save a new request chain.
     */
    public function saveChain(SymfonyRequest $request): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);

            if (empty($data['name'])) {
                return new JsonResponse(['error' => 'Chain name is required'], 400);
            }

            if (empty($data['steps']) || !is_array($data['steps'])) {
                return new JsonResponse(['error' => 'At least one step is required'], 400);
            }

            $chain = \Drupal\api_insight_lab\Entity\RequestChain::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? '',
                'steps_json' => json_encode($data['steps']),
            ]);
            $chain->save();

            return new JsonResponse([
                'success' => true,
                'id' => $chain->id(),
                'message' => 'Chain saved successfully',
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update an existing request chain.
     */
    public function updateChain(string $id, SymfonyRequest $request): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('request_chain');
            /** @var \Drupal\api_insight_lab\Entity\RequestChain|null $chain */
            $chain = $storage->load($id);

            if (!$chain) {
                return new JsonResponse(['error' => 'Chain not found'], 404);
            }

            $data = json_decode($request->getContent(), true);

            if (!empty($data['name'])) {
                $chain->set('name', $data['name']);
            }
            if (isset($data['description'])) {
                $chain->set('description', $data['description']);
            }
            if (!empty($data['steps'])) {
                $chain->set('steps_json', json_encode($data['steps']));
            }

            $chain->save();

            return new JsonResponse([
                'success' => true,
                'message' => 'Chain updated successfully',
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a request chain.
     */
    public function deleteChain(string $id): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('request_chain');
            $chain = $storage->load($id);

            if (!$chain) {
                return new JsonResponse(['error' => 'Chain not found'], 404);
            }

            $chain->delete();

            return new JsonResponse([
                'success' => true,
                'message' => 'Chain deleted successfully',
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Run a request chain, executing steps sequentially with variable extraction.
     */
    public function runChain(SymfonyRequest $request): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);
            $steps = $data['steps'] ?? [];
            $globalVariables = $data['globalVariables'] ?? [];

            if (empty($steps)) {
                return new JsonResponse(['error' => 'No steps provided'], 400);
            }

            $client = $this->httpClientFactory->fromOptions([
                'timeout' => 30,
                'http_errors' => false,
                'verify' => false,
            ]);

            // Start with global variables, extracted variables will override them
            $variables = $globalVariables;
            $stepResults = [];
            $totalDuration = 0;
            $allSuccess = true;

            foreach ($steps as $index => $step) {
                $stepId = $step['id'] ?? (string) $index;
                $stepName = $step['name'] ?? "Step " . ($index + 1);

                // Replace variables in URL, headers, and body
                $url = $this->replaceVariables($step['url'] ?? '', $variables);
                $method = strtoupper($step['method'] ?? 'GET');
                $headers = $this->replaceVariablesInArray($step['headers'] ?? [], $variables);
                $body = $this->replaceVariables($step['body'] ?? '', $variables);

                // Handle authentication for this step
                $auth = $step['auth'] ?? [];
                if (!empty($auth['type'])) {
                    switch ($auth['type']) {
                        case 'basic':
                            if (!empty($auth['username'])) {
                                $headers['Authorization'] = 'Basic ' . base64_encode($auth['username'] . ':' . ($auth['password'] ?? ''));
                            }
                            break;
                        case 'bearer':
                            $token = $this->replaceVariables($auth['token'] ?? '', $variables);
                            if (!empty($token)) {
                                $headers['Authorization'] = 'Bearer ' . $token;
                            }
                            break;
                        case 'apikey':
                            $keyName = $auth['keyName'] ?? '';
                            $keyValue = $this->replaceVariables($auth['keyValue'] ?? '', $variables);
                            if (!empty($keyName) && !empty($keyValue)) {
                                $headers[$keyName] = $keyValue;
                            }
                            break;
                    }
                }

                // Execute the request
                $startTime = microtime(true);
                try {
                    $guzzleRequest = new Request(
                        $method,
                        $url,
                        $headers,
                        in_array($method, ['POST', 'PUT', 'PATCH']) ? $body : null
                    );
                    $response = $client->send($guzzleRequest);
                    $duration = (microtime(true) - $startTime) * 1000;
                    $totalDuration += $duration;

                    $statusCode = $response->getStatusCode();
                    $responseBody = (string) $response->getBody();
                    $responseHeaders = $response->getHeaders();

                    // Extract variables from response
                    $extractedVars = [];
                    $extractions = $step['extractions'] ?? [];
                    foreach ($extractions as $extraction) {
                        $varName = $extraction['variableName'] ?? '';
                        $source = $extraction['source'] ?? 'body';
                        $path = $extraction['path'] ?? '';

                        if (empty($varName)) {
                            continue;
                        }

                        $value = null;
                        if ($source === 'body' && !empty($path)) {
                            $value = $this->extractJsonPathFromString($responseBody, $path);
                        } elseif ($source === 'header' && !empty($path)) {
                            $headerValues = $responseHeaders[$path] ?? [];
                            $value = is_array($headerValues) ? ($headerValues[0] ?? null) : $headerValues;
                        } elseif ($source === 'status') {
                            $value = $statusCode;
                        }

                        if ($value !== null) {
                            $variables[$varName] = $value;
                            $extractedVars[$varName] = $value;
                        }
                    }

                    // Evaluate assertions for this step
                    $assertions = $step['assertions'] ?? [];
                    $assertionResults = [];
                    if (!empty($assertions)) {
                        $responseData = [
                            'status' => $statusCode,
                            'body' => $responseBody,
                            'headers' => $responseHeaders,
                        ];
                        $stats = ['mean' => $duration];
                        $assertionResults = $this->evaluateAssertions($assertions, $responseData, $stats);
                    }

                    $stepSuccess = $statusCode >= 200 && $statusCode < 400;
                    if (!$stepSuccess) {
                        $allSuccess = false;
                    }

                    $stepResults[] = [
                        'stepId' => $stepId,
                        'stepName' => $stepName,
                        'success' => $stepSuccess,
                        'status' => $statusCode,
                        'duration' => round($duration, 2),
                        'extractedVariables' => $extractedVars,
                        'assertions' => $assertionResults,
                        'error' => null,
                        'response' => [
                            'body' => $responseBody,
                            'headers' => $responseHeaders,
                        ],
                    ];

                    // If step failed and stopOnError is set, break the chain
                    if (!$stepSuccess && ($step['stopOnError'] ?? false)) {
                        break;
                    }
                } catch (\Exception $e) {
                    $duration = (microtime(true) - $startTime) * 1000;
                    $totalDuration += $duration;
                    $allSuccess = false;

                    $stepResults[] = [
                        'stepId' => $stepId,
                        'stepName' => $stepName,
                        'success' => false,
                        'status' => 0,
                        'duration' => round($duration, 2),
                        'extractedVariables' => [],
                        'assertions' => [],
                        'error' => $e->getMessage(),
                    ];

                    if ($step['stopOnError'] ?? true) {
                        break;
                    }
                }
            }

            return new JsonResponse([
                'success' => $allSuccess,
                'steps' => $stepResults,
                'variables' => $variables,
                'totalDuration' => round($totalDuration, 2),
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Replace {{variable}} placeholders in a string with actual values.
     */
    private function replaceVariables(string $text, array $variables): string
    {
        foreach ($variables as $name => $value) {
            $text = str_replace('{{' . $name . '}}', (string) $value, $text);
        }
        return $text;
    }

    /**
     * Replace variables in an array of key-value pairs.
     */
    private function replaceVariablesInArray(array $items, array $variables): array
    {
        $result = [];
        foreach ($items as $item) {
            $key = $item['key'] ?? '';
            $value = $item['value'] ?? '';
            if (!empty($key)) {
                $result[$key] = $this->replaceVariables($value, $variables);
            }
        }
        return $result;
    }

    /**
     * Extract a value from JSON string using a simple JSONPath-like syntax.
     * Supports: $.field, $.nested.field, $.array[0].field
     */
    private function extractJsonPathFromString(string $json, string $path): mixed
    {
        try {
            $data = json_decode($json, true);
            if ($data === null) {
                return null;
            }

            // Remove leading $. if present
            $path = preg_replace('/^\$\.?/', '', $path);
            if (empty($path)) {
                return $data;
            }

            // Split path into segments
            $segments = preg_split('/\.(?![^\[]*\])/', $path);
            $current = $data;

            foreach ($segments as $segment) {
                if ($current === null) {
                    return null;
                }

                // Check for array index: field[0]
                if (preg_match('/^([^\[]+)\[(\d+)\]$/', $segment, $matches)) {
                    $field = $matches[1];
                    $index = (int) $matches[2];

                    if (!empty($field) && isset($current[$field])) {
                        $current = $current[$field];
                    }
                    if (is_array($current) && isset($current[$index])) {
                        $current = $current[$index];
                    } else {
                        return null;
                    }
                } else {
                    if (is_array($current) && isset($current[$segment])) {
                        $current = $current[$segment];
                    } else {
                        return null;
                    }
                }
            }

            return $current;
        } catch (\Exception $e) {
            return null;
        }
    }
}
