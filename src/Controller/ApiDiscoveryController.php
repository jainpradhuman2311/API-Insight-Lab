<?php

declare(strict_types=1);

namespace Drupal\api_perf_tester\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for discovering and listing enabled API endpoints.
 */
class ApiDiscoveryController extends ControllerBase
{
    /**
     * Get all enabled API endpoints as JSON.
     */
    public function listApis(): JsonResponse
    {
        $apis = [];
        $baseUrl = \Drupal::request()->getSchemeAndHttpHost();

        // 1. Get enabled REST resources from config
        $restResources = $this->getEnabledRestResources($baseUrl);
        $apis = array_merge($apis, $restResources);

        // 2. Add our test endpoints
        $testEndpoints = $this->getTestEndpoints($baseUrl);
        $apis = array_merge($apis, $testEndpoints);

        // 3. Add sample endpoints
        $sampleEndpoints = $this->getSampleEndpoints($baseUrl);
        $apis = array_merge($apis, $sampleEndpoints);

        // Sort by category then path
        usort($apis, function ($a, $b) {
            $catCompare = strcmp($a['category'], $b['category']);
            if ($catCompare !== 0) {
                return $catCompare;
            }
            return strcmp($a['path'], $b['path']);
        });

        return new JsonResponse([
            'status' => 'success',
            'count' => count($apis),
            'apis' => $apis,
        ]);
    }

    /**
     * Get enabled REST resources from configuration.
     */
    protected function getEnabledRestResources(string $baseUrl): array
    {
        $apis = [];

        // Load all REST resource configs
        $configNames = \Drupal::configFactory()->listAll('rest.resource.');

        foreach ($configNames as $configName) {
            $config = \Drupal::configFactory()->get($configName);
            $status = $config->get('status');

            // Only include enabled resources
            if (!$status) {
                continue;
            }

            $resourceId = $config->get('id');
            $pluginId = $config->get('plugin_id');
            $granularity = $config->get('granularity');
            $configuration = $config->get('configuration');

            // Determine methods and formats based on granularity
            $methods = [];
            $formats = [];
            $auth = [];

            if ($granularity === 'method') {
                // Method-level configuration
                foreach ($configuration as $method => $methodConfig) {
                    if (is_string($method)) {
                        $methods[] = strtoupper($method);
                    }
                    if (isset($methodConfig['supported_formats'])) {
                        $formats = array_merge($formats, $methodConfig['supported_formats']);
                    }
                    if (isset($methodConfig['supported_auth'])) {
                        $auth = array_merge($auth, $methodConfig['supported_auth']);
                    }
                }
            } else {
                // Resource-level granularity - methods/formats/auth are direct arrays
                if (isset($configuration['methods']) && is_array($configuration['methods'])) {
                    $methods = array_map('strtoupper', $configuration['methods']);
                }
                if (isset($configuration['formats']) && is_array($configuration['formats'])) {
                    $formats = $configuration['formats'];
                }
                if (isset($configuration['authentication']) && is_array($configuration['authentication'])) {
                    $auth = $configuration['authentication'];
                }
                if (empty($methods)) {
                    $methods = ['GET'];
                }
            }

            $formats = array_unique($formats);
            $auth = array_unique($auth);

            // Build the path - REST resources typically use /resource_id pattern
            $path = '/rest/' . str_replace(':', '/', $pluginId);

            // Try to get the actual route path
            $routeProvider = \Drupal::service('router.route_provider');
            $routeNames = [
                'rest.' . $pluginId . '.GET',
                'rest.' . $pluginId . '.POST',
                'rest.' . $pluginId . '.PATCH',
                'rest.' . $pluginId . '.DELETE',
            ];

            foreach ($routeNames as $routeName) {
                try {
                    $route = $routeProvider->getRouteByName($routeName);
                    $path = $route->getPath();
                    break;
                } catch (\Exception $e) {
                    // Route not found, continue
                }
            }

            $apis[] = [
                'name' => $resourceId,
                'path' => $path,
                'url' => $baseUrl . $path,
                'methods' => $methods ?: ['GET'],
                'auth' => !empty($auth) ? implode(', ', $auth) : 'public',
                'format' => !empty($formats) ? implode(', ', $formats) : 'json',
                'category' => 'Enabled REST Resources',
                'description' => $this->getResourceDescription($pluginId),
            ];
        }

        return $apis;
    }

    /**
     * Get test endpoints.
     */
    protected function getTestEndpoints(string $baseUrl): array
    {
        return [
            [
                'name' => 'Test: Success',
                'path' => '/api/test/success',
                'url' => $baseUrl . '/api/test/success',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns 200 OK with sample JSON data',
            ],
            [
                'name' => 'Test: Slow Response',
                'path' => '/api/test/slow',
                'url' => $baseUrl . '/api/test/slow',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Delays 2 seconds before responding',
            ],
            [
                'name' => 'Test: Variable Delay',
                'path' => '/api/test/delay',
                'url' => $baseUrl . '/api/test/delay',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Variable delay endpoint (use ?delay=N)',
            ],
            [
                'name' => 'Test: Error 403',
                'path' => '/api/test/error-403',
                'url' => $baseUrl . '/api/test/error-403',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns 403 Forbidden error',
            ],
            [
                'name' => 'Test: Error 404',
                'path' => '/api/test/error-404',
                'url' => $baseUrl . '/api/test/error-404',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns 404 Not Found error',
            ],
            [
                'name' => 'Test: Error 500',
                'path' => '/api/test/error-500',
                'url' => $baseUrl . '/api/test/error-500',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns 500 Internal Server Error',
            ],
            [
                'name' => 'Test: Random Status',
                'path' => '/api/test/random',
                'url' => $baseUrl . '/api/test/random',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns random status codes (200, 400, 403, 500)',
            ],
            [
                'name' => 'Test: Large Payload',
                'path' => '/api/test/large',
                'url' => $baseUrl . '/api/test/large',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Returns a large JSON payload (~50KB)',
            ],
            [
                'name' => 'Test: Echo',
                'path' => '/api/test/echo',
                'url' => $baseUrl . '/api/test/echo',
                'methods' => ['GET', 'POST'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Echoes back request details',
            ],
            [
                'name' => 'Test: Health Check',
                'path' => '/api/test/health',
                'url' => $baseUrl . '/api/test/health',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Test Endpoints',
                'description' => 'Health check endpoint',
            ],
        ];
    }

    /**
     * Get sample endpoints.
     */
    protected function getSampleEndpoints(string $baseUrl): array
    {
        return [
            [
                'name' => 'Sample: Cached',
                'path' => '/api/perf-test/cached',
                'url' => $baseUrl . '/api/perf-test/cached',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Sample APIs',
                'description' => 'Sample cacheable endpoint',
            ],
            [
                'name' => 'Sample: Uncached',
                'path' => '/api/perf-test/uncached',
                'url' => $baseUrl . '/api/perf-test/uncached',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Sample APIs',
                'description' => 'Sample uncached endpoint',
            ],
            [
                'name' => 'Sample: Heavy Computation',
                'path' => '/api/perf-test/heavy',
                'url' => $baseUrl . '/api/perf-test/heavy',
                'methods' => ['GET'],
                'auth' => 'public',
                'format' => 'json',
                'category' => 'Sample APIs',
                'description' => 'Simulates heavy computation',
            ],
        ];
    }

    /**
     * Get description for a REST resource.
     */
    protected function getResourceDescription(string $pluginId): string
    {
        $descriptions = [
            'entity:node' => 'Drupal content nodes (articles, pages, etc.)',
            'entity:user' => 'Drupal user accounts',
            'entity:taxonomy_term' => 'Taxonomy terms for categorization',
            'entity:file' => 'File attachments and uploads',
            'entity:comment' => 'Comment entities',
            'entity:media' => 'Media entities (images, videos, etc.)',
            'entity:block_content' => 'Custom block content',
            'api_perf_tester_test' => 'Performance Test REST Resource',
        ];

        return $descriptions[$pluginId] ?? ucfirst(str_replace(['entity:', '_'], ['', ' '], $pluginId)) . ' REST resource';
    }
}
