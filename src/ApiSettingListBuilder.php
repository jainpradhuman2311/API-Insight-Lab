<?php

namespace Drupal\api_perf_tester;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;
use Drupal\Core\Link;

/**
 * Defines a class to build a listing of API Setting entities.
 *
 * @ingroup api_perf_tester
 */
class ApiSettingListBuilder extends EntityListBuilder
{
    /**
     * {@inheritdoc}
     */
    public function buildHeader()
    {
        $header['id'] = $this->t('ID');
        $header['api_id'] = $this->t('API ID');
        $header['created'] = $this->t('Created');
        return $header + parent::buildHeader();
    }

    /**
     * {@inheritdoc}
     */
    public function buildRow(EntityInterface $entity)
    {
        /** @var \Drupal\api_perf_tester\Entity\ApiSetting $entity */
        $row['id'] = $entity->id();
        $row['api_id'] = Link::createFromRoute(
            $entity->api_id->value,
            'entity.api_perf_setting.edit_form',
            ['api_perf_setting' => $entity->id()]
        );
        $row['created'] = \Drupal::service('date.formatter')->format($entity->get('created')->value, 'short');
        return $row + parent::buildRow($entity);
    }
}
