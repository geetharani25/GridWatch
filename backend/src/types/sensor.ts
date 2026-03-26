import { z } from 'zod';

export const SensorReadingSchema = z.object({
  sensor_id:   z.string().uuid(),
  timestamp:   z.string().datetime(),
  voltage:     z.number().finite(),
  current:     z.number().finite(),
  temperature: z.number().finite(),
  status_code: z.number().int(),
});

export type SensorReading = z.infer<typeof SensorReadingSchema>;

export interface SensorConfig {
  voltage_min:         number | null;
  voltage_max:         number | null;
  temperature_min:     number | null;
  temperature_max:     number | null;
  rate_of_change_pct:  number | null;
  rule_a_severity:     'warning' | 'critical';
  rule_b_severity:     'warning' | 'critical';
  rule_c_severity:     'warning' | 'critical';
}
