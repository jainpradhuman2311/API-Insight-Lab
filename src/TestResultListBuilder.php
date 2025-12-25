<?php

namespace Drupal\api_perf_tester;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;
use Drupal\Core\Link;

/**
 * Defines a class to build a listing of Test Result entities.
 *
 * @ingroup api_perf_tester
 */
class TestResultListBuilder extends EntityListBuilder
{
    /**
     * {@inheritdoc}
     */
    public function buildHeader()
    {
        $header['id'] = $this->t('Test ID');
        $header['url'] = $this->t('URL');
        $header['method'] = $this->t('Method');
        $header['created'] = $this->t('Created');
        return $header + parent::buildHeader();
    }

    /**
     * {@inheritdoc}
     */
    public function buildRow(EntityInterface $entity)
    {
        /** @var \Drupal\api_perf_tester\Entity\TestResult $entity */
        $row['id'] = $entity->id();
        $row['url'] = Link::createFromRoute(
            $entity->url->value,
            'entity.api_perf_result.edit_form',
            ['api_perf_result' => $entity->id()]
        );
        $row['method'] = $entity->method->value;
        $row['created'] = \Drupal::service('date.formatter')->format($entity->get('created')->value, 'short');
        return $row + parent::buildRow($entity);
    }
}
