import { AnomalyRecord } from '../types/alert';
import { SensorConfig } from '../types/sensor';

export function evaluateRuleA(
  reading: { voltage: number; temperature: number },
  config: SensorConfig
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  if (config.voltage_min !== null && reading.voltage < config.voltage_min)
    anomalies.push({ rule: 'threshold_breach', detail: { field: 'voltage', value: reading.voltage, min: config.voltage_min } });
  if (config.voltage_max !== null && reading.voltage > config.voltage_max)
    anomalies.push({ rule: 'threshold_breach', detail: { field: 'voltage', value: reading.voltage, max: config.voltage_max } });
  if (config.temperature_min !== null && reading.temperature < config.temperature_min)
    anomalies.push({ rule: 'threshold_breach', detail: { field: 'temperature', value: reading.temperature, min: config.temperature_min } });
  if (config.temperature_max !== null && reading.temperature > config.temperature_max)
    anomalies.push({ rule: 'threshold_breach', detail: { field: 'temperature', value: reading.temperature, max: config.temperature_max } });
  return anomalies;
}

export function evaluateRuleB(
  reading: { voltage: number; temperature: number },
  prevReadings: Array<{ voltage: number; temperature: number }>,
  config: SensorConfig
): AnomalyRecord[] {
  if (prevReadings.length < 3 || config.rate_of_change_pct === null) return [];
  const anomalies: AnomalyRecord[] = [];
  const avgVoltage = prevReadings.reduce((s, r) => s + r.voltage, 0) / prevReadings.length;
  const avgTemp    = prevReadings.reduce((s, r) => s + r.temperature, 0) / prevReadings.length;

  if (avgVoltage !== 0) {
    const pct = Math.abs(reading.voltage - avgVoltage) / Math.abs(avgVoltage) * 100;
    if (pct > config.rate_of_change_pct)
      anomalies.push({ rule: 'rate_of_change', detail: { field: 'voltage', value: reading.voltage, avg: avgVoltage, change_pct: pct } });
  }
  if (avgTemp !== 0) {
    const pct = Math.abs(reading.temperature - avgTemp) / Math.abs(avgTemp) * 100;
    if (pct > config.rate_of_change_pct)
      anomalies.push({ rule: 'rate_of_change', detail: { field: 'temperature', value: reading.temperature, avg: avgTemp, change_pct: pct } });
  }
  return anomalies;
}
