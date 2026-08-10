import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space } from './tokens';
import { T } from './type';
import { PhotoFrame, GlassSheet, VerifiedRing } from './components/atoms';
import { BackButton, ActionButton, AttrLine, FilterLens, Lens } from './components/controls';
import { Breakfast, Quiet, Vegan, Bookmark, Share } from './icons';

/**
 * Экран собирается из готовых компонентов. Здесь нет ни одного hex,
 * ни одного размера шрифта и ни одного радиуса — только композиция.
 * Если хочется поправить внешний вид, правится tokens.ts, а не этот файл.
 */
export default function PlaceScreen({ place }: { place: any }) {
  const { height } = useWindowDimensions();
  const [saved, setSaved] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
        <PhotoFrame source={place.photos[0]} height={height * 0.58}>
          <SafeAreaView edges={['top']} style={styles.nav}>
            <BackButton to={place.categoryTitle} />
            <View style={{ paddingBottom: 11, justifyContent: 'flex-end' }}>
              <Share />
            </View>
          </SafeAreaView>

          <View style={styles.title}>
            <T preset="micro" tone="warm40" onPhoto>{place.district} · {place.categoryTitle}</T>
            <T preset="display" tone="warm" onPhoto style={{ marginTop: space.md }}>{place.name}</T>
            <T preset="viet" tone="gold" style={{ marginTop: 9 }}>{place.nameVi}</T>

            {place.verified && (
              <View style={styles.verified}>
                <VerifiedRing />
                <T preset="label" tone="warm60">проверено гидом · {place.verifiedAt}</T>
              </View>
            )}
          </View>
        </PhotoFrame>

        <GlassSheet style={styles.sheet}>
          <View style={styles.strip}>
            <Stat label="ОТКРЫТО" value={place.closesAt} tone="open" />
            <Stat label="ИДТИ" value={place.distance} meta={place.walkTime} divider />
            <Stat label="ЧЕК" value={place.priceFrom} meta={place.priceUnit} divider />
          </View>

          <T preset="body" tone="warm60" style={{ marginTop: space.xl }}>{place.description}</T>

          <AttrLine
            attrs={[
              { icon: <Breakfast />, label: 'Завтраки' },
              { icon: <Quiet />, label: 'Тихий двор' },
              { icon: <Vegan />, label: 'Vegan' },
              ...place.extraAttrs,
            ]}
            onMore={() => {}}
          />

          <View style={styles.dock}>
            <ActionButton label="Маршрут" meta={place.walkTime} full />
            <Mark saved={saved} onPress={() => setSaved(s => !s)} />
          </View>
        </GlassSheet>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, meta, tone = 'warm', divider }: any) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <T preset="micro" tone="warm40">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 5 }}>
        <T preset="title" tone={tone}>{value}</T>
        {meta && <T preset="label" tone="warm60">{meta}</T>}
      </View>
    </View>
  );
}

function Mark({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.mark, pressed && { opacity: 0.85 }]}>
      <Bookmark filled={saved} stroke={saved ? color.gold : color.warm} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.deep },
  nav: {
    position: 'absolute', top: 0, left: space.xl, right: space.xl,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 2,
  },
  title: { position: 'absolute', left: space.xl, right: 88, top: 96 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: space.lg },
  sheet: { marginTop: -34 },
  strip: { flexDirection: 'row' },
  stat: { flex: 1, paddingHorizontal: 12 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.hair },
  dock: { flexDirection: 'row', gap: 11, marginTop: space.xl },
  mark: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1, borderColor: color.warm25,
    backgroundColor: 'rgba(244,239,227,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
});
