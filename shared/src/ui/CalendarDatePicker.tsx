import * as React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from './theme.js';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS = [
  { short: 'D', label: 'Domingo' },
  { short: 'L', label: 'Lunes' },
  { short: 'M', label: 'Martes' },
  { short: 'M', label: 'Miércoles' },
  { short: 'J', label: 'Jueves' },
  { short: 'V', label: 'Viernes' },
  { short: 'S', label: 'Sábado' },
];

type Props = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

function parseIsoDate(value?: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function isBeforeMonth(date: Date, boundary: Date): boolean {
  return date.getFullYear() < boundary.getFullYear()
    || (date.getFullYear() === boundary.getFullYear() && date.getMonth() < boundary.getMonth());
}

function isAfterMonth(date: Date, boundary: Date): boolean {
  return date.getFullYear() > boundary.getFullYear()
    || (date.getFullYear() === boundary.getFullYear() && date.getMonth() > boundary.getMonth());
}

export function CalendarDatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Seleccionar fecha',
  style,
}: Props) {
  const selectedDate = parseIsoDate(value);
  const min = parseIsoDate(minDate);
  const max = parseIsoDate(maxDate);
  const [open, setOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const initial = selectedDate ?? min ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  React.useEffect(() => {
    if (selectedDate) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [value]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: monthStart.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
  ];
  const previousMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const previousDisabled = min ? isBeforeMonth(previousMonth, min) : false;
  const nextDisabled = max ? isAfterMonth(nextMonth, max) : false;

  const openCalendar = () => {
    const initial = selectedDate ?? min ?? new Date();
    setVisibleMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setOpen(true);
  };

  const isDateDisabled = (date: Date) =>
    (!!min && toIsoDate(date) < toIsoDate(min)) || (!!max && toIsoDate(date) > toIsoDate(max));

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.triggerRow}>
        <Pressable
          testID="date-picker-trigger"
          onPress={openCalendar}
          style={styles.trigger}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selectedDate ? formatDate(selectedDate) : placeholder}`}
          accessibilityHint="Abre un calendario para elegir una fecha"
          accessibilityState={{ expanded: open }}
        >
          <Text style={[styles.triggerText, !selectedDate && styles.placeholder]}>{selectedDate ? formatDate(selectedDate) : placeholder}</Text>
          <Text style={styles.calendarIcon} accessible={false}>▦</Text>
        </Pressable>
        {selectedDate ? (
          <Pressable
            testID="date-picker-clear"
            onPress={() => onChange('')}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel={`Limpiar fecha ${label}`}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal
        testID="date-picker-modal"
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar calendario" />
          <View style={styles.calendarCard} accessibilityViewIsModal>
            <View style={styles.monthHeader}>
              <Pressable
                testID="calendar-previous-month"
                onPress={() => setVisibleMonth(previousMonth)}
                disabled={previousDisabled}
                style={[styles.monthButton, previousDisabled && styles.monthButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                accessibilityState={{ disabled: previousDisabled }}
              >
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{`${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`}</Text>
              <Pressable
                testID="calendar-next-month"
                onPress={() => setVisibleMonth(nextMonth)}
                disabled={nextDisabled}
                style={[styles.monthButton, nextDisabled && styles.monthButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                accessibilityState={{ disabled: nextDisabled }}
              >
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {WEEKDAYS.map((weekday, index) => (
                <View key={`weekday-${index}`} style={styles.dayCell}>
                  <Text style={styles.weekdayText} accessibilityLabel={weekday.label}>{weekday.short}</Text>
                </View>
              ))}
              {cells.map((date, index) => {
                if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
                const isoDate = toIsoDate(date);
                const selected = isoDate === value;
                const disabled = isDateDisabled(date);
                return (
                  <Pressable
                    key={isoDate}
                    testID={`calendar-day-${isoDate}`}
                    onPress={() => {
                      onChange(isoDate);
                      setOpen(false);
                    }}
                    disabled={disabled}
                    style={[styles.dayCell, styles.dayButton, selected && styles.daySelected, disabled && styles.dayDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.getDate()} de ${MONTHS[month]} de ${year}`}
                    accessibilityState={{ selected, disabled }}
                  >
                    <Text style={[styles.dayText, selected && styles.daySelectedText, disabled && styles.dayDisabledText]}>{date.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedDate ? (
              <Pressable
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
                style={styles.clearSelection}
                accessibilityRole="button"
              >
                <Text style={styles.clearSelectionText}>Quitar fecha</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 5, minWidth: 160 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, color: theme.colors.muted },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trigger: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  triggerText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  placeholder: { color: theme.colors.mutedSoft, fontWeight: '400' },
  calendarIcon: { color: theme.colors.primary, fontSize: 16 },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  clearText: { color: theme.colors.muted, fontSize: 18, lineHeight: 20 },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' },
  calendarCard: {
    width: '100%',
    maxWidth: 380,
    padding: theme.space[4],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.space[3],
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt },
  monthButtonDisabled: { opacity: 0.4 },
  monthButtonText: { color: theme.colors.text, fontSize: 24, lineHeight: 28 },
  monthTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { color: theme.colors.muted, fontSize: 11, fontWeight: '700' },
  dayButton: { borderRadius: theme.radius.full },
  daySelected: { backgroundColor: theme.colors.primary },
  dayDisabled: { opacity: 0.35 },
  dayText: { color: theme.colors.text, fontSize: 13 },
  daySelectedText: { color: '#fff', fontWeight: '700' },
  dayDisabledText: { color: theme.colors.muted },
  clearSelection: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 8 },
  clearSelectionText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
});
