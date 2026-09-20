import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildTileGrid } from '../lib/tiles';
import { COLORS, FONT } from '../theme';

const ZOOM = 16;
const TILE_SIZE = 256;
const DISPLAY_SIZE = 270;
const SCALE = DISPLAY_SIZE / (TILE_SIZE * 3);
const TILE_DISPLAY = TILE_SIZE * SCALE;

// A real OSM map preview built from raw XYZ tile images (no react-native-maps,
// no API key, no native rebuild) — see src/lib/tiles.ts. "Open in maps" covers
// actual turn-by-turn navigation; this is just so the driver can see where
// the rider is without leaving the app.
export default function PickupMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const grid = buildTileGrid(lat, lng, ZOOM);
  const pinLeft = grid.pinOffsetPx.x * SCALE;
  const pinTop = grid.pinOffsetPx.y * SCALE;

  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View>
      <Pressable onPress={openInMaps} style={styles.card}>
        <View style={[styles.grid, { width: DISPLAY_SIZE, height: DISPLAY_SIZE }]}>
          {grid.tiles.map((t) => (
            <Image key={`${t.x}-${t.y}`} source={{ uri: t.url }} style={{ width: TILE_DISPLAY, height: TILE_DISPLAY, backgroundColor: '#e8e6df' }} />
          ))}
        </View>
        <View style={[styles.pin, { left: pinLeft - 11, top: pinTop - 27 }]}>
          <View style={styles.pinDot} />
          <View style={styles.pinStem} />
        </View>
        <View style={styles.attribution}>
          <Text style={styles.attributionText}>© OpenStreetMap</Text>
        </View>
      </Pressable>
      <Pressable onPress={openInMaps} style={styles.navBtn}>
        <Text style={styles.navBtnText}>فتح في خرائط جوجل للتوجيه إلى {label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden', alignSelf: 'center', borderWidth: 1, borderColor: '#e7e1d0' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  pin: { position: 'absolute', alignItems: 'center' },
  pinDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.yellow, borderWidth: 3, borderColor: COLORS.black },
  pinStem: { width: 2.5, height: 7, backgroundColor: COLORS.black, marginTop: -1 },
  attribution: { position: 'absolute', bottom: 4, insetInlineEnd: 6, backgroundColor: 'rgba(255,255,255,.8)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  attributionText: { fontSize: 8.5, fontFamily: FONT.regular, color: '#575757' },
  navBtn: { backgroundColor: COLORS.black, borderRadius: 13, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  navBtnText: { color: COLORS.yellow, fontFamily: FONT.extraBold, fontSize: 13 }
});
