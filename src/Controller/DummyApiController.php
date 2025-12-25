<?php

declare(strict_types=1);

namespace Drupal\api_perf_tester\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Provides dummy API endpoints for testing the performance tester.
 */
class DummyApiController extends ControllerBase
{
    /**
     * Success endpoint - returns 200 OK with JSON.
     */
    public function success(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'success',
            'message' => 'This is a successful response',
            'data' => [
                'id' => rand(1, 1000),
                'name' => 'Test Item',
                'timestamp' => time(),
            ],
        ]);
    }

    /**
     * Slow endpoint - delays 2 seconds then returns 200.
     */
    public function slow(): JsonResponse
    {
        sleep(2);
        return new JsonResponse([
            'status' => 'success',
            'message' => 'This response was delayed by 2 seconds',
            'delay' => 2000,
        ]);
    }

    /**
     * Variable delay endpoint - accepts delay parameter.
     */
    public function variableDelay(): JsonResponse
    {
        $delay = min(10, max(0, (int) \Drupal::request()->query->get('delay', 1)));
        usleep($delay * 1000000);
        return new JsonResponse([
            'status' => 'success',
            'message' => "Response delayed by {$delay} seconds",
            'delay' => $delay * 1000,
        ]);
    }

    /**
     * Error 403 Forbidden endpoint.
     */
    public function error403(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'error',
            'code' => 403,
            'message' => 'Access denied. You do not have permission to access this resource.',
            'error_type' => 'ForbiddenError',
        ], 403);
    }

    /**
     * Error 404 Not Found endpoint.
     */
    public function error404(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'error',
            'code' => 404,
            'message' => 'The requested resource was not found.',
            'error_type' => 'NotFoundError',
        ], 404);
    }

    /**
     * Error 500 Server Error endpoint.
     */
    public function error500(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'error',
            'code' => 500,
            'message' => 'Internal server error occurred.',
            'error_type' => 'InternalServerError',
            'trace' => 'Simulated stack trace for testing purposes',
        ], 500);
    }

    /**
     * Error 502 Bad Gateway endpoint.
     */
    public function error502(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'error',
            'code' => 502,
            'message' => 'Bad gateway. The upstream server returned an invalid response.',
            'error_type' => 'BadGatewayError',
        ], 502);
    }

    /**
     * Error 503 Service Unavailable endpoint.
     */
    public function error503(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'error',
            'code' => 503,
            'message' => 'Service temporarily unavailable. Please try again later.',
            'error_type' => 'ServiceUnavailableError',
            'retry_after' => 30,
        ], 503);
    }

    /**
     * Random status endpoint - randomly returns different status codes.
     */
    public function random(): JsonResponse
    {
        $statuses = [
            ['code' => 200, 'message' => 'Success'],
            ['code' => 200, 'message' => 'Success'],
            ['code' => 200, 'message' => 'Success'],
            ['code' => 201, 'message' => 'Created'],
            ['code' => 400, 'message' => 'Bad Request'],
            ['code' => 401, 'message' => 'Unauthorized'],
            ['code' => 403, 'message' => 'Forbidden'],
            ['code' => 404, 'message' => 'Not Found'],
            ['code' => 500, 'message' => 'Internal Server Error'],
            ['code' => 503, 'message' => 'Service Unavailable'],
        ];

        $selected = $statuses[array_rand($statuses)];

        return new JsonResponse([
            'status' => $selected['code'] < 400 ? 'success' : 'error',
            'code' => $selected['code'],
            'message' => $selected['message'],
            'random' => true,
        ], $selected['code']);
    }

    /**
     * Large response endpoint - returns a large JSON payload.
     */
    public function largeResponse(): JsonResponse
    {
        $items = [];
        for ($i = 0; $i < 100; $i++) {
            $items[] = [
                'id' => $i,
                'uuid' => sprintf(
                    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000,
                    mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff),
                    mt_rand(0, 0xffff)
                ),
                'name' => 'Item ' . $i,
                'description' => 'This is a longer description for item ' . $i . ' to increase payload size.',
                'created' => date('c', time() - rand(0, 86400 * 30)),
                'metadata' => [
                    'category' => ['A', 'B', 'C', 'D'][rand(0, 3)],
                    'tags' => ['tag1', 'tag2', 'tag3'],
                    'score' => rand(0, 100) / 10,
                ],
            ];
        }

        return new JsonResponse([
            'status' => 'success',
            'count' => count($items),
            'items' => $items,
        ]);
    }

    /**
     * Echo endpoint - echoes back the request data.
     */
    public function echo(): JsonResponse
    {
        $request = \Drupal::request();

        return new JsonResponse([
            'status' => 'success',
            'request' => [
                'method' => $request->getMethod(),
                'uri' => $request->getRequestUri(),
                'headers' => $request->headers->all(),
                'query' => $request->query->all(),
                'body' => $request->getContent(),
            ],
        ]);
    }

    /**
     * Health check endpoint.
     */
    public function health(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'healthy',
            'timestamp' => time(),
            'uptime' => rand(1000, 999999),
            'version' => '1.0.0',
        ]);
    }

    /**
     * Authenticated endpoint - requires a specific header.
     */
    public function authenticated(): JsonResponse
    {
        $request = \Drupal::request();
        $authHeader = $request->headers->get('Authorization');

        if (empty($authHeader)) {
            return new JsonResponse([
                'status' => 'error',
                'code' => 401,
                'message' => 'Authorization header is required',
            ], 401);
        }

        if (str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            if (strlen($token) < 10) {
                return new JsonResponse([
                    'status' => 'error',
                    'code' => 403,
                    'message' => 'Invalid token format',
                ], 403);
            }
        }

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Authentication successful',
            'user' => [
                'id' => 1,
                'name' => 'Test User',
                'role' => 'admin',
            ],
        ]);
    }

    /**
     * List all available test endpoints.
     */
    public function listEndpoints(): JsonResponse
    {
        $baseUrl = \Drupal::request()->getSchemeAndHttpHost();

        return new JsonResponse([
            'status' => 'success',
            'message' => 'Available test endpoints for API Performance Tester',
            'endpoints' => [
                [
                    'name' => 'Success',
                    'url' => $baseUrl . '/api/test/success',
                    'method' => 'GET',
                    'description' => 'Returns 200 OK with sample JSON data',
                ],
                [
                    'name' => 'Slow Response',
                    'url' => $baseUrl . '/api/test/slow',
                    'method' => 'GET',
                    'description' => 'Delays 2 seconds before responding (for timeout testing)',
                ],
                [
                    'name' => 'Variable Delay',
                    'url' => $baseUrl . '/api/test/delay?delay=1',
                    'method' => 'GET',
                    'description' => 'Delays by specified seconds (0-10)',
                ],
                [
                    'name' => 'Error 403',
                    'url' => $baseUrl . '/api/test/error-403',
                    'method' => 'GET',
                    'description' => 'Returns 403 Forbidden error',
                ],
                [
                    'name' => 'Error 404',
                    'url' => $baseUrl . '/api/test/error-404',
                    'method' => 'GET',
                    'description' => 'Returns 404 Not Found error',
                ],
                [
                    'name' => 'Error 500',
                    'url' => $baseUrl . '/api/test/error-500',
                    'method' => 'GET',
                    'description' => 'Returns 500 Internal Server Error',
                ],
                [
                    'name' => 'Error 502',
                    'url' => $baseUrl . '/api/test/error-502',
                    'method' => 'GET',
                    'description' => 'Returns 502 Bad Gateway error',
                ],
                [
                    'name' => 'Error 503',
                    'url' => $baseUrl . '/api/test/error-503',
                    'method' => 'GET',
                    'description' => 'Returns 503 Service Unavailable error',
                ],
                [
                    'name' => 'Random Status',
                    'url' => $baseUrl . '/api/test/random',
                    'method' => 'GET',
                    'description' => 'Randomly returns various status codes (200, 400, 403, 500, etc.)',
                ],
                [
                    'name' => 'Large Response',
                    'url' => $baseUrl . '/api/test/large',
                    'method' => 'GET',
                    'description' => 'Returns a large JSON payload (~50KB)',
                ],
                [
                    'name' => 'Echo',
                    'url' => $baseUrl . '/api/test/echo',
                    'method' => 'ANY',
                    'description' => 'Echoes back request details (method, headers, body)',
                ],
                [
                    'name' => 'Health Check',
                    'url' => $baseUrl . '/api/test/health',
                    'method' => 'GET',
                    'description' => 'Simple health check endpoint',
                ],
                [
                    'name' => 'Authenticated',
                    'url' => $baseUrl . '/api/test/auth',
                    'method' => 'GET',
                    'description' => 'Requires Authorization header (returns 401/403 without)',
                ],
            ],
        ]);
    }
}
