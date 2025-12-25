<?php

namespace Drupal\api_insight_lab;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;
use Drupal\Core\Link;

/**
 * Defines a class to build a listing of API Test Config entities.
 *
 * @ingroup api_insight_lab
 */
class ApiTestConfigListBuilder extends EntityListBuilder
{
    /**
     * {@inheritdoc}
     */
    public function buildHeader()
    {
        $header['id'] = $this->t('ID');
        $header['name'] = $this->t('Name');
        $header['url'] = $this->t('URL');
        $header['method'] = $this->t('Method');
        return $header + parent::buildHeader();
    }

    /**
     * {@inheritdoc}
     */
    public function buildRow(EntityInterface $entity)
    {
        /** @var \Drupal\api_insight_lab\Entity\ApiTestConfig $entity */
        $row['id'] = $entity->id();
        $row['name'] = Link::createFromRoute(
            $entity->label(),
            'entity.api_test_config.edit_form',
            ['api_test_config' => $entity->id()]
        );
        $row['url'] = $entity->url->value;
        $row['method'] = $entity->method->value;
        return $row + parent::buildRow($entity);
    }
}
