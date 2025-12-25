<?php

/**
 * @file
 * Contains \Drupal\api_insight_lab\Entity\ApiSetting.
 */

declare(strict_types=1);

namespace Drupal\api_insight_lab\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Entity\ContentEntityInterface;

/**
 * Defines the API Setting entity.
 *
 * @ContentEntityType(
 *   id = "api_perf_setting",
 *   label = @Translation("API Setting"),
 *   base_table = "api_perf_setting",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *   },
 *   admin_permission = "administer site configuration",
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
 *     "list_builder" = "Drupal\api_insight_lab\ApiSettingListBuilder",
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
 *     "canonical" = "/admin/structure/api_perf_setting/{api_perf_setting}",
 *     "add-form" = "/admin/structure/api_perf_setting/add",
 *     "edit-form" = "/admin/structure/api_perf_setting/{api_perf_setting}/edit",
 *     "delete-form" = "/admin/structure/api_perf_setting/{api_perf_setting}/delete",
 *     "collection" = "/admin/structure/api_perf_setting",
 *   },
 * )
 */
class ApiSetting extends ContentEntityBase implements ContentEntityInterface
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['api_id'] = BaseFieldDefinition::create('string')
            ->setLabel(t('API ID'))
            ->setDescription(t('A unique hash identifier for the endpoint (e.g., hash of URL + method).'))
            ->setSettings([
                'max_length' => 255,
            ])
            ->setRequired(true)
            ->addConstraint('UniqueField');

        $fields['default_params'] = BaseFieldDefinition::create('map')
            ->setLabel(t('Default Parameters'))
            ->setDescription(t('JSON storage of default query parameters and headers.'));

        $fields['notes'] = BaseFieldDefinition::create('text_long')
            ->setLabel(t('Notes'))
            ->setDescription(t('User notes for this API endpoint.'))
            ->setDisplayOptions('view', [
                'label' => 'hidden',
                'type' => 'text_default',
                'weight' => 0,
            ])
            ->setDisplayOptions('form', [
                'type' => 'text_textarea',
                'weight' => 0,
            ]);

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time that the entity was created.'));

        $fields['changed'] = BaseFieldDefinition::create('changed')
            ->setLabel(t('Changed'))
            ->setDescription(t('The time that the entity was last edited.'));

        return $fields;
    }
}
