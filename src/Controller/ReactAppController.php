<?php

declare(strict_types=1);

namespace Drupal\api_insight_lab\Controller;

use Drupal\Core\Controller\ControllerBase;

/**
 * Controller for rendering React App.
 */
class ReactAppController extends ControllerBase
{
    /**
     * Render the React app.
     *
     * @return array
     *   Render array.
     */
    public function render(): array
    {
        return [
            '#type' => 'html_tag',
            '#tag' => 'div',
            '#attributes' => [
                'id' => 'root',
            ],
            '#attached' => [
                'library' => [
                    'api_insight_lab/react_app',
                ],
                'drupalSettings' => [
                    'api_insight_lab' => [
                        'csrf_token' => \Drupal::service('csrf_token')->get(),
                        'api_endpoint' => '/api/perf-test/run',
                    ],
                ],
            ],
        ];
    }
}
