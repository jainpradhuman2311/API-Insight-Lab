<?php

namespace Drupal\api_insight_lab\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

/**
 * Configure API Performance Tester global settings.
 */
class GlobalSettingsForm extends ConfigFormBase
{
    /**
     * {@inheritdoc}
     */
    public function getFormId()
    {
        return 'api_insight_lab_global_settings';
    }

    /**
     * {@inheritdoc}
     */
    protected function getEditableConfigNames()
    {
        return ['api_insight_lab.settings'];
    }

    /**
     * {@inheritdoc}
     */
    public function buildForm(array $form, FormStateInterface $form_state)
    {
        $config = $this->config('api_insight_lab.settings');

        $form['default_auth'] = [
            '#type' => 'details',
            '#title' => $this->t('Default Authentication'),
            '#open' => true,
        ];

        $form['default_auth']['auth_type'] = [
            '#type' => 'select',
            '#title' => $this->t('Auth Type'),
            '#options' => [
                'none' => $this->t('No Authentication'),
                'basic' => $this->t('Basic Auth'),
                'bearer' => $this->t('Bearer Token'),
                'apikey' => $this->t('API Key'),
            ],
            '#default_value' => $config->get('default_auth.type') ?: 'none',
        ];

        $form['default_auth']['basic_user'] = [
            '#type' => 'textfield',
            '#title' => $this->t('Username'),
            '#default_value' => $config->get('default_auth.basic_user'),
            '#states' => [
                'visible' => [
                    ':input[name="auth_type"]' => ['value' => 'basic'],
                ],
            ],
        ];

        $form['default_auth']['basic_pass'] = [
            '#type' => 'password',
            '#title' => $this->t('Password'),
            // Use a distinct key to allow seeing if a value is set without revealing it?
            // For now simple storage.
            '#default_value' => $config->get('default_auth.basic_pass'),
            '#states' => [
                'visible' => [
                    ':input[name="auth_type"]' => ['value' => 'basic'],
                ],
            ],
        ];

        $form['default_auth']['bearer_token'] = [
            '#type' => 'textfield',
            '#title' => $this->t('Bearer Token'),
            '#default_value' => $config->get('default_auth.bearer_token'),
            '#states' => [
                'visible' => [
                    ':input[name="auth_type"]' => ['value' => 'bearer'],
                ],
            ],
        ];

        $form['default_auth']['apikey_key'] = [
            '#type' => 'textfield',
            '#title' => $this->t('Key (Header Name)'),
            '#default_value' => $config->get('default_auth.apikey_key'),
            '#states' => [
                'visible' => [
                    ':input[name="auth_type"]' => ['value' => 'apikey'],
                ],
            ],
        ];

        $form['default_auth']['apikey_value'] = [
            '#type' => 'textfield',
            '#title' => $this->t('Value'),
            '#default_value' => $config->get('default_auth.apikey_value'),
            '#states' => [
                'visible' => [
                    ':input[name="auth_type"]' => ['value' => 'apikey'],
                ],
            ],
        ];

        return parent::buildForm($form, $form_state);
    }

    /**
     * {@inheritdoc}
     */
    public function submitForm(array &$form, FormStateInterface $form_state)
    {
        $this->config('api_insight_lab.settings')
            ->set('default_auth.type', $form_state->getValue('auth_type'))
            ->set('default_auth.basic_user', $form_state->getValue('basic_user'))
            ->set('default_auth.basic_pass', $form_state->getValue('basic_pass'))
            ->set('default_auth.bearer_token', $form_state->getValue('bearer_token'))
            ->set('default_auth.apikey_key', $form_state->getValue('apikey_key'))
            ->set('default_auth.apikey_value', $form_state->getValue('apikey_value'))
            ->save();

        parent::submitForm($form, $form_state);
    }
}
