<?php

/**
 * @file
 * Contains \Drupal\api_insight_lab\Entity\Assertion.
 */

declare(strict_types=1);

namespace Drupal\api_insight_lab\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;

/**
 * Defines the Assertion entity.
 *
 * @ContentEntityType(
 *   id = "api_assertion",
 *   label = @Translation("API Assertion"),
 *   base_table = "api_assertion",
 *   entity_keys = {
 *     "id" = "id",
 *   },
 *   admin_permission = "administer site configuration",
 * )
 */
class Assertion extends ContentEntityBase
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields['id'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('ID'))
            ->setReadOnly(true);

        $fields['config_id'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Config ID'))
            ->setDescription(t('The ID of the API config this assertion belongs to'))
            ->setRequired(true)
            ->setSetting('max_length', 255);

        $fields['assertion_type'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Assertion Type'))
            ->setDescription(t('Type of assertion: status_code, response_time, json_path, header'))
            ->setRequired(true)
            ->setSetting('max_length', 50);

        $fields['field_path'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Field Path'))
            ->setDescription(t('JSONPath for json_path type, header name for header type'))
            ->setSetting('max_length', 500);

        $fields['operator'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Operator'))
            ->setDescription(t('Comparison operator: equals, contains, gt, lt, gte, lte, exists, not_exists'))
            ->setRequired(true)
            ->setSetting('max_length', 20);

        $fields['expected_value'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Expected Value'))
            ->setDescription(t('The expected value to compare against'));

        $fields['enabled'] = BaseFieldDefinition::create('boolean')
            ->setLabel(t('Enabled'))
            ->setDescription(t('Whether this assertion is enabled'))
            ->setDefaultValue(true);

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time the assertion was created'));

        return $fields;
    }
}
