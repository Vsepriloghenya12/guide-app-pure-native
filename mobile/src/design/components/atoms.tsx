import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image, ImageSource } from 'expo-image';
import { color, radius, photo, glow, space } from '../tokens';
import { Check } from '../icons';

/**
 * Свечение.
 * ВАЖНО: цветная тень в RN работает только на iOS. На Android shadowColor игнорируется
 * во всех версиях ниже 28, а elevation даёт серую тень. Поэтому свечение здесь —
 * не тень, а радиальный градиент под элементом. Выглядит одинаково на обеих платформах.
 */
export function Glow({
  width, height, radius: r = 999, tint = glow.action.color,
  opacity = glow.action.opacity, spread = glow.action.spread, style,
}: {
  width: number; height: number; radius?: number; tint?: string;
  opacity?: number; spread?: number; style?: StyleProp<ViewStyle>;
}) {
  const w = width * spread;
  const h = height * spread;
  return (
    <View pointerEvents="none" style={[
      { position: 'absolute', width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 },
      style,
    ]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="url(#g)" />
      </Svg>
    </View>
  );
}

/**
 * Обработка фотографии из CMS.
 * Это самый важный компонент всего слоя: снимки приходят непредсказуемого качества,
 * и без единой обработки композиция «кадра» разваливается на первой же реальной фотографии.
 *
 * Слои снизу вверх: фото → затемнение → тёплая коррекция → виньетка →
 * верхний скрим под навигацию → нижний градиент, уходящий в шторку.
 */
export function PhotoFrame({
  source, height, children, bottomFadeTo = color.deep, showTopScrim = true,
}: {
  source: ImageSource | string; height: number; children?: React.ReactNode;
  bottomFadeTo?: string; showTopScrim?: boolean;
}) {
  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        transition={220}
        placeholder={{ blurhash: 'L03[]0of00ay~qj[9Fj[00fQ_3fQ' }}
      />

      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(4,10,7,${photo.darken})` }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: photo.warmGrade }]} />

      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="vig" cx="50%" cy="40%" r="72%">
            <Stop offset="0.4" stopColor="#030805" stopOpacity={0} />
            <Stop offset="1" stopColor="#030805" stopOpacity={photo.vignetteOpacity} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#vig)" />
      </Svg>

      {showTopScrim && (
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(3,8,5,${photo.topScrimOpacity})`, 'rgba(3,8,5,0.28)', 'transparent']}
          locations={[0, 0.46, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: photo.topScrimHeight }}
        />
      )}

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', bottomFadeTo]}
        locations={[0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.42 }}
      />

      {children}
    </View>
  );
}

/**
 * Стеклянная шторка. Сквозь неё видно сцену — это и делает её частью кадра,
 * а не наклейкой. По верхней кромке хайлайт в один пиксель, затухающий к краям.
 */
export function GlassSheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sheet, style]}>
      <BlurView
        intensity={Platform.OS === 'android' ? 60 : 42}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(8,17,12,0.42)', 'rgba(6,13,9,0.86)', 'rgba(5,11,8,0.96)']}
        locations={[0, 0.34, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sheetEdge} />
      <LinearGradient
        colors={['transparent', color.hairBright, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.sheetHighlight}
      />
      <View style={{ padding: space.xl, paddingBottom: space.xxl }}>{children}</View>
    </View>
  );
}

/** Знак курации: тонкое золотое кольцо со свечением. Не бейдж на подложке — источник света в сцене. */
export function VerifiedRing({ size = 23 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Glow width={size} height={size} tint={glow.ring.color}
        opacity={glow.ring.opacity} spread={glow.ring.spread} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.4, borderColor: color.gold,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={size * 0.48} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  sheetEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: color.hair,
  },
  sheetHighlight: {
    position: 'absolute', top: 0, left: radius.sheet, right: radius.sheet, height: 1,
  },
});
