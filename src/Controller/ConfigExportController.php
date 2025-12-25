<?php

namespace Drupal\api_perf_tester\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for configuration import/export operations.
 */
class ConfigExportController extends ControllerBase
{

    /**
     * Export selected configurations as JSON.
     */
    public function exportConfigs(Request $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            $presetIds = $content['presets'] ?? [];
            $chainIds = $content['chains'] ?? [];
            $includeAuth = $content['includeAuth'] ?? false;
            $environmentName = $content['environmentName'] ?? 'Unknown';

            $export = [
                'version' => '1.0',
                'exported_at' => date('c'),
                'source_environment' => $environmentName,
                'presets' => [],
                'chains' => [],
            ];

            // Export presets
            if (!empty($presetIds)) {
                $presetStorage = \Drupal::entityTypeManager()->getStorage('api_test_config');
                $presets = $presetStorage->loadMultiple($presetIds);

                foreach ($presets as $preset) {
                    $config = json_decode($preset->get('config_json')->value ?? '{}', true);

                    // Remove auth if not included
                    if (!$includeAuth) {
                        unset($config['authUsername'], $config['authPassword'], $config['authToken'], $config['authKeyValue']);
                    }

                    $export['presets'][] = [
                        'id' => $preset->id(),
                        'name' => $preset->get('name')->value,
                        'url' => $preset->get('url')->value,
                        'method' => $preset->get('method')->value,
                        'config' => $config,
                    ];
                }
            }

            // Export chains
            if (!empty($chainIds)) {
                $chainStorage = \Drupal::entityTypeManager()->getStorage('request_chain');
                $chains = $chainStorage->loadMultiple($chainIds);

                foreach ($chains as $chain) {
                    $steps = json_decode($chain->get('steps_json')->value ?? '[]', true);

                    // Remove auth from steps if not included
                    if (!$includeAuth) {
                        foreach ($steps as &$step) {
                            if (isset($step['auth'])) {
                                unset($step['auth']['password'], $step['auth']['token'], $step['auth']['keyValue']);
                            }
                        }
                    }

                    $export['chains'][] = [
                        'id' => $chain->id(),
                        'name' => $chain->get('name')->value,
                        'description' => $chain->get('description')->value ?? '',
                        'steps' => $steps,
                    ];
                }
            }

            // Detect base URLs used in export
            $detectedUrls = $this->detectBaseUrls($export);
            $export['detected_urls'] = $detectedUrls;

            return new JsonResponse($export);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Import configurations with URL mapping.
     */
    public function importConfigs(Request $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            $importData = $content['data'] ?? [];
            $urlMappings = $content['urlMappings'] ?? [];
            $replaceExisting = $content['replaceExisting'] ?? false;
            $updateGlobalVars = $content['updateGlobalVars'] ?? true;

            $imported = ['presets' => 0, 'chains' => 0, 'errors' => []];

            // Import presets
            if (!empty($importData['presets'])) {
                foreach ($importData['presets'] as $preset) {
                    try {
                        $url = $this->applyUrlMappings($preset['url'] ?? '', $urlMappings);
                        $config = $preset['config'] ?? [];

                        // Apply URL mappings to config URLs
                        if (isset($config['queryParams'])) {
                            foreach ($config['queryParams'] as &$param) {
                                $param['value'] = $this->applyUrlMappings($param['value'], $urlMappings);
                            }
                        }

                        $storage = \Drupal::entityTypeManager()->getStorage('api_test_config');

                        // Check for existing
                        $existing = $storage->loadByProperties(['name' => $preset['name']]);
                        if (!empty($existing) && !$replaceExisting) {
                            $imported['errors'][] = "Preset '{$preset['name']}' already exists, skipped";
                            continue;
                        }

                        if (!empty($existing) && $replaceExisting) {
                            $entity = reset($existing);
                            $entity->set('url', $url);
                            $entity->set('method', $preset['method'] ?? 'GET');
                            $entity->set('config_json', json_encode($config));
                            $entity->save();
                        } else {
                            $storage->create([
                                'name' => $preset['name'],
                                'url' => $url,
                                'method' => $preset['method'] ?? 'GET',
                                'config_json' => json_encode($config),
                            ])->save();
                        }

                        $imported['presets']++;
                    } catch (\Exception $e) {
                        $imported['errors'][] = "Failed to import preset '{$preset['name']}': " . $e->getMessage();
                    }
                }
            }

            // Import chains
            if (!empty($importData['chains'])) {
                foreach ($importData['chains'] as $chain) {
                    try {
                        $steps = $chain['steps'] ?? [];

                        // Apply URL mappings to step URLs
                        foreach ($steps as &$step) {
                            $step['url'] = $this->applyUrlMappings($step['url'] ?? '', $urlMappings);
                        }

                        $storage = \Drupal::entityTypeManager()->getStorage('request_chain');

                        // Check for existing
                        $existing = $storage->loadByProperties(['name' => $chain['name']]);
                        if (!empty($existing) && !$replaceExisting) {
                            $imported['errors'][] = "Chain '{$chain['name']}' already exists, skipped";
                            continue;
                        }

                        if (!empty($existing) && $replaceExisting) {
                            $entity = reset($existing);
                            $entity->set('description', $chain['description'] ?? '');
                            $entity->set('steps_json', json_encode($steps));
                            $entity->save();
                        } else {
                            $storage->create([
                                'name' => $chain['name'],
                                'description' => $chain['description'] ?? '',
                                'steps_json' => json_encode($steps),
                            ])->save();
                        }

                        $imported['chains']++;
                    } catch (\Exception $e) {
                        $imported['errors'][] = "Failed to import chain '{$chain['name']}': " . $e->getMessage();
                    }
                }
            }

            return new JsonResponse([
                'success' => true,
                'imported' => $imported,
                'message' => "Imported {$imported['presets']} presets and {$imported['chains']} chains",
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Batch import for large files.
     */
    public function importBatch(Request $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            $importData = $content['data'] ?? [];
            $urlMappings = $content['urlMappings'] ?? [];
            $replaceExisting = $content['replaceExisting'] ?? false;

            $totalItems = count($importData['presets'] ?? []) + count($importData['chains'] ?? []);

            if ($totalItems < 50) {
                // Not enough items for batch, use regular import
                return $this->importConfigs($request);
            }

            // Create batch operations
            $operations = [];

            foreach ($importData['presets'] ?? [] as $preset) {
                $operations[] = [
                    [static::class, 'importSinglePreset'],
                    [$preset, $urlMappings, $replaceExisting],
                ];
            }

            foreach ($importData['chains'] ?? [] as $chain) {
                $operations[] = [
                    [static::class, 'importSingleChain'],
                    [$chain, $urlMappings, $replaceExisting],
                ];
            }

            $batch = [
                'title' => t('Importing configurations'),
                'operations' => $operations,
                'finished' => [static::class, 'importBatchFinished'],
                'progressive' => true,
            ];

            batch_set($batch);

            // For API calls, process batch immediately
            $batch =& batch_get();
            $batch['progressive'] = false;
            batch_process();

            return new JsonResponse([
                'success' => true,
                'message' => "Batch import of {$totalItems} items completed",
            ]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Batch callback to import a single preset.
     */
    public static function importSinglePreset(array $preset, array $urlMappings, bool $replaceExisting, array &$context): void
    {
        try {
            $url = self::applyUrlMappingsStatic($preset['url'] ?? '', $urlMappings);
            $config = $preset['config'] ?? [];

            $storage = \Drupal::entityTypeManager()->getStorage('api_test_config');
            $existing = $storage->loadByProperties(['name' => $preset['name']]);

            if (!empty($existing) && !$replaceExisting) {
                $context['results']['skipped'][] = $preset['name'];
                return;
            }

            if (!empty($existing) && $replaceExisting) {
                $entity = reset($existing);
                $entity->set('url', $url);
                $entity->set('config_json', json_encode($config));
                $entity->save();
            } else {
                $storage->create([
                    'name' => $preset['name'],
                    'url' => $url,
                    'method' => $preset['method'] ?? 'GET',
                    'config_json' => json_encode($config),
                ])->save();
            }

            $context['results']['presets'][] = $preset['name'];
        } catch (\Exception $e) {
            $context['results']['errors'][] = $e->getMessage();
        }
    }

    /**
     * Batch callback to import a single chain.
     */
    public static function importSingleChain(array $chain, array $urlMappings, bool $replaceExisting, array &$context): void
    {
        try {
            $steps = $chain['steps'] ?? [];
            foreach ($steps as &$step) {
                $step['url'] = self::applyUrlMappingsStatic($step['url'] ?? '', $urlMappings);
            }

            $storage = \Drupal::entityTypeManager()->getStorage('request_chain');
            $existing = $storage->loadByProperties(['name' => $chain['name']]);

            if (!empty($existing) && !$replaceExisting) {
                $context['results']['skipped'][] = $chain['name'];
                return;
            }

            if (!empty($existing) && $replaceExisting) {
                $entity = reset($existing);
                $entity->set('steps_json', json_encode($steps));
                $entity->save();
            } else {
                $storage->create([
                    'name' => $chain['name'],
                    'description' => $chain['description'] ?? '',
                    'steps_json' => json_encode($steps),
                ])->save();
            }

            $context['results']['chains'][] = $chain['name'];
        } catch (\Exception $e) {
            $context['results']['errors'][] = $e->getMessage();
        }
    }

    /**
     * Batch finished callback.
     */
    public static function importBatchFinished(bool $success, array $results, array $operations): void
    {
        if ($success) {
            $presetCount = count($results['presets'] ?? []);
            $chainCount = count($results['chains'] ?? []);
            \Drupal::messenger()->addMessage(t('Imported @presets presets and @chains chains.', [
                '@presets' => $presetCount,
                '@chains' => $chainCount,
            ]));
        } else {
            \Drupal::messenger()->addError(t('Import failed.'));
        }
    }

    /**
     * Get environment profiles.
     */
    public function getEnvironmentProfiles(): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('environment_profile');
            $profiles = $storage->loadMultiple();

            $result = [];
            foreach ($profiles as $profile) {
                $result[] = [
                    'id' => $profile->id(),
                    'name' => $profile->get('name')->value,
                    'base_url' => $profile->get('base_url')->value,
                    'color' => $profile->get('color')->value ?? 'gray',
                    'variables' => json_decode($profile->get('variables')->value ?? '[]', true),
                    'is_active' => (bool) $profile->get('is_active')->value,
                ];
            }

            return new JsonResponse($result);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Save an environment profile.
     */
    public function saveEnvironmentProfile(Request $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            $storage = \Drupal::entityTypeManager()->getStorage('environment_profile');

            if (!empty($content['id'])) {
                $profile = $storage->load($content['id']);
                if ($profile) {
                    $profile->set('name', $content['name']);
                    $profile->set('base_url', $content['base_url']);
                    $profile->set('color', $content['color'] ?? 'gray');
                    $profile->set('variables', json_encode($content['variables'] ?? []));
                    $profile->save();
                    return new JsonResponse(['success' => true, 'id' => $profile->id()]);
                }
            }

            $profile = $storage->create([
                'name' => $content['name'],
                'base_url' => $content['base_url'],
                'color' => $content['color'] ?? 'gray',
                'variables' => json_encode($content['variables'] ?? []),
            ]);
            $profile->save();

            return new JsonResponse(['success' => true, 'id' => $profile->id()]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Set an environment as the active one.
     */
    public function setActiveEnvironment(Request $request): JsonResponse
    {
        try {
            $content = json_decode($request->getContent(), true);
            $activeId = $content['id'] ?? null;
            $storage = \Drupal::entityTypeManager()->getStorage('environment_profile');

            // First, deactivate all environments
            $profiles = $storage->loadMultiple();
            foreach ($profiles as $profile) {
                $profile->set('is_active', false);
                $profile->save();
            }

            // Activate the selected one
            if ($activeId) {
                $profile = $storage->load($activeId);
                if ($profile) {
                    $profile->set('is_active', true);
                    $profile->save();
                    return new JsonResponse(['success' => true, 'active' => $activeId]);
                }
            }

            return new JsonResponse(['success' => true, 'active' => null]);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete an environment profile.
     */
    public function deleteEnvironmentProfile(int $id): JsonResponse
    {
        try {
            $storage = \Drupal::entityTypeManager()->getStorage('environment_profile');
            $profile = $storage->load($id);

            if ($profile) {
                $profile->delete();
                return new JsonResponse(['success' => true]);
            }

            return new JsonResponse(['error' => 'Profile not found'], 404);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Detect base URLs in export data.
     */
    private function detectBaseUrls(array $data): array
    {
        $urls = [];

        // Collect URLs from presets
        foreach ($data['presets'] ?? [] as $preset) {
            $this->extractBaseUrl($preset['url'] ?? '', $urls);
        }

        // Collect URLs from chains
        foreach ($data['chains'] ?? [] as $chain) {
            foreach ($chain['steps'] ?? [] as $step) {
                $this->extractBaseUrl($step['url'] ?? '', $urls);
            }
        }

        return array_values(array_unique($urls));
    }

    /**
     * Extract base URL from a full URL.
     */
    private function extractBaseUrl(string $url, array &$urls): void
    {
        if (empty($url)) {
            return;
        }

        $parsed = parse_url($url);
        if (isset($parsed['scheme']) && isset($parsed['host'])) {
            $baseUrl = $parsed['scheme'] . '://' . $parsed['host'];
            if (isset($parsed['port'])) {
                $baseUrl .= ':' . $parsed['port'];
            }
            $urls[] = $baseUrl;
        }
    }

    /**
     * Apply URL mappings to a string.
     */
    private function applyUrlMappings(string $value, array $mappings): string
    {
        foreach ($mappings as $mapping) {
            $from = $mapping['from'] ?? '';
            $to = $mapping['to'] ?? '';
            if (!empty($from) && !empty($to)) {
                $value = str_replace($from, $to, $value);
            }
        }
        return $value;
    }

    /**
     * Static version for batch callbacks.
     */
    private static function applyUrlMappingsStatic(string $value, array $mappings): string
    {
        foreach ($mappings as $mapping) {
            $from = $mapping['from'] ?? '';
            $to = $mapping['to'] ?? '';
            if (!empty($from) && !empty($to)) {
                $value = str_replace($from, $to, $value);
            }
        }
        return $value;
    }
}
