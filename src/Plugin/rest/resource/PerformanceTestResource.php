<?php

namespace Drupal\api_perf_tester\Plugin\rest\resource;

use Drupal\rest\Plugin\ResourceBase;
use Drupal\rest\ResourceResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Provides a Performance Test resource.
 *
 * @RestResource(
 *   id = "api_perf_tester_test",
 *   label = @Translation("Performance Test Resource"),
 *   uri_paths = {
 *     "canonical" = "/rest/perf-test/{id}",
 *     "create" = "/rest/perf-test"
 *   }
 * )
 */
class PerformanceTestResource extends ResourceBase
{
    /**
     * Responds to GET requests.
     */
    public function get($id = null)
    {
        $data = [
            'status' => 'success',
            'id' => $id ?? 'all',
            'message' => 'Performance test resource GET response',
            'data' => [
                'items' => [
                    ['id' => 1, 'name' => 'Test Item 1', 'value' => rand(1, 100)],
                    ['id' => 2, 'name' => 'Test Item 2', 'value' => rand(1, 100)],
                    ['id' => 3, 'name' => 'Test Item 3', 'value' => rand(1, 100)],
                ],
                'timestamp' => time(),
            ],
        ];

        return new ResourceResponse($data);
    }

    /**
     * Responds to POST requests.
     */
    public function post(Request $request)
    {
        $content = json_decode($request->getContent(), true);

        $data = [
            'status' => 'created',
            'message' => 'Resource created successfully',
            'id' => rand(1000, 9999),
            'received_data' => $content,
            'timestamp' => time(),
        ];

        return new ResourceResponse($data, 201);
    }

    /**
     * Responds to PATCH requests.
     */
    public function patch($id, Request $request)
    {
        $content = json_decode($request->getContent(), true);

        $data = [
            'status' => 'updated',
            'message' => "Resource {$id} updated successfully",
            'id' => $id,
            'changes' => $content,
            'timestamp' => time(),
        ];

        return new ResourceResponse($data);
    }

    /**
     * Responds to DELETE requests.
     */
    public function delete($id)
    {
        $data = [
            'status' => 'deleted',
            'message' => "Resource {$id} deleted successfully",
            'id' => $id,
            'timestamp' => time(),
        ];

        return new ResourceResponse($data);
    }
}
