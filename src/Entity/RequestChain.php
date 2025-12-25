<?php

/**
 * @file
 * Contains \Drupal\api_perf_tester\Entity\RequestChain.
 */

declare(strict_types=1);

namespace Drupal\api_perf_tester\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Entity\ContentEntityInterface;

/**
 * Defines the Request Chain entity for storing chained API requests.
 *
 * @ContentEntityType(
 *   id = "request_chain",
 *   label = @Translation("Request Chain"),
 *   base_table = "request_chain",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *     "label" = "name",
 *   },
 *   admin_permission = "administer site configuration",
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
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
 *     "canonical" = "/admin/structure/request_chain/{request_chain}",
 *     "add-form" = "/admin/structure/request_chain/add",
 *     "edit-form" = "/admin/structure/request_chain/{request_chain}/edit",
 *     "delete-form" = "/admin/structure/request_chain/{request_chain}/delete",
 *     "collection" = "/admin/structure/request_chain",
 *   },
 * )
 */
class RequestChain extends ContentEntityBase implements ContentEntityInterface
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['name'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Chain Name'))
            ->setDescription(t('The name of the request chain.'))
            ->setSettings([
                'max_length' => 255,
                'text_processing' => 0,
            ])
            ->setRequired(true);

        $fields['description'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Description'))
            ->setDescription(t('Optional description of the chain.'))
            ->setSettings([
                'max_length' => 1024,
                'text_processing' => 0,
            ])
            ->setRequired(false);

        $fields['steps_json'] = BaseFieldDefinition::create('text_long')
            ->setLabel(t('Chain Steps'))
            ->setDescription(t('JSON array of ChainStep objects containing URL, method, headers, body, extractions, and assertions.'))
            ->setRequired(true);

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time that the chain was created.'));

        $fields['changed'] = BaseFieldDefinition::create('changed')
            ->setLabel(t('Changed'))
            ->setDescription(t('The time that the chain was last edited.'));

        return $fields;
    }
}
