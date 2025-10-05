'use client';

import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ScoreDataPoint {
  date: string;
  score: number;
}

interface ScoreHistoryChartProps {
  data: ScoreDataPoint[];
  currentScore: number;
}

/**
 * @title Score History Chart Component
 * @notice Visualizes credit score trends over time
 * @dev Simple line chart with gradient fill and trend indicators
 */
export function ScoreHistoryChart({ data, currentScore }: ScoreHistoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800 p-8">
        <div className="text-center text-neutral-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h4 className="font-semibold mb-2">No Score History Yet</h4>
          <p className="text-sm">
            Your score will be tracked over time. Check back in a few days to see your trend.
          </p>
        </div>
      </Card>
    );
  }

  // Calculate trend
  const firstScore = data[0].score;
  const lastScore = data[data.length - 1].score;
  const change = lastScore - firstScore;
  const changePercent = ((change / firstScore) * 100).toFixed(1);

  const getTrendIcon = () => {
    if (change > 0) return <TrendingUp className="h-5 w-5 text-green-400" />;
    if (change < 0) return <TrendingDown className="h-5 w-5 text-red-400" />;
    return <Minus className="h-5 w-5 text-neutral-400" />;
  };

  const getTrendColor = () => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-neutral-400';
  };

  // SVG chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  // Scale data
  const minScore = Math.min(...data.map(d => d.score)) - 5;
  const maxScore = Math.max(...data.map(d => d.score)) + 5;
  const scoreRange = maxScore - minScore;

  const xScale = (index: number) =>
    padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);

  const yScale = (score: number) =>
    padding.top + ((maxScore - score) / scoreRange) * (height - padding.top - padding.bottom);

  // Generate path
  const linePath = data
    .map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.score);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  return (
    <Card className="bg-neutral-900/50 border-neutral-800 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Score History</h3>
          <p className="text-sm text-neutral-400">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <div className="text-right">
            <div className={`text-xl font-bold ${getTrendColor()}`}>
              {change > 0 ? '+' : ''}{change}
            </div>
            <div className="text-xs text-neutral-500">
              {change > 0 ? '+' : ''}{changePercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((score) => {
            const y = yScale(score);
            return (
              <g key={score}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#262626"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-neutral-500"
                >
                  {score}
                </text>
              </g>
            );
          })}

          {/* Area gradient */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#scoreGradient)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.5))',
            }}
          />

          {/* Data points */}
          {data.map((point, index) => {
            const x = xScale(index);
            const y = yScale(point.score);
            const isHovered = hoveredIndex === index;

            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4}
                  fill="#8b5cf6"
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    filter: isHovered ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.8))' : 'none',
                  }}
                />

                {/* Tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={x - 40}
                      y={y - 50}
                      width="80"
                      height="40"
                      fill="#1a1a1a"
                      stroke="#8b5cf6"
                      strokeWidth="1"
                      rx="4"
                    />
                    <text
                      x={x}
                      y={y - 32}
                      textAnchor="middle"
                      className="text-xs fill-violet-400 font-semibold"
                    >
                      Score: {point.score}
                    </text>
                    <text
                      x={x}
                      y={y - 18}
                      textAnchor="middle"
                      className="text-xs fill-neutral-400"
                    >
                      {new Date(point.date).toLocaleDateString()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* X-axis labels */}
          {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((point, index, arr) => {
            const originalIndex = data.indexOf(point);
            const x = xScale(originalIndex);
            return (
              <text
                key={originalIndex}
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-neutral-500"
              >
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-800">
        <div>
          <div className="text-xs text-neutral-500 mb-1">Starting Score</div>
          <div className="text-2xl font-bold">{firstScore}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 mb-1">Current Score</div>
          <div className="text-2xl font-bold text-violet-400">{currentScore}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 mb-1">Peak Score</div>
          <div className="text-2xl font-bold">{maxScore - 5}</div>
        </div>
      </div>
    </Card>
  );
}
