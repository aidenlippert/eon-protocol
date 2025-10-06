'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreEvent {
  timestamp: number;
  score: number;
  event: 'loan' | 'repayment' | 'liquidation' | 'kyc' | 'initial';
  description: string;
  scoreDelta?: number;
}

export function CreditTimeline() {
  const { address } = useAccount();
  const [timeline, setTimeline] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    setLoading(true);

    // Fetch loan history to build timeline
    fetch(`/api/loans/${address}`)
      .then((res) => res.json())
      .then((data) => {
        const events: ScoreEvent[] = [];

        // Add current score as latest point
        fetch(`/api/score/${address}`)
          .then((res) => res.json())
          .then((scoreData) => {
            events.push({
              timestamp: Date.now(),
              score: scoreData.score,
              event: 'initial',
              description: 'Current Score',
            });

            // Add loan events
            data.loans?.forEach((loan: any) => {
              if (loan.status === 'Repaid') {
                events.push({
                  timestamp: Number(loan.timestamp) * 1000,
                  score: scoreData.score - 25, // Estimated before repayment
                  event: 'repayment',
                  description: `Repaid $${(Number(loan.principalUsd18) / 1e18).toFixed(0)} loan`,
                  scoreDelta: 25,
                });
              } else if (loan.status === 'Liquidated') {
                events.push({
                  timestamp: Number(loan.timestamp) * 1000,
                  score: scoreData.score + 50, // Estimated before liquidation
                  event: 'liquidation',
                  description: `Liquidated loan`,
                  scoreDelta: -50,
                });
              } else {
                events.push({
                  timestamp: Number(loan.timestamp) * 1000,
                  score: scoreData.score,
                  event: 'loan',
                  description: `Borrowed $${(Number(loan.principalUsd18) / 1e18).toFixed(0)}`,
                });
              }
            });

            // Sort by timestamp
            events.sort((a, b) => a.timestamp - b.timestamp);
            setTimeline(events);
            setLoading(false);
          });
      })
      .catch((err) => {
        console.error('[CreditTimeline] Error:', err);
        setLoading(false);
      });
  }, [address]);

  if (!address) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-neutral-400">Connect wallet to view credit history</div>
        </CardContent>
      </Card>
    );
  }

  if (loading || timeline.length === 0) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-neutral-400">{loading ? 'Loading...' : 'No credit history yet'}</div>
        </CardContent>
      </Card>
    );
  }

  const currentScore = timeline[timeline.length - 1]?.score || 0;
  const previousScore = timeline[0]?.score || currentScore;
  const scoreDelta = currentScore - previousScore;

  // Format data for chart
  const chartData = timeline.map((event) => ({
    date: new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: event.score,
    timestamp: event.timestamp,
  }));

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Credit Score History</span>
          <div className="flex items-center gap-2">
            {scoreDelta > 0 && <TrendingUp className="w-5 h-5 text-green-400" />}
            {scoreDelta < 0 && <TrendingDown className="w-5 h-5 text-red-400" />}
            {scoreDelta === 0 && <Minus className="w-5 h-5 text-neutral-400" />}
            <span className={`text-lg font-semibold ${scoreDelta > 0 ? 'text-green-400' : scoreDelta < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
              {scoreDelta > 0 ? '+' : ''}{scoreDelta}
            </span>
          </div>
        </CardTitle>
        <CardDescription>Score evolution over time</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Chart */}
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#888"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#888"
                domain={[0, 1000]}
                ticks={[0, 200, 400, 600, 800, 1000]}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#fff' }}
              />
              {/* Tier lines */}
              <ReferenceLine y={900} stroke="#8b5cf6" strokeDasharray="3 3" label={{ value: 'Platinum', position: 'right', fill: '#8b5cf6', fontSize: 10 }} />
              <ReferenceLine y={750} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: 'Gold', position: 'right', fill: '#fbbf24', fontSize: 10 }} />
              <ReferenceLine y={600} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Silver', position: 'right', fill: '#94a3b8', fontSize: 10 }} />

              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Event Timeline */}
        <div className="mt-6 space-y-3">
          <div className="text-sm font-semibold text-white/80 mb-3">Recent Events</div>
          {timeline.slice().reverse().slice(0, 5).map((event, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${
                event.event === 'repayment' ? 'bg-green-400' :
                event.event === 'liquidation' ? 'bg-red-400' :
                event.event === 'kyc' ? 'bg-blue-400' :
                'bg-violet-400'
              }`} />
              <div className="flex-1">
                <div className="text-sm text-white">{event.description}</div>
                <div className="text-xs text-white/50">
                  {new Date(event.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
              {event.scoreDelta && (
                <div className={`text-sm font-semibold ${event.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {event.scoreDelta > 0 ? '+' : ''}{event.scoreDelta}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
