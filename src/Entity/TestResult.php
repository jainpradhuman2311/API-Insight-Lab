<?php

/**
 * @file
 * Contains \Drupal\api_insight_lab\Entity\TestResult.
 */

declare(strict_types=1);

namespace Drupal\api_insight_lab\Entity;

use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Entity\ContentEntityInterface;

/**
 * Defines the Test Result entity.
 *
 * @ContentEntityType(
 *   id = "api_perf_result",
 *   label = @Translation("Test Result"),
 *   base_table = "api_perf_result",
 *   entity_keys = {
 *     "id" = "id",
 *     "uuid" = "uuid",
 *     "created" = "created",
 *   },
 *   admin_permission = "administer site configuration",
 *   handlers = {
 *     "view_builder" = "Drupal\Core\Entity\EntityViewBuilder",
 *     "list_builder" = "Drupal\api_insight_lab\TestResultListBuilder",
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
 *     "canonical" = "/admin/structure/api_perf_result/{api_perf_result}",
 *     "add-form" = "/admin/structure/api_perf_result/add",
 *     "edit-form" = "/admin/structure/api_perf_result/{api_perf_result}/edit",
 *     "delete-form" = "/admin/structure/api_perf_result/{api_perf_result}/delete",
 *     "collection" = "/admin/structure/api_perf_result",
 *   },
 * )
 */
class TestResult extends ContentEntityBase implements ContentEntityInterface
{
    /**
     * {@inheritdoc}
     */
    public static function baseFieldDefinitions(EntityTypeInterface $entity_type)
    {
        $fields = parent::baseFieldDefinitions($entity_type);

        $fields['url'] = BaseFieldDefinition::create('string')
            ->setLabel(t('URL'))
            ->setDescription(t('The URL tested.'))
            ->setSettings([
                'max_length' => 2048,
                'text_processing' => 0,
            ])
            ->setRequired(true);

        $fields['method'] = BaseFieldDefinition::create('string')
            ->setLabel(t('Method'))
            ->setDescription(t('The HTTP method used.'))
            ->setSettings([
                'max_length' => 10,
            ])
            ->setRequired(true);

        $fields['status'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Status Code'))
            ->setDescription(t('The HTTP status code returned.'));

        $fields['duration'] = BaseFieldDefinition::create('float')
            ->setLabel(t('Total Duration'))
            ->setDescription(t('Total duration of the test in seconds.'));

        $fields['avg_time'] = BaseFieldDefinition::create('float')
            ->setLabel(t('Average Response Time'))
            ->setDescription(t('Average response time per request in seconds.'));

        $fields['total_requests'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Total Requests'))
            ->setDescription(t('Number of requests made.'));

        $fields['error_count'] = BaseFieldDefinition::create('integer')
            ->setLabel(t('Error Count'))
            ->setDescription(t('Number of failed requests.'));

        $fields['created'] = BaseFieldDefinition::create('created')
            ->setLabel(t('Created'))
            ->setDescription(t('The time that the entity was created.'));

        return $fields;
    }
}
