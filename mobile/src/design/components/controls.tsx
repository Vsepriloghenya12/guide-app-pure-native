import React from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { color, radius, space, hit, glow, text } from '../tokens';
import { T } from '../type';
import { Glow } from './atoms';
import { ArrowBack, Sliders, Navigate } from '../icons';

/* ─────────────────────────────────────────────────────────────
   Назад. Называет адресата, а не показывает голый шеврон.
   Площадь нажатия 46×88 при нулевом визуальном весе.
   При нажатии стрелка уходит влево — направление показано движением.
   ───────────────────────────────────────────────────────────── */
export function BackButton({ to, onPress }: { to: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
      {({ pressed }) => (
        <>
          <View style={{ transform: [{ translateX: pressed ? -4 : 0 }] }}>
            <ArrowBack stroke={pressed ? color.warm : color.warm60} />
          </View>
          <T preset="label" tone={pressed ? 'warm' : 'warm60'} onPhoto>{to}</T>
        </>
      )}
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────
   Кнопка фильтров. Число вместо точки-бейджа: видно, сколько включено,
   не открывая панель. Активность — светящаяся линия, та же идиома, что и в ленте.
   ───────────────────────────────────────────────────────────── */
export function FilterButton({ activeCount = 0, onPress }: { activeCount?: number; onPress?: () => void }) {
  const on = activeCount > 0;
  return (
    <Pressable onPress={onPress} hitSlop={12}
      style={({ pressed }) => [styles.flt, pressed && !on && styles.fltPressed]}>
      <Sliders active={on} stroke={on ? color.warm : color.warm40} />
      <T preset="label" tone={on ? 'warm' : 'warm40'} onPhoto>Фильтры</T>
      {on && <T preset="count" tone="amber">{String(activeCount)}</T>}
      {on && <ActiveUnderline />}
    </Pressable>
  );
}

/** Общая идиома включённости на весь интерфейс */
function ActiveUnderline({ partial = false }: { partial?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.underlineWrap, partial && { right: undefined, width: '44%' }]}>
      <Glow width={80} height={2} tint={glow.line.color} opacity={0.55} spread={4} />
      <View style={styles.underline} />
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Лента фильтров. Ни одной капсулы: слово, счётчик, светящаяся линия.
   У каждого фильтра число результатов — последствие видно до нажатия.
   Нулевой результат приглушён и не нажимается: в пустой экран попасть нельзя.
   Правый край растворяется маской, а не обрезается на полуслове.
   ───────────────────────────────────────────────────────────── */
export interface Lens { id: string; label: string; count: number; active: boolean; }

export function FilterLens({ items, onToggle }: { items: Lens[]; onToggle: (id: string) => void }) {
  return (
    <MaskedView
      style={{ height: hit.minHeight }}
      maskElement={
        <LinearGradient
          colors={['#000', '#000', 'transparent']}
          locations={[0, 0.8, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lens}>
        {items.map(it => {
          const dead = it.count === 0;
          return (
            <Pressable key={it.id} disabled={dead} onPress={() => onToggle(it.id)}
              style={({ pressed }) => [styles.ln, pressed && !it.active && !dead && { opacity: 0.9 }]}>
              <T preset={it.active ? 'lensOn' : 'lens'}
                 tone={dead ? 'warm40' : it.active ? 'warm' : 'warm60'}
                 onPhoto style={dead && { opacity: 0.5 }}>
                {it.label}
              </T>
              <T preset="count" tone={it.active ? 'amber' : 'warm40'} style={dead && { opacity: 0.5 }}>
                {String(it.count)}
              </T>
              {it.active && <ActiveUnderline />}
            </Pressable>
          );
        })}
      </ScrollView>
    </MaskedView>
  );
}

/* ─────────────────────────────────────────────────────────────
   Строка атрибутов места. Это информация, а не управление,
   поэтому ни рамок, ни заливок: иконка, слово, волосяной разделитель.
   Показываются три самых значимых, остальное уходит в «ещё N» —
   гид отбирает, а не вываливает всё.
   ───────────────────────────────────────────────────────────── */
export interface Attr { icon: React.ReactNode; label: string; }

export function AttrLine({ attrs, onMore }: { attrs: Attr[]; onMore?: () => void }) {
  const shown = attrs.slice(0, 3);
  const rest = attrs.length - shown.length;
  return (
    <View style={styles.attrs}>
      {shown.map((a, i) => (
        <React.Fragment key={a.label}>
          {i > 0 && <View style={styles.sep} />}
          <View style={styles.attr}>
            {a.icon}
            <T preset="label" tone="warm60">{a.label}</T>
          </View>
        </React.Fragment>
      ))}
      {rest > 0 && (
        <Pressable onPress={onMore} hitSlop={10} style={{ marginLeft: 'auto' }}>
          <T preset="label" tone="warm40">ещё {rest} →</T>
        </Pressable>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────
   Главное действие. Единственный элемент с янтарной заливкой на экране.
   Свечение того же цвета, что и источник света в сцене — кнопка
   не наклеена на кадр, она в нём горит.
   ───────────────────────────────────────────────────────────── */
export function ActionButton({
  label, meta, onPress, width = 240, full = false,
}: { label: string; meta?: string; onPress?: () => void; width?: number; full?: boolean }) {
  const h = 58;
  // при full ширину задаёт layout (flex:1) — свечение центрируется по измеренной ширине
  const [measured, setMeasured] = React.useState(0);
  const glowWidth = full ? (measured || width) : width;
  return (
    <View
      onLayout={full ? e => setMeasured(e.nativeEvent.layout.width) : undefined}
      style={[full && { flex: 1 }, { height: h, justifyContent: 'center' }]}
    >
      <Glow width={glowWidth} height={h}
        tint={glow.action.color} opacity={glow.action.opacity} spread={glow.action.spread} />
      <Pressable onPress={onPress}
        style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <LinearGradient
          colors={[color.amberTop, color.amberDeep]}
          style={[styles.action, { height: h }]}
        >
          <Navigate />
          <T preset="title" tone="ink" style={{ flex: 1, marginLeft: space.sm }}>{label}</T>
          {meta && (
            <View style={styles.actionMeta}>
              <T preset="label" tone="ink">{meta}</T>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    minHeight: hit.minHeight, minWidth: hit.minWidth, paddingBottom: 11,
    alignSelf: 'flex-start', justifyContent: 'flex-end',
  },
  backPressed: {},
  flt: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    minHeight: hit.minHeight, paddingBottom: 11,
    justifyContent: 'flex-end',
  },
  fltPressed: { opacity: 0.85 },
  underlineWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, justifyContent: 'center' },
  underline: { height: 2, borderRadius: 2, backgroundColor: color.amber },
  lens: { flexDirection: 'row', gap: 22, alignItems: 'flex-end', paddingRight: 46, height: hit.minHeight },
  ln: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingBottom: 11, height: hit.minHeight, justifyContent: 'flex-end' },
  attrs: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: space.xl },
  attr: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sep: { width: 1, height: 12, backgroundColor: color.hair },
  action: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.action, paddingLeft: space.xl, paddingRight: space.xs,
  },
  actionMeta: {
    backgroundColor: 'rgba(27,18,6,0.16)', borderRadius: 22,
    paddingHorizontal: 13, paddingVertical: 7,
  },
});
