import { useEffect, useRef } from 'react';
import {
  Chart,
  registerables,
  type ChartConfiguration,
  type ChartDataset,
} from 'chart.js';

Chart.register(...registerables);

interface GlucoseChartProps {
  type: 'line' | 'bar';
  labels: string[];
  datasets: ChartDataset<'line' | 'bar'>[];
  height?: number;
  emptyMessage?: string;
}

export function GlucoseChart({
  type,
  labels,
  datasets,
  height = 280,
  emptyMessage = 'No glucose readings recorded for this period yet.',
}: GlucoseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const hasData = labels.length > 0 && datasets.some((ds) => ds.data.some((v) => v !== null && v !== undefined));

  useEffect(() => {
    if (!canvasRef.current || !hasData) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const config: ChartConfiguration = {
      type,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              boxHeight: 8,
              color: '#334155',
              font: {
                family: 'DM Sans, sans-serif',
                size: 12,
                weight: 500,
              },
            },
          },
          tooltip: {
            backgroundColor: '#0F2942',
            titleColor: '#FFFFFF',
            bodyColor: '#E2E8F0',
            padding: 10,
            cornerRadius: 6,
            titleFont: { family: 'Plus Jakarta Sans, sans-serif', size: 12 },
            bodyFont: { family: 'JetBrains Mono, monospace', size: 12 },
            callbacks: {
              label(ctx) {
                const val = ctx.parsed.y;
                if (val === null || val === undefined) return '';
                return ` ${ctx.dataset.label}: ${val} mg/dL`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#64748B',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              font: { family: 'DM Sans, sans-serif', size: 11 },
            },
          },
          y: {
            beginAtZero: false,
            suggestedMin: 60,
            suggestedMax: 200,
            grid: {
              color: '#E2E8F0',
            },
            ticks: {
              color: '#64748B',
              font: { family: 'JetBrains Mono, monospace', size: 11 },
              callback(value) {
                return `${value} mg/dL`;
              },
            },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [type, labels, datasets, hasData]);

  if (!hasData) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center"
        style={{ height }}
      >
        <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
        <p className="mt-1 text-xs text-slate-500">
          Log fasting or post-meal values in Glucose Monitoring to visualize your trends here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
