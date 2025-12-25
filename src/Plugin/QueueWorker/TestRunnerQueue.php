<?php

namespace Drupal\api_perf_tester\Plugin\QueueWorker;

use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\RequestException;
use Drupal\api_perf_tester\Entity\TestResult;

/**
 * Processes API performance tests in the background.
 *
 * @QueueWorker(
 *   id = "api_perf_test_runner",
 *   title = @Translation("API Perf Test Runner"),
 *   cron = {"time" = 60}
 * )
 */
class TestRunnerQueue extends QueueWorkerBase implements ContainerFactoryPluginInterface
{
    /**
     * The HTTP client.
     *
     * @var \GuzzleHttp\ClientInterface
     */
    protected $httpClient;

    /**
     * Constructs a new TestRunnerQueue object.
     *
     * @param array $configuration
     *   A configuration array containing information about the plugin instance.
     * @param string $plugin_id
     *   The plugin_id for the plugin instance.
     * @param mixed $plugin_definition
     *   The plugin implementation definition.
     * @param \GuzzleHttp\ClientInterface $http_client
     *   The HTTP client.
     */
    public function __construct(array $configuration, $plugin_id, $plugin_definition, ClientInterface $http_client)
    {
        parent::__construct($configuration, $plugin_id, $plugin_definition);
        $this->httpClient = $http_client;
    }

    /**
     * {@inheritdoc}
     */
    public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition)
    {
        return new static(
            $configuration,
            $plugin_id,
            $plugin_definition,
            $container->get('http_client')
        );
    }

    /**
     * {@inheritdoc}
     */
    public function processItem($data)
    {
        // $data contains details needed to run the test:
        // url, method, concurrency, iterations, headers, body, auth

        $url = $data['url'];
        $method = $data['method'];
        $concurrency = $data['concurrency'];
        $iterations = $data['iterations'];
        $headers = $data['headers'] ?? [];
        $body = $data['body'] ?? null;

        // Logic to simulate running the test
        // Note: In PHP, true concurrent async requests are tricky without libraries like
        // Guzzle Promises. We'll use concurrent promises here.

        $promises = [];
        $startTime = microtime(true);

        // Prepare requests
        // For simplicity in this queue worker, we might run them in batches or simple loop
        // But ideally we use asynchronous promises.

        // ... (Implementation of actual test logic similar to JS side but in PHP)
        // For MVP validation, we'll implement a basic loop or promise batch
        // This is a placeholder for the actual heavy lifting logic

        // Mock result for now to verify Queue mechanism
        // In full implementation, we would execute requests here.

        $totalRequests = $concurrency * $iterations;
        $successCount = 0;
        $errorCount = 0;
        // ... Execution logic ...

        // Create Result Entity
        $result = TestResult::create([
            'url' => $url,
            'method' => $method,
            'status' => 200, // Aggregate status
            'duration' => 0.5, // Mocked
            'avg_time' => 0.05,
            'total_requests' => $totalRequests,
            'error_count' => $errorCount,
        ]);
        $result->save();
    }
}
