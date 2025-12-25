<?php

declare(strict_types=1);

namespace Drupal\api_perf_tester\Controller;

use Drupal\Core\Cache\CacheableJsonResponse;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Request;

/**
 * Sample REST API controller for testing performance and caching.
 */
class SampleApiController extends ControllerBase
{
    /**
     * Returns cacheable JSON response with timing data.
     *
     * This endpoint demonstrates Drupal's caching mechanisms:
     * - Uses CacheableJsonResponse for proper cache headers
     * - Sets cache tags and max-age
     * - Returns X-Drupal-Cache header (HIT/MISS)
     *
     * @param \Symfony\Component\HttpFoundation\Request $request
     *   The request object.
     *
     * @return \Drupal\Core\Cache\CacheableJsonResponse
     *   A cacheable JSON response.
     */
    public function getCacheableData(Request $request): CacheableJsonResponse
    {
        // Simulate some processing time (50-150ms random delay).
        $processingTime = random_int(50, 150);
        usleep($processingTime * 1000);

        $data = [
            'status' => 'success',
            'message' => 'This is a cacheable response',
            'timestamp' => time(),
            'processing_time_ms' => $processingTime,
            'server_time' => date('Y-m-d H:i:s'),
            'random_id' => uniqid('data_', true),
            'cache_info' => [
                'max_age' => 60,
                'tags' => ['api_perf_tester:sample', 'config:system.site'],
                'contexts' => ['url.query_args'],
            ],
        ];

        $response = new CacheableJsonResponse($data);

        // Add cacheability metadata.
        $cacheMetadata = new CacheableMetadata();
        $cacheMetadata->setCacheMaxAge(60); // Cache for 60 seconds.
        $cacheMetadata->addCacheTags(['api_perf_tester:sample', 'config:system.site']);
        $cacheMetadata->addCacheContexts(['url.query_args']);

        $response->addCacheableDependency($cacheMetadata);

        // Add custom header to indicate this is a test endpoint.
        $response->headers->set('X-Api-Perf-Tester', 'sample-endpoint');

        return $response;
    }

    /**
     * Returns uncached JSON response (always fresh).
     *
     * This endpoint bypasses all caching to show the contrast
     * between cached and uncached responses.
     *
     * @param \Symfony\Component\HttpFoundation\Request $request
     *   The request object.
     *
     * @return \Drupal\Core\Cache\CacheableJsonResponse
     *   An uncacheable JSON response.
     */
    public function getUncachedData(Request $request): CacheableJsonResponse
    {
        // Simulate database query time (100-300ms random delay).
        $processingTime = random_int(100, 300);
        usleep($processingTime * 1000);

        $data = [
            'status' => 'success',
            'message' => 'This response is NEVER cached',
            'timestamp' => time(),
            'processing_time_ms' => $processingTime,
            'server_time' => date('Y-m-d H:i:s'),
            'random_id' => uniqid('fresh_', true),
            'cache_info' => [
                'max_age' => 0,
                'note' => 'This endpoint has max-age=0, forcing fresh response every time',
            ],
        ];

        $response = new CacheableJsonResponse($data);

        // Set cache max-age to 0 (no caching).
        $cacheMetadata = new CacheableMetadata();
        $cacheMetadata->setCacheMaxAge(0);

        $response->addCacheableDependency($cacheMetadata);
        $response->headers->set('X-Api-Perf-Tester', 'uncached-endpoint');

        return $response;
    }

    /**
     * Returns heavy computation response (simulated database load).
     *
     * This endpoint simulates a heavy query to demonstrate
     * the value of caching for expensive operations.
     *
     * @param \Symfony\Component\HttpFoundation\Request $request
     *   The request object.
     *
     * @return \Drupal\Core\Cache\CacheableJsonResponse
     *   A cacheable JSON response.
     */
    public function getHeavyData(Request $request): CacheableJsonResponse
    {
        // Simulate heavy computation (500-1000ms delay).
        $processingTime = random_int(500, 1000);
        usleep($processingTime * 1000);

        // Generate "expensive" data.
        $items = [];
        for ($i = 0; $i < 100; $i++) {
            $items[] = [
                'id' => $i + 1,
                'title' => 'Item ' . ($i + 1),
                'value' => md5((string) ($i + time())),
            ];
        }

        $data = [
            'status' => 'success',
            'message' => 'Heavy computation result (cached for 300 seconds)',
            'timestamp' => time(),
            'processing_time_ms' => $processingTime,
            'server_time' => date('Y-m-d H:i:s'),
            'item_count' => count($items),
            'items' => array_slice($items, 0, 5), // Only return first 5 in response.
            'cache_info' => [
                'max_age' => 300,
                'tags' => ['api_perf_tester:heavy'],
                'note' => 'Cached for 5 minutes to reduce server load',
            ],
        ];

        $response = new CacheableJsonResponse($data);

        // Long cache time for expensive operations.
        $cacheMetadata = new CacheableMetadata();
        $cacheMetadata->setCacheMaxAge(300); // Cache for 5 minutes.
        $cacheMetadata->addCacheTags(['api_perf_tester:heavy']);

        $response->addCacheableDependency($cacheMetadata);
        $response->headers->set('X-Api-Perf-Tester', 'heavy-endpoint');

        return $response;
    }

    /**
     * Returns user-specific data (cached per user).
     *
     * Demonstrates cache contexts - response varies by authenticated user.
     *
     * @param \Symfony\Component\HttpFoundation\Request $request
     *   The request object.
     *
     * @return \Drupal\Core\Cache\CacheableJsonResponse
     *   A cacheable JSON response.
     */
    public function getUserData(Request $request): CacheableJsonResponse
    {
        $processingTime = random_int(50, 100);
        usleep($processingTime * 1000);

        $currentUser = $this->currentUser();

        $data = [
            'status' => 'success',
            'message' => 'User-specific data (cached per user)',
            'timestamp' => time(),
            'processing_time_ms' => $processingTime,
            'server_time' => date('Y-m-d H:i:s'),
            'user' => [
                'id' => $currentUser->id(),
                'name' => $currentUser->getDisplayName(),
                'roles' => $currentUser->getRoles(),
                'authenticated' => $currentUser->isAuthenticated(),
            ],
            'cache_info' => [
                'max_age' => 120,
                'contexts' => ['user'],
                'note' => 'Cached separately for each authenticated user',
            ],
        ];

        $response = new CacheableJsonResponse($data);

        $cacheMetadata = new CacheableMetadata();
        $cacheMetadata->setCacheMaxAge(120);
        $cacheMetadata->addCacheContexts(['user']);
        $cacheMetadata->addCacheTags(['user:' . $currentUser->id()]);

        $response->addCacheableDependency($cacheMetadata);
        $response->headers->set('X-Api-Perf-Tester', 'user-endpoint');

        return $response;
    }
}
