<?php

/**
 * @file
 * Contains \Drupal\api_insight_lab\Entity\ApiTestConfig.
 */

declare(strict_types=1);

namespace Drupal\api_insight_lab\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Entity\ContentEntityInterface;

/**
 * Defines the API Test Configuration entity (Presets).
 *
 * @ContentEntityType(
 *   id = "api_test_config",
 *   label = @Translation("API Test Config"),
 *   base_table = "api_test_config",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *     "label" = "name",
 *   },
 *   admin_permission = "administer site configuration",
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
 *     "list_builder" = "Drupal\api_insight_lab\ApiTestConfigListBuilder",
 *     "views_data" = "Drupal\views\EntityViewsData",
 *     "form" = {
 *       "default" = "Drupal\Core\Entity\ContentEntityForm",
 *       "add" = "Drupal\Core\Entity\ContentEntityForm",
 *       "edit" = "Drupal\Core\Entity\ContentEntityForm",
 *       "delete" = "Drupal\Core\Entity\ContentEntityDeleteForm",
 *     },
 *     "route_provider" = {
 *       "html" = "Drupal\Core\Entity\Routing\AdminHtmlRouteProvider",
 *     },
 *   },
 *   links = {
 *     "canonical" = "/admin/structure/api_test_config/{api_test_config}",
 *     "add-form" = "/admin/structure/api_test_config/add",
 *     "edit-form" = "/admin/structure/api_test_config/{api_test_config}/edit",
 *     "delete-form" = "/admin/structure/api_test_config/{api_test_config}/delete",
 *     "collection" = "/admin/structure/api_test_config",
 *   },
 * )
 */
class ApiTestConfig extends ContentEntityBase implements ContentEntityInterface
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['name'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Config Name'))
            ->setDescription(t('The name of the saved configuration.'))
            ->setSettings([
                'max_length' => 255,
                'text_processing' => 0,
            ])
            ->setRequired(true);

        $fields['url'] = BaseFieldDefinition::create('string')
            ->setLabel(t('URL'))
            ->setDescription(t('The URL.'))
            ->setSettings([
                'max_length' => 2048,
                'text_processing' => 0,
            ])
            ->setRequired(true);

        $fields['method'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Method'))
            ->setDescription(t('The HTTP method.'))
            ->setSettings([
                'max_length' => 10,
            ])
            ->setRequired(true);

        $fields['config_json'] = BaseFieldDefinition::create('text_long')
            ->setLabel(t('Configuration Data'))
            ->setDescription(t('JSON storage of headers, body, params, and auth settings.'))
            ->setRequired(true);

        $fields['group_id'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Group ID'))
            ->setDescription(t('Group identifier for organizing presets (e.g., api_insight_lab_test).'))
            ->setSettings([
                'max_length' => 255,
            ])
            ->setDefaultValue('ungrouped');

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time that the entity was created.'));

        $fields['changed'] = BaseFieldDefinition::create('changed')
            ->setLabel(t('Changed'))
            ->setDescription(t('The time that the entity was last edited.'));

        return $fields;
    }
}
