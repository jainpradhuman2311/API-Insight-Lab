<?php

/**
 * @file
 * Contains \Drupal\api_perf_tester\Entity\ApiSnapshot.
 */

declare(strict_types=1);

namespace Drupal\api_perf_tester\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;

/**
 * Defines the API Snapshot entity.
 *
 * Stores versioned snapshots of API responses for tracking changes over time.
 *
 * @ContentEntityType(
 *   id = "api_snapshot",
 *   label = @Translation("API Snapshot"),
 *   base_table = "api_snapshot",
 *   entity_keys = {
 *     "id" = "id",
 *     "label" = "snapshot_name",
 *   },
 *   admin_permission = "administer site configuration",
 * )
 */
class ApiSnapshot extends ContentEntityBase
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['config_id'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Config ID'))
            ->setDescription(t('Reference to the API configuration.'))
            ->setRequired(true);

        $fields['snapshot_name'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Snapshot Name'))
            ->setDescription(t('Name/version of this snapshot (e.g., v1.0.0).'))
            ->setSettings([
                'max_length' => 255,
            ])
            ->setRequired(true);

        $fields['version_number'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Version Number'))
            ->setDescription(t('Auto-incremented version number.'))
            ->setDefaultValue(1);

        $fields['request_config'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Request Configuration'))
            ->setDescription(t('Serialized request configuration (method, headers, body, etc).'));

        $fields['response_body'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Response Body'))
            ->setDescription(t('The API response body.'));

        $fields['response_headers'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Response Headers'))
            ->setDescription(t('Serialized response headers.'));

        $fields['status_code'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Status Code'))
            ->setDescription(t('HTTP status code.'));

        $fields['response_time'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Response Time'))
            ->setDescription(t('Response time in milliseconds.'));

        $fields['performance_metrics'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Performance Metrics'))
            ->setDescription(t('Serialized performance data (timing breakdown, etc).'));

        $fields['notes'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Notes'))
            ->setDescription(t('Optional notes about this snapshot.'));

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time the snapshot was created.'));

        return $fields;
    }
}
