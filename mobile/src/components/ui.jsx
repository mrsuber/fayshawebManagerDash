import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../constants/theme';
import { dayLabel, hhmm } from '../utils/format';

/**
 * The building blocks for the guest app screens, in the app's own look: warm black, gold accents,
 * Cinzel headings and Montserrat text. Used by the residence, dining, requests, rides, bill and booking screens.
 */

export const tap = () => Haptics.selectionAsync().catch(() => {});

/** A screen with an optional back header and a scrolling body with pull-to-refresh. */
export function Screen({ title, subtitle, onBack, right, children, refreshing, onRefresh, scroll = true, footer, edges = ['top'], contentStyle }) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.body, { paddingBottom: footer ? 24 : 40 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {(title || onBack) && (
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 4 }} />
          )}
          <View style={{ flex: 1 }}>
            {!!title && <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>}
            {!!subtitle && <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>}
          </View>
          {right || <View style={{ width: 36 }} />}
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Heading({ children, style, size = 22 }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.25 }, style]}>{children}</Text>;
}

export function Body({ children, style, muted, numberOfLines }) {
  return (
    <Text style={[styles.text, muted && { color: COLORS.textTertiary }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, action, onAction, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** The app's card: a faint gold wash with a fine gold border. */
export function Card({ children, style, onPress, highlight, padded = true }) {
  const inner = (
    <LinearGradient
      colors={highlight ? ['rgba(200,164,93,0.16)', 'rgba(200,164,93,0.05)'] : ['rgba(200,164,93,0.075)', 'rgba(200,164,93,0.025)']}
      style={[styles.card, highlight && { borderColor: COLORS.borderGold }, padded && { padding: 16 }, style]}
    >
      {children}
    </LinearGradient>
  );
  if (!onPress) return inner;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      {inner}
    </TouchableOpacity>
  );
}

export function Button({ title, onPress, variant = 'gold', icon, loading, disabled, style, small }) {
  const gold = variant === 'gold';
  const danger = variant === 'danger';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress && onPress();
      }}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.button,
        small && styles.buttonSmall,
        gold ? styles.buttonGold : danger ? styles.buttonDanger : styles.buttonGhost,
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={gold ? COLORS.background : COLORS.primary} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 17} color={gold ? COLORS.background : danger ? '#ff8a80' : COLORS.primary} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 11.5 }, { color: gold ? COLORS.background : danger ? '#ff8a80' : COLORS.text }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity
      onPress={() => {
        tap();
        onPress && onPress();
      }}
      activeOpacity={0.85}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? COLORS.background : COLORS.primary} /> : null}
      <Text style={[styles.chipText, active && { color: COLORS.background }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ options, value, onChange, scroll = true }) {
  const chips = options.map((o) => {
    const opt = typeof o === 'string' ? { value: o, label: o } : o;
    return <Chip key={opt.value} label={opt.label} icon={opt.icon} active={value === opt.value} onPress={() => onChange(opt.value)} />;
  });
  if (!scroll) return <View style={styles.chipWrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {chips}
    </ScrollView>
  );
}

export function Field({ label, hint, error, style, inputStyle, multiline, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="rgba(242,233,216,0.3)"
        selectionColor={COLORS.primary}
        {...props}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus && props.onFocus(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur && props.onBlur(e);
        }}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, focused && { borderColor: COLORS.borderGold }, error && { borderColor: '#ff8a80' }, inputStyle]}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

/** A date or time field that opens the native picker. value is a Date. */
export function PickerField({ label, mode = 'date', value, onChange, minimumDate, maximumDate, style }) {
  const [open, setOpen] = useState(false);
  const shown = mode === 'date' ? dayLabel(value, { weekday: true }) : hhmm(value);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={[styles.input, styles.pickerInput]} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Text style={styles.pickerText}>{shown}</Text>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={17} color={COLORS.primary} />
      </TouchableOpacity>
      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode={mode}
          is24Hour
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === 'set' && picked) onChange(picked);
          }}
        />
      )}
      {Platform.OS === 'ios' && (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
          <DateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            themeVariant="dark"
            textColor={COLORS.text}
            minuteInterval={mode === 'time' ? 5 : undefined}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, picked) => picked && onChange(picked)}
          />
          <Button title="Done" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
        </Sheet>
      )}
    </View>
  );
}

export function Stepper({ label, value, onChange, min = 1, max = 20 }) {
  return (
    <View style={[styles.stepperRow]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity accessibilityLabel={`Fewer ${label}`} onPress={() => { tap(); onChange(Math.max(min, value - 1)); }} style={styles.stepBtn} disabled={value <= min}>
          <Ionicons name="remove" size={18} color={value <= min ? COLORS.textDisabled : COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity accessibilityLabel={`More ${label}`} onPress={() => { tap(); onChange(Math.min(max, value + 1)); }} style={styles.stepBtn} disabled={value >= max}>
          <Ionicons name="add" size={18} color={value >= max ? COLORS.textDisabled : COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PILL = {
  gold: ['rgba(200,164,93,0.16)', COLORS.primary],
  green: ['rgba(127,174,138,0.16)', '#9fd1aa'],
  blue: ['rgba(90,200,250,0.13)', '#8fd8f8'],
  red: ['rgba(255,99,88,0.14)', '#ff8a80'],
  grey: ['rgba(242,233,216,0.08)', COLORS.textTertiary],
};

/** Colour for a status word used anywhere in the API. */
export function toneOf(status = '') {
  const s = String(status).toLowerCase();
  if (/(done|delivered|completed|confirmed|checked in|checked_in|paid|ready|arrived)/.test(s)) return 'green';
  if (/(cancel|declin|reject|failed|delayed|no.?show)/.test(s)) return 'red';
  if (/(progress|preparing|en route|assigned|seen|scheduled|on the way)/.test(s)) return 'blue';
  if (/(checked out|checked_out|past|refunded)/.test(s)) return 'grey';
  return 'gold';
}

export function Pill({ label, tone }) {
  const [bg, fg] = PILL[tone || toneOf(label)] || PILL.gold;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{String(label).replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.primary} />
      <Text style={[styles.text, { color: COLORS.textTertiary, marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

export function Empty({ icon = 'sparkles-outline', title, text, action, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
      {action ? <Button title={action} onPress={onAction} variant="ghost" small style={{ marginTop: 14, alignSelf: 'center', paddingHorizontal: 22 }} /> : null}
    </View>
  );
}

export function Notice({ children, tone = 'gold', icon = 'information-circle-outline', style }) {
  const [bg, fg] = PILL[tone] || PILL.gold;
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: fg + '55' }, style]}>
      <Ionicons name={icon} size={17} color={fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText]}>{children}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: 'rgba(255,138,128,0.4)' }]}>
        <Ionicons name="cloud-offline-outline" size={26} color="#ff8a80" />
      </View>
      <Text style={styles.emptyTitle}>We couldn't load this</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="ghost" small style={{ marginTop: 14, alignSelf: 'center', paddingHorizontal: 22 }} /> : null}
    </View>
  );
}

/** A row in a list: icon, title, subtitle, and something on the right. */
export function ListRow({ icon, title, subtitle, right, onPress, last }) {
  const content = (
    <View style={[styles.listRow, !last && styles.listRowBorder]}>
      {icon ? (
        <View style={styles.listIcon}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={styles.listSub} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} /> : null}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      {content}
    </TouchableOpacity>
  ) : (
    content
  );
}

/** A bottom sheet. */
export function Sheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: 18 + insets.bottom }]}>
          <View style={styles.grabber} />
          {!!title && <Text style={styles.sheetTitle}>{title}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={() => { tap(); onChange(!checked); }} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <Ionicons name="checkmark" size={15} color={COLORS.background} /> : null}</View>
      <Text style={[styles.text, { flex: 1 }]}>{children}</Text>
    </TouchableOpacity>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  body: { paddingHorizontal: 20, paddingTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, letterSpacing: 0.8 },
  headerSub: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5, marginTop: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  eyebrow: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  heading: { fontFamily: FONTS.heading, color: COLORS.text, letterSpacing: 0.6 },
  text: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19.5 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10.5, letterSpacing: 2 },
  sectionAction: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 12 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden' },
  button: { minHeight: 50, borderRadius: 4, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSmall: { minHeight: 38, paddingHorizontal: 14 },
  buttonGold: { backgroundColor: COLORS.primary },
  buttonGhost: { borderWidth: 1, borderColor: COLORS.borderGold, backgroundColor: 'transparent' },
  buttonDanger: { borderWidth: 1, borderColor: 'rgba(255,138,128,0.45)' },
  buttonText: { fontFamily: FONTS.body, fontSize: 12.5, letterSpacing: 1.4, fontWeight: '600', textTransform: 'uppercase' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.borderGold, backgroundColor: 'rgba(200,164,93,0.05)' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.text },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10.5, letterSpacing: 1.6, marginBottom: 8, textTransform: 'uppercase' },
  input: { minHeight: 50, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(242,233,216,0.04)', borderRadius: 10, paddingHorizontal: 14, color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  hint: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5, marginTop: 6 },
  fieldError: { fontFamily: FONTS.body, color: '#ff8a80', fontSize: 11.5, marginTop: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  stepperLabel: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderGold, borderRadius: 999 },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 26, textAlign: 'center', color: COLORS.text, fontFamily: FONTS.body, fontSize: 15 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontFamily: FONTS.body, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'capitalize' },
  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: COLORS.borderGold, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, textAlign: 'center', letterSpacing: 0.5 },
  emptyText: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  noticeText: { flex: 1, fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(200,164,93,0.12)', alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14 },
  listSub: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#14120f', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: COLORS.borderLight, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(242,233,216,0.2)', marginBottom: 14 },
  sheetTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 18, letterSpacing: 0.6, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.borderGold, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
});
