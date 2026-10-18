import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import guest from '../../services/guestService';
import { fileUrl } from '../../config';
import { COLORS, FONTS } from '../../constants/theme';
import { ZONE_DATA } from '../../constants/wellnessData';
import { EXPLORE_IMAGE } from '../../constants/images';

const escapeHtml = (t) => String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default function ExploreScreen({ navigation }) {
  const [activeView, setActiveView] = useState('locations'); // 'locations' or 'virtual-tour'
  const [selectedLocation, setSelectedLocation] = useState(null);
  // Real 360° panoramas of the residences, uploaded in HQ (GET /api/guest/tour).
  const [tour, setTour] = useState([]);

  useEffect(() => {
    guest
      .tour()
      .then((list) => setTour((list || []).map((p) => ({ id: String(p.id), name: p.title, desc: p.residence || 'Faysha', url: fileUrl(p.url) }))))
      .catch(() => setTour([]));
  }, []);

  const handleZonePress = (zone) => {
    navigation.navigate('Detail', {
      title: zone.name,
      subtitle: zone.sub,
      img: zone.img,
      description: zone.desc,
      features: zone.features,
    });
  };

  const handleVirtualTourPress = () => {
    setActiveView('virtual-tour');
    setSelectedLocation(tour[0]);
  };

  const handleBackToLocations = () => {
    setActiveView('locations');
    setSelectedLocation(null);
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  // Generate 360° viewer HTML with Pannellum
  const getVirtualTourHTML = (location) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; background: #0D0D0D; }
          #panorama { width: 100vw; height: 100vh; }
          .custom-hotspot {
            height: 50px;
            width: 50px;
            background: linear-gradient(135deg, #C8A45D, #D68910);
            border: 3px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(200, 164, 93, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          .info-overlay {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(13, 13, 13, 0.9);
            border: 1px solid rgba(200, 164, 93, 0.5);
            border-radius: 12px;
            padding: 12px 20px;
            color: #F2E9D8;
            font-family: -apple-system, sans-serif;
            font-size: 14px;
            text-align: center;
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div id="panorama"></div>
        <div class="info-overlay">
          <div style="font-size: 16px; font-weight: 700; color: #C8A45D; margin-bottom: 4px;">${escapeHtml(location.name)}</div>
          <div style="font-size: 12px; opacity: 0.8;">Drag to look around</div>
        </div>
        <script>
          pannellum.viewer('panorama', {
            "type": "equirectangular",
            "panorama": ${JSON.stringify(location.url).replace(/</g, "\\u003c")},
            "autoLoad": true,
            "showControls": false,
            "mouseZoom": false,
            "draggable": true,
            "showFullscreenCtrl": false,
            "compass": false
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'navigate') {
        // Navigate to next location in the tour
        const currentIndex = tour.findIndex((loc) => loc.id === selectedLocation.id);
        setSelectedLocation(tour[(currentIndex + 1) % tour.length]);
      }
    } catch (error) {
      console.log('WebView message error:', error);
    }
  };

  return (
    <View style={styles.container}>
      {activeView === 'locations' ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Hero Image */}
          <ImageBackground
            source={EXPLORE_IMAGE}
            style={styles.hero}
          >
            <LinearGradient
              colors={['rgba(13,13,13,0.1)', '#0D0D0D']}
              style={styles.heroGradient}
            >
              <Text style={styles.heroTitle}>Explore Faysha</Text>
            </LinearGradient>
          </ImageBackground>

          {/* Virtual Tour Card (once 360° photos are uploaded) */}
          <View style={styles.content}>
            {tour.length > 0 && (
            <TouchableOpacity
              onPress={handleVirtualTourPress}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.05)']}
                style={styles.virtualTourCard}
              >
                <View style={styles.virtualTourHeader}>
                  <LinearGradient
                    colors={['#C8A45D', '#D68910']}
                    style={styles.virtualTourIcon}
                  >
                    <Text style={styles.virtualTourIconText}>360°</Text>
                  </LinearGradient>
                  <View style={styles.virtualTourInfo}>
                    <Text style={styles.virtualTourTitle}>VIRTUAL TOUR</Text>
                    <Text style={styles.virtualTourDesc}>Explore the estate in 360°</Text>
                  </View>
                  <View style={styles.virtualTourChevron}>
                    <Text style={styles.chevronText}>→</Text>
                  </View>
                </View>
                <Text style={styles.virtualTourSubtext}>
                  Step inside our residences from wherever you are — {tour.length} 360° view{tour.length > 1 ? 's' : ''} to explore.
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>EXPLORE BY LOCATION</Text>

            {/* Zones List */}
            {ZONE_DATA.map((zone, index) => (
              <TouchableOpacity
                key={index}
                style={styles.zoneItem}
                onPress={() => handleZonePress(zone)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                  style={styles.zoneIcon}
                >
                  <Text style={styles.zoneGlyph}>{zone.glyph}</Text>
                </LinearGradient>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneSub}>{zone.sub}</Text>
                </View>
                <View style={styles.zoneChevronContainer}>
                  <Text style={styles.zoneChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.tourContainer}>
          {/* Location Selector */}
          <View style={styles.locationSelectorWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.locationSelector}
            >
              {tour.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  onPress={() => handleLocationSelect(location)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      selectedLocation?.id === location.id
                        ? ['#C8A45D', '#D68910']
                        : ['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.05)']
                    }
                    style={[
                      styles.locationCard,
                      selectedLocation?.id === location.id && styles.locationCardActive
                    ]}
                  >
                    <Text style={styles.locationIcon}>◎</Text>
                    <Text style={[
                      styles.locationName,
                      selectedLocation?.id === location.id && styles.locationNameActive
                    ]}>
                      {location.name}
                    </Text>
                    <Text style={[
                      styles.locationDesc,
                      selectedLocation?.id === location.id && styles.locationDescActive
                    ]}>
                      {location.desc}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 360° Viewer */}
          {selectedLocation && (
            <View style={styles.viewerContainer}>
              <WebView
                source={{ html: getVirtualTourHTML(selectedLocation) }}
                style={styles.webView}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
              />
            </View>
          )}

          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBackToLocations}
            activeOpacity={0.85}
            style={styles.backButton}
          >
            <LinearGradient
              colors={['rgba(200, 164, 93, 0.2)', 'rgba(200, 164, 93, 0.1)']}
              style={styles.backButtonInner}
            >
              <Text style={styles.backButtonText}>← Back to Explore</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    height: 170,
    position: 'relative',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 22,
    paddingBottom: 14,
  },
  heroTitle: {
    fontFamily: FONTS.heading,
    fontSize: 19,
    color: COLORS.text,
  },
  content: {
    padding: 22,
    paddingTop: 18,
  },

  // Virtual Tour Card
  virtualTourCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 6,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 164, 93, 0.5)',
    backgroundColor: 'rgba(13, 13, 13, 0.5)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  virtualTourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 14,
  },
  virtualTourIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  virtualTourIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.background,
  },
  virtualTourInfo: {
    flex: 1,
  },
  virtualTourTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COLORS.primary,
    marginBottom: 3,
  },
  virtualTourDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  virtualTourChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  chevronText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  virtualTourSubtext: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    fontWeight: '700',
    marginBottom: 14,
  },

  // Zone Items
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  zoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  zoneGlyph: {
    fontSize: 18,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 3,
  },
  zoneSub: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  zoneChevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneChevron: {
    fontSize: 16,
    color: COLORS.primary,
  },

  // Virtual Tour View
  tourContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  locationSelectorWrapper: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  locationSelector: {
    paddingHorizontal: 18,
    gap: 12,
  },
  locationCard: {
    width: 120,
    height: 110,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  locationCardActive: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.4,
    elevation: 8,
  },
  locationIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  locationName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  locationNameActive: {
    color: COLORS.background,
  },
  locationDesc: {
    fontSize: 10,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  locationDescActive: {
    color: 'rgba(13, 13, 13, 0.8)',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backButton: {
    position: 'absolute',
    bottom: 24,
    left: 22,
    right: 22,
  },
  backButtonInner: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
});
