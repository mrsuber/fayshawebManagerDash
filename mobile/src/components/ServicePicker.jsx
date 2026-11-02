/**
 * ServicePicker: the experiences of a mood (Recharge, Reflect, Explore), straight from the catalogue managed in
 * FAY OS → Wellness → Catalogue. The guest ticks one or several (gym only, trainer only, or gym + trainer + pool) and
 * books them together; each gets its own time and code.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';
import { fileUrl } from '../config';
import { formatDisplay } from '../services/currency';
import wellnessUnifiedService from '../services/wellnessUnifiedService';
import BookingModalUnified from './BookingModalUnified';

export default function ServicePicker({ category, accent = '#7fae8a', accent2 = '#4a7c59', fallbackImage, onOpen, bookLabel = 'BOOK' }) {
  const [services, setServices] = useState(null);
  const [selected, setSelected] = useState([]);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    let alive = true;
    wellnessUnifiedService
      .getActivities({ category })
      .then((r) => alive && setServices((r?.activities || []).filter((a) => a.type === 'service')))
      .catch(() => alive && setServices([]));
    return () => {
      alive = false;
    };
  }, [category]);

  const toggle = (s) => setSelected((cur) => (cur.some((x) => x.id === s.id) ? cur.filter((x) => x.id !== s.id) : [...cur, s]));
  const chosen = (s) => selected.some((x) => x.id === s.id);

  if (services === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.title}>CHOOSE ONE OR MORE</Text>
      <Text style={styles.hint}>Tick what you would like. Book one, or several together: each gets its own time.</Text>

      {services.length === 0 ? <Text style={styles.empty}>Nothing to book here yet. Ask the concierge.</Text> : null}

      {services.map((s) => {
        const on = chosen(s);
        const img = s.image_url ? { uri: fileUrl(s.image_url) } : fallbackImage;
        const price = Number(s.base_price) > 0 ? formatDisplay(s.base_price) : 'Included';
        return (
          <TouchableOpacity key={s.id} style={[styles.card, on && { borderColor: accent }]} onPress={() => toggle(s)} activeOpacity={0.85}>
            <ImageBackground source={img} style={styles.image} imageStyle={styles.imageStyle}>
              <LinearGradient colors={['rgba(13,13,13,0.15)', 'rgba(13,13,13,0.85)']} style={styles.gradient}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.display_name || s.name}</Text>
                  <Text style={[styles.meta, { color: accent }]}>
                    {s.duration} min · {price}
                    {s.location ? ` · ${s.location}` : ''}
                  </Text>
                </View>
                <View style={[styles.check, on ? { backgroundColor: accent, borderColor: accent } : { borderColor: `${accent}99` }]}>
                  <Text style={[styles.checkText, { color: on ? COLORS.background : accent }]}>{on ? '✓' : '+'}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
            {s.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {s.description}
              </Text>
            ) : null}
            {onOpen ? (
              <TouchableOpacity onPress={() => onOpen(s)} style={styles.more}>
                <Text style={[styles.moreText, { color: accent }]}>Details ›</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={[styles.bookButton, !selected.length && { opacity: 0.45 }]} disabled={!selected.length} onPress={() => setBooking(true)} activeOpacity={0.85}>
        <LinearGradient colors={[accent, accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookGradient}>
          <Text style={styles.bookText}>
            {!selected.length ? 'CHOOSE AN EXPERIENCE' : selected.length === 1 ? `${bookLabel} ${String(selected[0].display_name || selected[0].name).toUpperCase()}` : `${bookLabel} ${selected.length} EXPERIENCES`}
          </Text>
          <Text style={styles.bookArrow}>→</Text>
        </LinearGradient>
      </TouchableOpacity>

      <BookingModalUnified
        visible={booking}
        activities={selected}
        onClose={(ok) => {
          setBooking(false);
          if (ok) setSelected([]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 30, alignItems: 'center' },
  title: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 2, marginBottom: 6 },
  hint: { color: COLORS.textTertiary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  empty: { color: COLORS.textTertiary, fontSize: 14, paddingVertical: 20, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  image: { height: 130, justifyContent: 'flex-end' },
  imageStyle: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  gradient: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', padding: 14 },
  name: { color: COLORS.text, fontSize: 19, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 4 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 17, fontWeight: '700' },
  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 14, paddingTop: 10 },
  more: { paddingHorizontal: 14, paddingVertical: 10 },
  moreText: { fontSize: 13 },
  bookButton: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  bookGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 10 },
  bookText: { color: COLORS.background, fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
  bookArrow: { color: COLORS.background, fontSize: 18 },
});
