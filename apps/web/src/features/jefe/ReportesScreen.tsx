// RF-18 web — Reportes: reutiliza DashboardScreen (filtros + export CSV/PNG/PDF).
// Evita duplicar lógica de exportación; el Dashboard ya expone FilterBar con onExport/onExportPng/onExportPdf.
import { DashboardScreen } from '../dashboard/DashboardScreen';

export function ReportesScreen() {
  return <DashboardScreen />;
}
