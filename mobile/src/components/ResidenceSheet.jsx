import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../constants/theme';
import apiClient from '../services/api';
import { fileUrl } from '../config';
import { Body, Button, Loading } from './ui';
import Panorama360 from './Panorama360';

const W = Dimensions.get('window').width;
const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
const label = (x) => (typeof x === 'string' ? x : x?.name || x?.label || '');

/**
 * Everything about a residence before choosing it: photos to swipe, the 360° view, size, rooms, view,
 * features and amenities (GET /apartments/categories/:id). Opened from the booking flow.
 */
export default function ResidenceSheet({ option, onClose, onChoose, priceLine }) {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState(null);
  const [page, setPage] = useState(0);
  const [tour, setTour] = useState(null);

  useEffect(() => {
    if (!option) return;
    setCat(null);
    setPage(0);
    setTour(null);
    // Photos and 360° views are often uploaded on a unit rather than on the category, and the category
    // endpoint only returns category media. Like the website, also read a unit (GET /apartments/:id
    // returns the unit's media plus its category's) and merge the two lists.
    const unitId = option.unit?.id || option.units?.[0]?.id;
    let live = true;
    Promise.all([
      apiClient.get(`/apartments/categories/${option.categoryId}`).then((r) => r.category || {}).catch(() => ({})),
      unitId ? apiClient.get(`/apartments/${unitId}`).then((r) => r.apartment || {}).catch(() => ({})) : Promise.resolve({}),
    ]).then(([category, unit]) => {
      if (!live) return;
      const seen = new Set();
      const media = [...list(category.media), ...list(unit.media)].filter((m) => {
        const key = m.id ?? m.file_url;
        if (!m.file_url || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setCat({ ...category, media });
    });
    return () => { live = false; };
  }, [option]);

  if (!option) return null;
  const media = list(cat?.media);
  const photos = media.filter((m) => m.media_type === 'image').sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const panoramas = media.filter((m) => m.media_type === 'panorama_360');
  const slides = photos.length ? photos.map((m) => fileUrl(m.file_url)) : option.image ? [fileUrl(option.image)] : [];
  const facts = [
    cat?.size_sqm ? { icon: 'resize-outline', t: `${Math.round(cat.size_sqm)} m²` } : null,
    (cat?.bedrooms ?? option.bedrooms) ? { icon: 'bed-outline', t: `${cat?.bedrooms ?? option.bedrooms} bedroom${(cat?.bedrooms ?? option.bedrooms) > 1 ? 's' : ''}` } : null,
    cat?.bathrooms ? { icon: 'water-outline', t: `${cat.bathrooms} bath${cat.bathrooms > 1 ? 's' : ''}` } : null,
    (cat?.max_guests || option.maxGuests) ? { icon: 'people-outline', t: `Up to ${cat?.max_guests || option.maxGuests} guests` } : null,
  ].filter(Boolean);
  const features = [...list(cat?.features), ...list(cat?.amenities)].map(label).filter(Boolean);

  return (
    <Modal visible animationType="slide" onRequestClose={tour ? () => setTour(null) : onClose} statusBarTranslucent>
      <View style={[st.wrap, { paddingTop: insets.top }]}>
        <View style={st.top}>
          <TouchableOpacity onPress={tour ? () => setTour(null) : onClose} style={st.round} accessibilityLabel={tour ? 'Back to photos' : 'Close'}>
            <Ionicons name={tour ? 'chevron-back' : 'close'} size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={st.topTitle} numberOfLines={1}>{tour ? '360° view' : option.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        {tour ? (
          <Panorama360 url={fileUrl(tour.file_url)} title={tour.title && !/\.(jpe?g|png|webp)$/i.test(tour.title) ? tour.title : option.name} style={{ flex: 1 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <View>
                {slides.length ? (
                  <FlatList
                    data={slides}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(u, i) => `${i}-${u}`}
                    onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
                    renderItem={({ item }) => <Image source={{ uri: item }} style={st.photo} />}
                  />
                ) : (
                  <Image source={require('../../assets/explore.jpg')} style={st.photo} />
                )}
                {slides.length > 1 ? (
                  <View style={st.dots}>
                    {slides.map((_, i) => <View key={i} style={[st.dot, i === page && st.dotOn]} />)}
                  </View>
                ) : null}
                {slides.length ? <Text style={st.count}>{page + 1} / {slides.length}</Text> : null}
              </View>

              <View style={{ padding: 20 }}>
                <Text style={st.name}>{option.name}</Text>
                {cat?.view_description ? <Body muted style={{ marginTop: 4 }}>{cat.view_description}</Body> : null}
                {!cat ? <Loading label="Loading the residence…" /> : null}

                {panoramas.length ? (
                  <View style={{ marginTop: 16, gap: 10 }}>
                    {panoramas.map((p) => (
                      <TouchableOpacity key={p.id} style={st.tourBtn} onPress={() => setTour(p)} activeOpacity={0.85}>
                        <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.tourTitle}>Step inside · 360°</Text>
                          <Text style={st.meta}>{p.title && !/\.(jpe?g|png|webp)$/i.test(p.title) ? p.title : 'Look around the residence'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {facts.length ? (
                  <View style={st.facts}>
                    {facts.map((f) => (
                      <View key={f.t} style={st.fact}>
                        <Ionicons name={f.icon} size={18} color={COLORS.primary} />
                        <Text style={st.factText}>{f.t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {(cat?.description || option.description) ? <Body style={{ marginTop: 18, lineHeight: 22 }}>{cat?.description || option.description}</Body> : null}

                {features.length ? (
                  <>
                    <Text style={st.section}>In the residence</Text>
                    <View style={st.chips}>
                      {features.map((f) => (
                        <View key={f} style={st.chip}>
                          <Ionicons name="checkmark" size={13} color={COLORS.primary} />
                          <Text style={st.chipText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            </ScrollView>
            {onChoose ? (
              <View style={[st.footer, { paddingBottom: 14 + insets.bottom }]}>
                {priceLine ? <Text style={st.priceLine}>{priceLine}</Text> : null}
                <Button title={option.unit ? 'Choose this residence' : 'Not available for these dates'} disabled={!option.unit} onPress={() => onChoose(option)} />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.backgroundCard, borderWidth: 1, borderColor: COLORS.border },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: FONTS.heading, fontSize: 15, color: COLORS.text, letterSpacing: 0.5 },
  photo: { width: W, height: W * 0.72, backgroundColor: COLORS.backgroundCard },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(242,233,216,0.4)' },
  dotOn: { backgroundColor: COLORS.primary, width: 18 },
  count: { position: 'absolute', top: 12, right: 12, color: COLORS.text, fontSize: 11.5, backgroundColor: 'rgba(13,13,13,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: 'hidden', fontFamily: FONTS.body },
  name: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.text, letterSpacing: 0.5 },
  tourBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderGold, backgroundColor: 'rgba(200,164,93,0.07)' },
  tourTitle: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.backgroundCard, borderWidth: 1, borderColor: COLORS.border },
  factText: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5 },
  section: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 17, marginTop: 22, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: COLORS.borderLight },
  chipText: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  priceLine: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13, marginBottom: 10, textAlign: 'center' },
});
