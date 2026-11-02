/**
 * BookingModalUnified: books one wellness experience (a journey like Restore, or a service) or several together
 * (Recharge: gym + personal trainer + pool).
 *
 * Days come from the guest's stay. Each time shows whether it is confirmed at once (the team opened it) or sent as a
 * request the team confirms. After booking, the guest sees each booking's code: they show it on arrival.
 *
 * Props: activity (one) or activities (several), onClose(bookedOrNot), isReschedule.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../constants/theme';
import wellnessUnifiedService from '../services/wellnessUnifiedService';

const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    full: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
};
const timeLabel = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const addMinutes = (hhmm, minutes) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  const t = h * 60 + m + Number(minutes || 0);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function BookingModalUnified({ visible, onClose, activity, activities, isReschedule = false }) {
  const list = useMemo(() => (activities && activities.length ? activities : activity ? [activity] : []), [activity, activities]);
  const several = list.length > 1;

  const [loading, setLoading] = useState(false);
  const [stay, setStay] = useState(undefined); // undefined = loading, null = no stay
  const [slots, setSlots] = useState({}); // activityId → availability[]
  const [date, setDate] = useState(null);
  const [times, setTimes] = useState({}); // activityId → 'HH:MM'
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(null); // { message, bookings }

  useEffect(() => {
    if (!visible || !list.length) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(list.map((a) => wellnessUnifiedService.getAvailabilityFull(a.id)));
        if (!alive) return;
        setStay(results[0]?.stay || null);
        setSlots(Object.fromEntries(list.map((a, i) => [a.id, results[i]?.availability || []])));
      } catch (error) {
        Alert.alert('Could not load times', error.message || 'Please try again.');
        setStay(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, list]);

  // The stay's days, in order (the server only returns days the guest can book).
  const days = useMemo(() => {
    const all = new Set();
    Object.values(slots).forEach((arr) => arr.forEach((s) => all.add(s.date)));
    return [...all].sort();
  }, [slots]);

  useEffect(() => {
    if (days.length && !days.includes(date)) {
      // First day with at least one free time for every chosen experience, else the first day.
      const good = days.find((d) => list.every((a) => (slots[a.id] || []).some((s) => s.date === d && s.is_available)));
      setDate(good || days[0]);
      setTimes({});
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setDate(null);
    setTimes({});
    setPeople(1);
    setNote('');
    setBooking(false);
    setDone(null);
    setSlots({});
    setStay(undefined);
  };
  const handleClose = (success = false) => {
    reset();
    onClose(success);
  };

  // A time overlapping another chosen experience is not offered (the guest cannot be in two places).
  const clashes = (activityId, slot) =>
    list.some((a) => {
      if (a.id === activityId || !times[a.id]) return false;
      const start = times[a.id];
      const end = addMinutes(start, a.duration);
      return slot.start_time < end && slot.end_time > start;
    });

  const ready = date && list.every((a) => times[a.id]);
  const chosenSlots = list.map((a) => (slots[a.id] || []).find((s) => s.date === date && s.start_time === times[a.id])).filter(Boolean);
  const anyRequest = chosenSlots.some((s) => !s.instant);

  const confirm = async () => {
    if (!ready) return;
    setBooking(true);
    try {
      const response = await wellnessUnifiedService.bookActivity({
        booking_date: date,
        items: list.map((a) => ({ activity_id: a.id, start_time: times[a.id] })),
        people,
        special_requests: note.trim() || undefined,
      });
      setDone({ message: response.message, bookings: response.bookings || [response.booking] });
    } catch (error) {
      Alert.alert('Booking not made', error.message || error.error || 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const title = isReschedule ? 'Choose a new time' : several ? 'Book your session' : 'Book';
  const subtitle = list.map((a) => a.display_name || a.name).join(' · ');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => handleClose(!!done)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{done ? (done.bookings.some((b) => b.status === 'requested') ? 'Request sent' : 'You are booked') : title}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>{subtitle || 'Wellness'}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => handleClose(!!done)} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {done ? (
              <View>
                <View style={styles.doneHero}>
                  <LinearGradient
                    colors={done.bookings.some((b) => b.status === 'requested') ? ['rgba(232,184,74,0.25)', 'rgba(232,184,74,0.08)'] : ['rgba(127,174,138,0.3)', 'rgba(74,124,89,0.1)']}
                    style={styles.doneHalo}
                  >
                    <Text style={[styles.doneGlyph, { color: done.bookings.some((b) => b.status === 'requested') ? '#e8b84a' : '#7fae8a' }]}>
                      {done.bookings.some((b) => b.status === 'requested') ? '◷' : '✓'}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.doneTitle}>{done.bookings.some((b) => b.status === 'requested') ? 'Your request is with our team' : 'Your time is reserved'}</Text>
                </View>
                <Text style={[styles.doneMessage, { textAlign: 'center' }]}>{done.message}</Text>
                {done.bookings.map((b) => (
                  <View key={b.id} style={styles.codeCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeName}>{b.activity_name}</Text>
                      <Text style={styles.codeWhen}>{dayLabel(String(b.booking_date).slice(0, 10)).full} · {timeLabel(String(b.start_time).slice(0, 5))}</Text>
                      <Text style={[styles.codeStatus, b.status === 'requested' ? styles.codeStatusWait : styles.codeStatusOk]}>
                        {b.status === 'requested' ? 'Waiting for the team to confirm' : b.activity_pin ? `Confirmed · key in your Digital key (PIN ${b.activity_pin})` : 'Confirmed'}
                      </Text>
                    </View>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeLabel}>YOUR CODE</Text>
                      <Text style={styles.codeValue}>{b.booking_code}</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.doneHint}>
                  Show your code when you arrive. {done.bookings.some((b) => b.status === 'requested') ? 'You will be notified as soon as the team confirms. ' : ''}All your sessions are in Bookings.
                </Text>
              </View>
            ) : loading || stay === undefined ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#7fae8a" />
                <Text style={styles.loadingText}>Finding times during your stay…</Text>
              </View>
            ) : !stay ? (
              <View style={styles.noSlotsContainer}>
                <Text style={styles.noSlotsText}>Wellness can be booked once you have a confirmed stay. Book a stay, or ask the concierge.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.stayLine}>Your stay · {dayLabel(stay.checkIn).full} – {dayLabel(stay.checkOut).full}</Text>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>DAY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={styles.datesScroll}>
                    {days.map((d) => {
                      const l = dayLabel(d);
                      const on = d === date;
                      return (
                        <TouchableOpacity key={d} style={[styles.dateCard, on && styles.dateCardSelected]} onPress={() => { setDate(d); setTimes({}); }} activeOpacity={0.8}>
                          <Text style={[styles.dateDay, on && styles.dateDaySelected]}>{l.day}</Text>
                          <Text style={[styles.dateNumber, on && styles.dateNumberSelected]}>{l.date}</Text>
                          <Text style={[styles.dateMonth, on && styles.dateMonthSelected]}>{l.month}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {list.map((a) => {
                  const daySlots = (slots[a.id] || []).filter((s) => s.date === date);
                  return (
                    <View key={a.id} style={styles.section}>
                      <Text style={styles.sectionTitle}>{several ? (a.display_name || a.name).toUpperCase() : 'TIME'}</Text>
                      <Text style={styles.activityMeta}>
                        {a.duration} min{a.type === 'journey' && a.total_stages ? ` · ${a.total_stages} stages` : ''}{a.location ? ` · ${a.location}` : ''}
                      </Text>
                      {daySlots.length === 0 ? (
                        <Text style={styles.noSlotsText}>No times this day. Try another day.</Text>
                      ) : (
                        <View style={styles.timeGrid}>
                          {daySlots.map((slot) => {
                            const blocked = !slot.is_available || clashes(a.id, slot);
                            const on = times[a.id] === slot.start_time;
                            return (
                              <TouchableOpacity
                                key={`${a.id}-${slot.start_time}`}
                                style={[styles.timeSlot, blocked && styles.timeSlotDisabled, on && styles.timeSlotSelected]}
                                onPress={() => !blocked && setTimes((t) => ({ ...t, [a.id]: on ? undefined : slot.start_time }))}
                                disabled={blocked}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.timeSlotText, blocked && styles.timeSlotTextDisabled, on && styles.timeSlotTextSelected]}>{timeLabel(slot.start_time)}</Text>
                                <Text style={[styles.slotTag, on && styles.timeSlotTextSelected]}>
                                  {slot.conflicting_booking ? slot.conflicting_booking : !slot.is_available ? 'Full' : slot.instant ? 'Instant' : 'On request'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>PEOPLE</Text>
                  <View style={styles.peopleRow}>
                    <TouchableOpacity style={styles.stepper} onPress={() => setPeople((p) => Math.max(1, p - 1))}><Text style={styles.stepperText}>−</Text></TouchableOpacity>
                    <Text style={styles.peopleValue}>{people}</Text>
                    <TouchableOpacity style={styles.stepper} onPress={() => setPeople((p) => Math.min(6, p + 1))}><Text style={styles.stepperText}>+</Text></TouchableOpacity>
                    <Text style={styles.peopleHint}>{people > 1 ? 'Booked together' : 'Just me'}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ANYTHING WE SHOULD KNOW</Text>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Preferences, injuries, pregnancy, a female therapist…"
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    maxLength={500}
                  />
                </View>

                {ready ? (
                  <View style={styles.accessInfoBox}>
                    <Text style={styles.accessInfoIcon}>{anyRequest ? '⏳' : '✓'}</Text>
                    <Text style={styles.accessInfoText}>
                      {anyRequest
                        ? 'Some times are on request: the team confirms them shortly and you are notified. Every booking gets a code to show on arrival.'
                        : 'These times are confirmed as soon as you book. You will get a code to show on arrival.'}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {done ? (
              <TouchableOpacity style={styles.confirmButton} onPress={() => handleClose(true)} activeOpacity={0.85}>
                <LinearGradient colors={['#7fae8a', '#4a7c59']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmButtonGradient}>
                  <Text style={styles.confirmButtonText}>DONE</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.confirmButton, (!ready || booking) && styles.confirmButtonDisabled]} onPress={confirm} activeOpacity={0.85} disabled={!ready || booking}>
                <LinearGradient
                  colors={ready && !booking ? ['#7fae8a', '#4a7c59'] : ['rgba(127, 174, 138, 0.3)', 'rgba(74, 124, 89, 0.3)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButtonGradient}
                >
                  {booking ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Text style={[styles.confirmButtonText, !ready && styles.confirmButtonTextDisabled]}>
                      {!ready ? (several ? 'CHOOSE A TIME FOR EACH' : 'CHOOSE A TIME') : anyRequest ? 'SEND REQUEST' : 'CONFIRM BOOKING'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7fae8a',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  activityIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(127, 174, 138, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIcon: {
    fontSize: 28,
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  activityValue: {
    fontSize: 16,
    color: '#7fae8a',
    fontWeight: '700',
  },
  activityStages: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  accessInfoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    gap: 10,
    alignItems: 'center',
  },
  accessInfoIcon: {
    fontSize: 20,
  },
  accessInfoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    marginBottom: 14,
  },
  datesScroll: {
    gap: 12,
    paddingRight: 24,
  },
  dateCard: {
    width: 72,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  dateCardSelected: {
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderColor: '#7fae8a',
    borderWidth: 2,
  },
  dateDay: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  dateDaySelected: {
    color: '#7fae8a',
  },
  dateNumber: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '700',
  },
  dateNumberSelected: {
    color: '#7fae8a',
  },
  dateMonth: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  dateMonthSelected: {
    color: '#7fae8a',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeSlot: {
    width: '47%',
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderColor: '#7fae8a',
    borderWidth: 2,
  },
  timeSlotDisabled: {
    opacity: 0.4,
  },
  timeSlotText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  timeSlotTextSelected: {
    color: '#7fae8a',
  },
  timeSlotTextDisabled: {
    color: COLORS.textTertiary,
  },
  bookedText: {
    fontSize: 9,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  noSlotsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.2)',
  },
  noSlotsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryGradient: {
    padding: 18,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7fae8a',
    marginBottom: 14,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  summaryValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmButton: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 13,
    letterSpacing: 2,
    color: COLORS.background,
    fontWeight: '700',
  },
  confirmButtonTextDisabled: {
    color: 'rgba(242, 233, 216, 0.4)',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContainer: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.25)',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  successCheckmark: {
    fontSize: 52,
    color: COLORS.background,
    fontWeight: '700',
  },
  successTitle: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  successMessage: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  successInfoBox: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.15)',
    width: '100%',
    gap: 12,
  },
  successInfoIcon: {
    fontSize: 26,
  },
  successInfoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
    fontWeight: '500',
  },
  successButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  successButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  successButtonText: {
    fontFamily: FONTS.heading,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.8,
  },
  stayLine: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS?.body },
  activityMeta: { color: COLORS.textTertiary, fontSize: 12, marginBottom: 10, marginTop: -6 },
  slotTag: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2, letterSpacing: 0.5 },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepper: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(127, 174, 138, 0.5)', alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: '#7fae8a', fontSize: 20 },
  peopleValue: { color: COLORS.text, fontSize: 18, minWidth: 20, textAlign: 'center' },
  peopleHint: { color: COLORS.textTertiary, fontSize: 13 },
  noteInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, color: COLORS.text, minHeight: 70, textAlignVertical: 'top' },
  doneMessage: { color: COLORS.text, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  doneHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(127, 174, 138, 0.35)', backgroundColor: 'rgba(127, 174, 138, 0.08)', marginBottom: 10 },
  codeName: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  codeWhen: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  codeStatus: { fontSize: 12, marginTop: 6, letterSpacing: 0.3 },
  codeStatusOk: { color: '#7fae8a' },
  codeStatusWait: { color: '#e8b84a' },
  codeBox: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  codeLabel: { color: COLORS.textTertiary, fontSize: 9, letterSpacing: 1.5 },
  codeValue: { color: '#e8d3a2', fontSize: 18, letterSpacing: 2, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), marginTop: 2 },
  doneHero: { alignItems: 'center', marginBottom: 18, marginTop: 4 },
  doneHalo: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  doneGlyph: { fontSize: 38 },
  doneTitle: { color: COLORS.text, fontSize: 22, textAlign: 'center', fontFamily: FONTS?.heading || undefined },
});
