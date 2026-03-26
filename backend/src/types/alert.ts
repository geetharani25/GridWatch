export type AlertStatus   = 'open' | 'acknowledged' | 'resolved';
export type AlertSeverity = 'warning' | 'critical';
export type AnomalyRule   = 'threshold_breach' | 'rate_of_change' | 'pattern_absence';

export interface Alert {
  id:              string;
  anomaly_id:      string;
  sensor_id:       string;
  zone_id:         string;
  severity:        AlertSeverity;
  status:          AlertStatus;
  suppressed:      boolean;
  assigned_to:     string | null;
  opened_at:       string;
  acknowledged_at: string | null;
  resolved_at:     string | null;
  escalated_at:    string | null;
}

export interface AnomalyRecord {
  rule:   AnomalyRule;
  detail: Record<string, unknown>;
}

export const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  open:         ['acknowledged', 'resolved'],
  acknowledged: ['resolved'],
  resolved:     [],
};
