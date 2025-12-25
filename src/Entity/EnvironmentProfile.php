<?php

namespace Drupal\api_perf_tester\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;

/**
 * Defines the Environment Profile entity.
 *
 * @ContentEntityType(
 *   id = "environment_profile",
 *   label = @Translation("Environment Profile"),
 *   base_table = "environment_profile",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *     "label" = "name",
 *   },
 *   admin_permission = "administer site configuration",
 * )
 */
class EnvironmentProfile extends ContentEntityBase
{

    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['name'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Name'))
            ->setDescription(t('Environment name (e.g., Local, Dev, Staging, Production)'))
            ->setRequired(true)
            ->setSettings([
                'max_length' => 128,
            ]);

        $fields['base_url'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Base URL'))
            ->setDescription(t('Base URL for this environment'))
            ->setRequired(true)
            ->setSettings([
                'max_length' => 512,
            ]);

        $fields['variables'] = BaseFieldDefinition::create('string_long')
            ->setLabel(t('Variables'))
            ->setDescription(t('JSON encoded environment variables'));

        $fields['is_active'] = BaseFieldDefinition::create('boolean')
            ->setLabel(t('Active'))
            ->setDescription(t('Whether this is the active environment'))
            ->setDefaultValue(false);

        $fields['color'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Color'))
            ->setDescription(t('Color code for visual identification (green, yellow, red, blue, gray)'))
            ->setDefaultValue('gray')
            ->setSettings([
                'max_length' => 32,
            ]);

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time the profile was created'));

        $fields['changed'] = BaseFieldDefinition::create('changed')
            ->setLabel(t('Changed'))
            ->setDescription(t('The time the profile was last updated'));

        return $fields;
    }
}
