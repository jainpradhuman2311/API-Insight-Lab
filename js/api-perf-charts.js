/**
 * @file
 * Chart rendering for API Performance Tester.
 */

(function (Drupal, drupalSettings, once) {
  'use strict';

  /**
   * Color palette for charts.
   */
  const COLORS = {
    primary: '#007bff',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    secondary: '#6c757d',
    dark: '#343a40',
    // Phase colors
    dns: '#6c757d',
    tcp: '#ffc107',
    tls: '#17a2b8',
    server: '#28a745',
    download: '#007bff'
  };

  /**
   * Chart instances storage.
   */
  let chartInstances = {};

  /**
   * Destroy existing chart if it exists.
   */
  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  /**
   * Render response time line chart.
   */
  function renderResponseTimeChart(canvasId, data) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Response Time (ms)',
          data: data.totalTimes,
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(0, 123, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        }, {
          label: 'TTFB (ms)',
          data: data.ttfbTimes,
          borderColor: COLORS.success,
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Response Time Over Iterations'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Iteration'
            }
          }
        }
      }
    });
  }

  /**
   * Render percentile horizontal bar chart.
   */
  function renderPercentileChart(canvasId, data) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['P50', 'P75', 'P90', 'P95', 'P99'],
        datasets: [{
          label: 'Response Time (ms)',
          data: [data.p50, data.p75, data.p90, data.p95, data.p99],
          backgroundColor: [
            COLORS.success,
            COLORS.info,
            COLORS.warning,
            '#fd7e14',
            COLORS.danger
          ],
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Percentile Distribution'
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          }
        }
      }
    });
  }

  /**
   * Render status code doughnut chart.
   */
  function renderStatusChart(canvasId, data) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['2xx Success', '3xx Redirect', '4xx Client Error', '5xx Server Error', 'Failed'],
        datasets: [{
          data: [data.success, data.redirect, data.clientError, data.serverError, data.failed],
          backgroundColor: [
            COLORS.success,
            COLORS.info,
            COLORS.warning,
            COLORS.danger,
            COLORS.dark
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Status Code Distribution'
          }
        }
      }
    });
  }

  /**
   * Render response time histogram.
   */
  function renderHistogramChart(canvasId, data) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Requests',
          data: data.counts,
          backgroundColor: COLORS.primary,
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Response Time Distribution'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Request Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Time Range (ms)'
            }
          }
        }
      }
    });
  }

  /**
   * Drupal behavior for API Performance Tester charts.
   */
  Drupal.behaviors.apiInsightLabCharts = {
    attach: function (context, settings) {
      // Check if chart data is available
      if (!settings.apiInsightLab || !settings.apiInsightLab.chartData) {
        return;
      }

      const chartData = settings.apiInsightLab.chartData;

      // Render charts once
      once('api-perf-charts', '#api-perf-charts-container', context).forEach(function () {
        // Response time line chart
        if (chartData.responseTime) {
          renderResponseTimeChart('response-time-chart', chartData.responseTime);
        }

        // Percentile chart
        if (chartData.percentiles) {
          renderPercentileChart('percentile-chart', chartData.percentiles);
        }

        // Status code chart
        if (chartData.statusCodes) {
          renderStatusChart('status-chart', chartData.statusCodes);
        }

        // Histogram
        if (chartData.histogram) {
          renderHistogramChart('histogram-chart', chartData.histogram);
        }
      });
    }
  };

  /**
   * Copy cURL command to clipboard.
   */
  Drupal.behaviors.apiInsightLabCurl = {
    attach: function (context) {
      once('api-perf-curl', '.curl-copy-btn', context).forEach(function (button) {
        button.addEventListener('click', function (e) {
          e.preventDefault();
          const curlText = document.getElementById('curl-command-text');
          if (curlText) {
            navigator.clipboard.writeText(curlText.textContent).then(function () {
              const originalText = button.textContent;
              button.textContent = '✓ Copied!';
              button.style.backgroundColor = '#28a745';
              setTimeout(function () {
                button.textContent = originalText;
                button.style.backgroundColor = '';
              }, 2000);
            });
          }
        });
      });
    }
  };

  /**
   * Response inspector tab switching.
   */
  Drupal.behaviors.apiInsightLabTabs = {
    attach: function (context) {
      once('api-perf-tabs', '.response-tab-btn', context).forEach(function (button) {
        button.addEventListener('click', function (e) {
          e.preventDefault();
          const tabId = this.getAttribute('data-tab');
          const container = this.closest('.response-inspector');

          // Remove active class from all tabs and panels
          container.querySelectorAll('.response-tab-btn').forEach(function (btn) {
            btn.classList.remove('active');
            btn.style.backgroundColor = '#e9ecef';
            btn.style.color = '#495057';
          });
          container.querySelectorAll('.response-tab-panel').forEach(function (panel) {
            panel.style.display = 'none';
          });

          // Activate clicked tab
          this.classList.add('active');
          this.style.backgroundColor = '#007bff';
          this.style.color = '#fff';
          container.querySelector('#' + tabId).style.display = 'block';
        });
      });
    }
  };

})(Drupal, drupalSettings, once);
