import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Reading {
  id: string;
  timestamp: string;
  voltage: number;
  current: number;
  temperature: number;
  anomalies: Array<{ rule: string; alert_status: string }>;
}

interface ReadingsChartProps {
  readings: Reading[];
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ReadingsChart({ readings }: ReadingsChartProps) {
  if (!readings.length) return <p className="text-slate-400 text-sm">No readings in range.</p>;

  const data = [...readings].reverse().map(r => ({
    time: formatTime(r.timestamp),
    voltage:     Number(r.voltage),
    current:     Number(r.current),
    temperature: Number(r.temperature),
    hasAnomaly:  r.anomalies.length > 0,
  }));

  const anomalyIndices = data
    .map((d, i) => (d.hasAnomaly ? i : -1))
    .filter(i => i >= 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis yAxisId="volt" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={45} />
        <YAxis yAxisId="temp" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={45} />
        <Tooltip />
        <Legend />
        {anomalyIndices.map(idx => (
          <ReferenceLine
            key={idx}
            yAxisId="volt"
            x={data[idx].time}
            stroke="#ef4444"
            strokeDasharray="3 3"
            opacity={0.6}
          />
        ))}
        <Line yAxisId="volt" type="monotone" dataKey="voltage"     stroke="#3b82f6" dot={false} name="Voltage (V)" />
        <Line yAxisId="volt" type="monotone" dataKey="current"     stroke="#22c55e" dot={false} name="Current (A)" />
        <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#f97316" dot={false} name="Temp (°C)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
