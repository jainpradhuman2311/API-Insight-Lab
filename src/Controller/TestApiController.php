<?php

namespace Drupal\api_insight_lab\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Test API Controller for testing the API Performance Tester.
 */
class TestApiController
{
    /**
     * Simple health check endpoint.
     */
    public function health(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'ok',
            'timestamp' => time(),
            'message' => 'API is healthy',
        ]);
    }

    /**
     * Echo endpoint - returns whatever you send.
     */
    public function echo(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        return new JsonResponse([
            'echo' => $data,
            'method' => $request->getMethod(),
            'headers' => $request->headers->all(),
            'timestamp' => time(),
        ]);
    }

    /**
     * Delay endpoint - simulates slow API response.
     */
    public function delay(Request $request): JsonResponse
    {
        $params = $request->query->all();
        $delay = isset($params['ms']) ? min((int) $params['ms'], 5000) : 500;

        usleep($delay * 1000);

        return new JsonResponse([
            'delayed_by' => $delay . 'ms',
            'timestamp' => time(),
            'message' => "Response delayed by {$delay} milliseconds",
        ]);
    }

    /**
     * Status endpoint - returns specified HTTP status code.
     */
    public function status(int $code): JsonResponse
    {
        $code = min(max($code, 100), 599);

        $messages = [
            200 => 'OK',
            201 => 'Created',
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            500 => 'Internal Server Error',
            503 => 'Service Unavailable',
        ];

        return new JsonResponse([
            'status' => $code,
            'message' => $messages[$code] ?? 'Unknown Status',
            'timestamp' => time(),
        ], $code);
    }

    /**
     * Users list endpoint - for chain testing (Step 1: Get users).
     */
    public function users(): JsonResponse
    {
        $users = [
            ['id' => 1, 'name' => 'John Doe', 'email' => 'john@example.com', 'role' => 'admin'],
            ['id' => 2, 'name' => 'Jane Smith', 'email' => 'jane@example.com', 'role' => 'editor'],
            ['id' => 3, 'name' => 'Bob Johnson', 'email' => 'bob@example.com', 'role' => 'viewer'],
        ];

        return new JsonResponse([
            'users' => $users,
            'total' => count($users),
            'timestamp' => time(),
        ]);
    }

    /**
     * User detail endpoint - for chain testing (Step 2: Get user by ID).
     */
    public function user(int $id): JsonResponse
    {
        $users = [
            1 => ['id' => 1, 'name' => 'John Doe', 'email' => 'john@example.com', 'role' => 'admin', 'created' => '2024-01-15'],
            2 => ['id' => 2, 'name' => 'Jane Smith', 'email' => 'jane@example.com', 'role' => 'editor', 'created' => '2024-02-20'],
            3 => ['id' => 3, 'name' => 'Bob Johnson', 'email' => 'bob@example.com', 'role' => 'viewer', 'created' => '2024-03-10'],
        ];

        if (!isset($users[$id])) {
            return new JsonResponse(['error' => 'User not found', 'user_id' => $id], 404);
        }

        return new JsonResponse([
            'user' => $users[$id],
            'posts_count' => rand(5, 50),
            'last_login' => date('Y-m-d H:i:s', time() - rand(0, 86400)),
        ]);
    }

    /**
     * User posts endpoint - for chain testing (Step 3: Get posts by user ID).
     */
    public function userPosts(int $id): JsonResponse
    {
        $posts = [];
        $count = rand(2, 5);

        for ($i = 1; $i <= $count; $i++) {
            $posts[] = [
                'id' => ($id * 100) + $i,
                'user_id' => $id,
                'title' => "Post {$i} by User {$id}",
                'content' => "This is the content of post {$i}...",
                'created' => date('Y-m-d H:i:s', time() - rand(0, 604800)),
                'views' => rand(10, 1000),
            ];
        }

        return new JsonResponse([
            'user_id' => $id,
            'posts' => $posts,
            'total' => count($posts),
        ]);
    }

    /**
     * Authentication endpoint - for chain testing (returns a token).
     */
    public function login(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            return new JsonResponse([
                'error' => 'Username and password required',
            ], 400);
        }

        // Simulate authentication
        $token = base64_encode($username . ':' . time() . ':' . bin2hex(random_bytes(16)));

        return new JsonResponse([
            'success' => true,
            'token' => $token,
            'user' => [
                'username' => $username,
                'role' => 'admin',
            ],
            'expires_in' => 3600,
        ]);
    }

    /**
     * Protected resource endpoint - requires token from login.
     */
    public function protectedResource(Request $request): JsonResponse
    {
        $authHeader = $request->headers->get('Authorization', '');

        if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
            return new JsonResponse([
                'error' => 'Authorization header with Bearer token required',
            ], 401);
        }

        $token = substr($authHeader, 7);

        return new JsonResponse([
            'message' => 'Access granted to protected resource',
            'token_received' => substr($token, 0, 20) . '...',
            'secret_data' => [
                'api_key' => 'sk_live_' . bin2hex(random_bytes(8)),
                'quota' => rand(1000, 10000),
            ],
        ]);
    }

    /**
     * Create order endpoint - for chain testing (creates with products).
     */
    public function createOrder(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        $products = $data['products'] ?? [];
        $userId = $data['user_id'] ?? null;

        if (empty($products)) {
            return new JsonResponse(['error' => 'Products array required'], 400);
        }

        $orderId = 'ORD-' . strtoupper(bin2hex(random_bytes(4)));
        $total = array_reduce($products, function ($sum, $p) {
            return $sum + (($p['price'] ?? 10) * ($p['quantity'] ?? 1));
        }, 0);

        return new JsonResponse([
            'order_id' => $orderId,
            'user_id' => $userId,
            'products' => $products,
            'total' => $total,
            'status' => 'pending',
            'created' => date('Y-m-d H:i:s'),
        ], 201);
    }

    /**
     * Random data endpoint - returns random structured data.
     */
    public function random(): JsonResponse
    {
        return new JsonResponse([
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
            'number' => rand(1, 1000),
            'float' => round(mt_rand() / mt_getrandmax() * 100, 2),
            'boolean' => (bool) rand(0, 1),
            'color' => sprintf('#%06x', mt_rand(0, 0xFFFFFF)),
            'timestamp' => time(),
            'date' => date('Y-m-d'),
        ]);
    }
}
