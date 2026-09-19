import { useEffect, useRef, useState } from 'react';
import { Image, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ad } from '@takc/shared';
import { trackAdImpression, trackAdLinkClick } from '@takc/shared';
import { supabase } from '../lib/supabase';
import { COLORS, FONT } from '../theme';

// The driver app previously had no ad surface at all — mirrors the rider
// app's AdOverlay (apps/rider/src/components/AdOverlay.tsx), swapping CSS
// scroll-snap for a paging ScrollView since this is React Native, not DOM.
export default function AdOverlay({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const hasBtn = !!(ad.buttonLabel && ad.buttonUrl);
  const images = ad.imageUrls;
  const [slide, setSlide] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    trackAdImpression(supabase, ad.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (trackWidth === 0) return;
    setSlide(Math.round(e.nativeEvent.contentOffset.x / trackWidth));
  };

  const openButton = () => {
    trackAdLinkClick(supabase, ad.id);
    if (ad.buttonUrl) Linking.openURL(ad.buttonUrl).catch(() => undefined);
    onClose();
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={[styles.imageArea, { height: ad.height }]} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
          {images.length > 0 && trackWidth > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              style={{ width: trackWidth, height: ad.height }}
            >
              {images.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{ width: trackWidth, height: ad.height }}
                  resizeMode={ad.imageFit}
                />
              ))}
            </ScrollView>
          ) : null}
          <LinearGradient
            colors={ad.imageFit === 'contain' ? ['rgba(24,22,25,.1)', 'rgba(24,22,25,.9)'] : ['rgba(24,22,25,0)', 'rgba(24,22,25,.94)']}
            locations={ad.imageFit === 'contain' ? [0, 1] : [0.28, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>إعلان</Text>
          </View>
          {images.length > 1 && (
            <View style={styles.dotsRow} pointerEvents="none">
              {images.map((url, i) => (
                <View key={url} style={[styles.dot, i === slide && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.textWrap} pointerEvents="none">
            <Text style={styles.title}>{ad.title}</Text>
            {!!ad.body && <Text style={styles.body}>{ad.body}</Text>}
          </View>
        </View>
        <View style={styles.actions}>
          {hasBtn && (
            <Pressable onPress={openButton} style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{ad.buttonLabel}</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>إغلاق</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24,22,25,.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 50
  },
  card: { width: '100%', maxWidth: 340, backgroundColor: COLORS.black, borderRadius: 24, overflow: 'hidden' },
  imageArea: { backgroundColor: '#101010' },
  badge: { position: 'absolute', top: 14, left: 14, backgroundColor: COLORS.yellow, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 10.5 },
  dotsRow: { position: 'absolute', top: 16, right: 14, flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.5)' },
  dotActive: { width: 14, backgroundColor: COLORS.yellow },
  textWrap: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  title: { fontSize: 22, fontFamily: FONT.heavy, color: COLORS.yellow },
  body: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.cream, marginTop: 6, lineHeight: 19 },
  actions: { padding: 16, gap: 9 },
  ctaBtn: { width: '100%', backgroundColor: COLORS.yellow, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  ctaBtnText: { color: COLORS.black, fontFamily: FONT.extraBold, fontSize: 14 },
  closeBtn: { width: '100%', borderWidth: 1.5, borderColor: 'rgba(244,239,225,.22)', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  closeBtnText: { color: COLORS.cream, fontFamily: FONT.bold, fontSize: 13 }
});
