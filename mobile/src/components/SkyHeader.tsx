import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, Path, Polyline, Rect, Stop, Text as SvgText, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BucketKey } from '../theme/tokens';
import { appLogo } from '../assets';

const CACHE_KEY = 'guide-weather-cache-v1';
const DANANG = { latitude: 16.0678, longitude: 108.2208 };

export type HourPoint = { label: string; temp: number; pop: number; code: number };
export type WeatherSnapshot = {
  fetchedAt: number;
  temp: number;
  code: number;
  humidity: number;
  wind: number;
  uv?: number;
  sunrise?: string;
  sunset?: string;
  hours: HourPoint[];
  clearHours: number;
  turnLabel: string;
  turnHour: string;
};

const isRain = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
const isStorm = (code: number) => code >= 95;

export function weatherLabel(code: number): string {
  if (isStorm(code)) return 'Гроза';
  if (isRain(code)) return 'Дождь';
  if (code === 45 || code === 48) return 'Туман';
  if (code === 3) return 'Пасмурно';
  if (code === 2) return 'Облачно';
  if (code === 1) return 'Переменная облачность';
  return 'Ясно';
}

function uvLabel(uv: number): string {
  if (uv < 3) return 'низкий';
  if (uv < 6) return 'умеренный';
  if (uv < 8) return 'высокий';
  return 'очень высокий';
}

function danangNow() {
  const shifted = new Date(Date.now() + 7 * 3600 * 1000);
  return { date: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

async function load(): Promise<WeatherSnapshot | null> {
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' + DANANG.latitude +
      '&longitude=' + DANANG.longitude +
      '&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code' +
      '&daily=uv_index_max,sunrise,sunset' +
      '&forecast_days=2&timezone=Asia%2FHo_Chi_Minh';
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    const times: string[] = json.hourly?.time ?? [];
    const temps: number[] = json.hourly?.temperature_2m ?? [];
    const pops: number[] = json.hourly?.precipitation_probability ?? [];
    const codes: number[] = json.hourly?.weather_code ?? [];
    const { date, hour } = danangNow();
    const needle = `${date}T${String(hour).padStart(2, '0')}:00`;
    let start = times.indexOf(needle);
    if (start < 0) start = times.findIndex((t) => t > needle);
    if (start < 0) start = 0;
    const hours: HourPoint[] = [];
    for (let i = start; i < Math.min(start + 12, times.length); i++) {
      hours.push({ label: times[i].slice(11, 16), temp: Math.round(temps[i] ?? 0), pop: pops[i] ?? 0, code: codes[i] ?? 0 });
    }
    let clearHours = 0;
    for (const h of hours) {
      if ((h.pop ?? 0) >= 50 || isRain(h.code)) break;
      clearHours += 1;
    }
    const turn = hours.find((h) => isRain(h.code) || h.pop >= 50);
    const snap: WeatherSnapshot = {
      fetchedAt: Date.now(),
      temp: Math.round(json.current?.temperature_2m ?? 0),
      code: json.current?.weather_code ?? 0,
      humidity: Math.round(json.current?.relative_humidity_2m ?? 0),
      wind: Math.round(json.current?.wind_speed_10m ?? 0),
      uv: Math.round(json.daily?.uv_index_max?.[0] ?? 0),
      sunrise: String(json.daily?.sunrise?.[0] || '').slice(11, 16),
      sunset: String(json.daily?.sunset?.[0] || '').slice(11, 16),
      hours,
      clearHours,
      turnLabel: turn ? weatherLabel(turn.code) : '',
      turnHour: turn ? turn.label : ''
    };
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snap)).catch(() => undefined);
    return snap;
  } catch {
    return null;
  }
}

export function useWeather(): WeatherSnapshot | null {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const fresh = await load();
      if (mounted && fresh) {
        setSnap(fresh);
        return;
      }
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (mounted && cached) setSnap(JSON.parse(cached) as WeatherSnapshot);
      } catch {
        // нет кэша — блока не будет (по спеке: нет прогноза — нет блока)
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return snap;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduce(v);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  return reduce;
}

function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const SKY: Record<BucketKey, { top: string; mid: string; bottom: string; orb: string }> = {
  dawn: { top: '#241f3d', mid: '#7a4a63', bottom: '#e59a6c', orb: '#ffd9a0' },
  morning: { top: '#7fb2d9', mid: '#a8cbe4', bottom: '#e8f1f7', orb: '#fff3c9' },
  day: { top: '#4d94d6', mid: '#7db4e0', bottom: '#cfe6f5', orb: '#fff8d8' },
  sunset: { top: '#3a2547', mid: '#c05a6a', bottom: '#f2a35c', orb: '#ffcf8a' },
  evening: { top: '#0d1b33', mid: '#1d3050', bottom: '#3a4a6a', orb: '#e8f0ff' },
  night: { top: '#070b18', mid: '#0d1526', bottom: '#1a2438', orb: '#f0f4ff' }
};

export function LivingSky({ bucket, snap }: { bucket: BucketKey; snap: WeatherSnapshot | null }) {
  const sky = SKY[bucket];
  const night = bucket === 'evening' || bucket === 'night';
  const code = snap?.code ?? 0;
  const rain = snap ? isRain(code) : false;
  const storm = snap ? isStorm(code) : false;
  const cloudy = snap ? code >= 2 && code <= 3 : false;
  const reduce = useReduceMotion();
  const rainAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rain || reduce) return undefined;
    const loop = Animated.loop(Animated.timing(rainAnim, { toValue: 1, duration: 900, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rain, reduce]);
  const rainShift = rainAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[hexA(sky.top, 0.5), hexA(sky.mid, 0.38), hexA(sky.bottom, 0.24)]} style={StyleSheet.absoluteFill} />
      {storm ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 14, 25, 0.35)' }]} /> : null}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
        {!cloudy && !rain ? <Circle cx={288} cy={44} r={night ? 13 : 17} fill={sky.orb} opacity={0.95} /> : null}
        {night && !cloudy && !rain ? (
          <>
            <Circle cx={60} cy={30} r={1.4} fill="#ffffff" opacity={0.8} />
            <Circle cx={110} cy={52} r={1.1} fill="#ffffff" opacity={0.6} />
            <Circle cx={170} cy={26} r={1.2} fill="#ffffff" opacity={0.7} />
            <Circle cx={228} cy={60} r={1} fill="#ffffff" opacity={0.5} />
          </>
        ) : null}
                {cloudy || rain ? (
          <>
            <Ellipse cx={96} cy={64} rx={52} ry={14} fill={night ? '#2a3650' : '#ffffff'} opacity={night ? 0.5 : 0.5} />
            <Ellipse cx={170} cy={52} rx={38} ry={11} fill={night ? '#22304a' : '#f4f9ff'} opacity={night ? 0.45 : 0.42} />
            <Ellipse cx={264} cy={70} rx={46} ry={13} fill={night ? '#2a3650' : '#ffffff'} opacity={night ? 0.4 : 0.38} />
          </>
        ) : null}
      </Svg>
      {rain ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: rainShift }] }]}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
            {[40, 84, 128, 172, 216, 260, 304].map((x, i) => (
              <Line key={x} x1={x} y1={70 + (i % 3) * 18} x2={x - 6} y2={84 + (i % 3) * 18} stroke={night ? '#9fb8dd' : '#e8f2fb'} strokeWidth={2} strokeLinecap="round" opacity={0.75} />
            ))}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function WeatherStrip({ snap, fg, dim, acc, hair }: { snap: WeatherSnapshot | null; fg: string; dim: string; acc: string; hair: string }) {
  if (!snap || snap.hours.length === 0) return null;
  const ring = Math.max(0.04, Math.min(1, snap.clearHours / 12));
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <View style={[stripStyles.wrap, { borderBottomColor: hair }]}>
      <View style={stripStyles.left}>
        <Text style={[stripStyles.temp, { color: fg }]}>{snap.temp}°</Text>
        <View style={stripStyles.col}>
          <Text style={[stripStyles.label, { color: fg }]}>{weatherLabel(snap.code)}</Text>
          <Text style={[stripStyles.sub, { color: dim }]}>ветер {snap.wind} км/ч · влажность {snap.humidity}%</Text>
        </View>
      </View>
      <View style={stripStyles.right}>
        <Svg width={40} height={40} viewBox="0 0 40 40">
          <Circle cx={20} cy={20} r={R} stroke={hair} strokeWidth={4} fill="none" />
          <Circle cx={20} cy={20} r={R} stroke={acc} strokeWidth={4} fill="none" strokeDasharray={`${C * ring} ${C}`} strokeLinecap="round" transform="rotate(-90 20 20)" />
                </Svg>
        <View style={stripStyles.colRight}>
          <Text style={[stripStyles.labelRight, { color: fg }]} numberOfLines={1}>{snap.clearHours > 0 ? `ясно ещё ${snap.clearHours} ч` : 'окно закрылось'}</Text>
          <Text style={[stripStyles.subRight, { color: dim }]} numberOfLines={1}>{snap.turnHour ? `к ${snap.turnHour} — ${snap.turnLabel.toLowerCase()}` : snap.clearHours > 0 ? 'без осадков 12 ч' : 'возможны короткие дожди'}</Text>
        </View>
      </View>
    </View>
  );
}

// Горизонт на 12 часов: линия температуры, синие столбики осадков,
// точка «сейчас», пунктир перелома. Скраб — час/градус/вероятность, тап — штора.
export function WeatherHorizon({ snap, fg, dim, acc, hair, onOpen }: {
  snap: WeatherSnapshot | null;
  fg: string;
  dim: string;
  acc: string;
  hair: string;
  onOpen: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const moveRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  if (!snap || snap.hours.length < 2) return null;
  const hours = snap.hours;
  const L = 12;
  const R = 340;
  const step = (R - L) / (hours.length - 1);
  const temps = hours.map((h) => h.temp);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const yTemp = (t: number) => (tMax === tMin ? 40 : 56 - ((t - tMin) / (tMax - tMin)) * 34);
  const linePoints = hours.map((h, i) => `${L + i * step},${yTemp(h.temp)}`).join(' ');
  const turnIndex = hours.findIndex((h) => h.pop >= 50 || isRain(h.code));
  const updateScrub = (x: number) => {
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    setScrub(Math.round(ratio * (hours.length - 1)));
  };
  return (
    <View
      style={{ marginHorizontal: 14, marginTop: 4 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        moveRef.current = 0;
        updateScrub(e.nativeEvent.locationX);
      }}
      onResponderMove={(e) => {
        moveRef.current += Math.abs((e.nativeEvent as any).dx || 0) + Math.abs((e.nativeEvent as any).dy || 0);
        updateScrub(e.nativeEvent.locationX);
      }}
      onResponderRelease={() => {
        if (moveRef.current < 8) onOpen();
        setScrub(null);
      }}
    >
      {scrub !== null ? (
        <View style={[hzStyles.tooltip, { left: Math.max(0, Math.min(width - 96, (scrub / (hours.length - 1)) * (width - 96))) }]}>
          <Text style={[hzStyles.tooltipText, { color: fg }]}>
            {hours[scrub].label} · {hours[scrub].temp}° · {hours[scrub].pop}%
          </Text>
        </View>
      ) : null}
      <Svg width="100%" height={112} viewBox="0 0 352 112" preserveAspectRatio="none">
        {hours.map((h, i) =>
          h.pop > 0 ? (
            <Rect key={h.label} x={L + i * step - 2} y={92 - (h.pop / 100) * 26} width={4} height={(h.pop / 100) * 26} rx={2} fill="#3f8fd6" opacity={0.75} />
          ) : null
        )}
        {turnIndex >= 0 ? (
          <Line x1={L + turnIndex * step} y1={12} x2={L + turnIndex * step} y2={92} stroke={dim} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
        ) : null}
        <Polyline points={linePoints} fill="none" stroke={acc} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={L} cy={yTemp(hours[0].temp)} r={4.5} fill={acc} stroke="#ffffff" strokeWidth={1.5} />
        {hours.map((h, i) =>
          i % 3 === 0 ? (
            <SvgText key={`t-${h.label}`} x={L + i * step} y={106} textAnchor="middle" fontSize={9} fontWeight="700" fill={dim}>
              {h.label}
            </SvgText>
          ) : null
        )}
      </Svg>
      <Text style={[hzStyles.hint, { color: dim }]}>проведи по горизонту · нажми — расписание дня</Text>
    </View>
  );
}

// Штора: «окна дня» как расписание планов + почасовой ряд + УФ/ветер/закат.
export function WeatherSheet({ visible, snap, onClose, fg, dim, acc, hair, pageColor }: {
  visible: boolean;
  snap: WeatherSnapshot | null;
  onClose: () => void;
  fg: string;
  dim: string;
  acc: string;
  hair: string;
  pageColor: string;
}) {
  if (!snap || snap.hours.length === 0) return null;
  const hours = snap.hours;
  const wins: Array<{ start: string; end: string; kind: 'clear' | 'rain' }> = [];
  for (let i = 0; i < hours.length; ) {
    const kind: 'clear' | 'rain' = hours[i].pop >= 50 || isRain(hours[i].code) ? 'rain' : 'clear';
    let j = i;
    while (j + 1 < hours.length && (hours[j + 1].pop >= 50 || isRain(hours[j + 1].code) ? 'rain' : 'clear') === kind) j += 1;
    wins.push({ start: hours[i].label, end: j + 1 < hours.length ? hours[j + 1].label : 'конец горизонта', kind });
    i = j + 1;
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <View style={sheetStyles.backdropTouch} onTouchEnd={onClose} />
        <View style={[sheetStyles.card, { backgroundColor: pageColor, borderTopColor: hair }]}>
          <View style={sheetStyles.handle} />
          <Text style={[sheetStyles.title, { color: fg }]}>Ближайшие 12 часов</Text>
          <View style={sheetStyles.windows}>
            {wins.map((w) => (
              <View key={`${w.start}-${w.kind}`} style={[sheetStyles.windowRow, { borderBottomColor: hair }]}>
                <View style={[sheetStyles.windowDot, { backgroundColor: w.kind === 'clear' ? acc : '#3f8fd6' }]} />
                <View style={sheetStyles.flex}>
                  <Text style={[sheetStyles.windowTime, { color: fg }]}>{w.start}–{w.end}</Text>
                  <Text style={[sheetStyles.windowText, { color: dim }]}>
                    {w.kind === 'clear' ? 'ясно — окно для прогулок и моря' : 'дождь — лучше крыша, кофе и музей'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheetStyles.hourRow}>
            {hours.map((h, i) => (
              <View key={`${h.label}-${i}`} style={[sheetStyles.hourChip, { borderColor: hair }]}>
                <Text style={[sheetStyles.hourLabel, { color: dim }]}>{h.label}</Text>
                <Text style={[sheetStyles.hourTemp, { color: fg }]}>{h.temp}°</Text>
                <Text style={[sheetStyles.hourPop, { color: h.pop >= 50 ? '#3f8fd6' : dim }]}>{h.pop}%</Text>
              </View>
            ))}
          </ScrollView>
          <View style={sheetStyles.infoRow}>
            <View style={sheetStyles.flex}>
              <Text style={[sheetStyles.infoLabel, { color: dim }]}>УФ-индекс</Text>
              <Text style={[sheetStyles.infoValue, { color: fg }]}>{snap.uv ?? '—'} · {snap.uv !== undefined ? uvLabel(snap.uv) : ''}</Text>
            </View>
            <View style={sheetStyles.flex}>
              <Text style={[sheetStyles.infoLabel, { color: dim }]}>Ветер</Text>
              <Text style={[sheetStyles.infoValue, { color: fg }]}>{snap.wind} км/ч</Text>
            </View>
            <View style={sheetStyles.flex}>
              <Text style={[sheetStyles.infoLabel, { color: dim }]}>Влажность</Text>
              <Text style={[sheetStyles.infoValue, { color: fg }]}>{snap.humidity}%</Text>
            </View>
            <View style={sheetStyles.flex}>
              <Text style={[sheetStyles.infoLabel, { color: dim }]}>Закат</Text>
              <Text style={[sheetStyles.infoValue, { color: fg }]}>{snap.sunset || '—'}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const stripStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  col: { gap: 2, flexShrink: 1 },
  colRight: { gap: 2, flexShrink: 1, alignItems: 'flex-end' },
  temp: { fontSize: 30, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '700' },
  labelRight: { fontSize: 13, fontWeight: '900', textAlign: 'right' },
  subRight: { fontSize: 11, fontWeight: '700', textAlign: 'right' }
});

const hzStyles = StyleSheet.create({
  tooltip: { position: 'absolute', top: -6, width: 96, borderRadius: 10, backgroundColor: 'rgba(10, 14, 25, 0.72)', paddingHorizontal: 8, paddingVertical: 5, zIndex: 5 },
  tooltipText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  hint: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 }
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(9, 19, 38, 0.36)', justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26, gap: 12, maxHeight: '86%' },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: 'rgba(128, 138, 155, 0.5)' },
  title: { fontSize: 20, fontWeight: '900' },
  windows: { gap: 0 },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  windowDot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  windowTime: { fontSize: 14, fontWeight: '900' },
  windowText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  hourRow: { gap: 8, paddingVertical: 2 },
  hourChip: { width: 64, borderRadius: 14, borderWidth: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  hourLabel: { fontSize: 10, fontWeight: '800' },
  hourTemp: { fontSize: 15, fontWeight: '900' },
  hourPop: { fontSize: 10, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { fontSize: 13, fontWeight: '900', marginTop: 2 }
});
function bucketGreeting(bucket: BucketKey): string {
  switch (bucket) {
    case 'dawn': return 'Рассвет — город просыпается вместе с вами';
    case 'morning': return 'Утро — время пляжа и завтраков на террасе';
    case 'day': return 'День — море рядом, солнце в зените';
    case 'sunset': return 'Закат — мосты скоро засветятся';
    case 'evening': return 'Вечер — город зажигает огни';
    default: return 'Ночь — тихие улицы и тёплый суп';
  }
}

const ADVICE: Record<BucketKey, { clear: string[]; rain: string[] }> = {
  dawn: { clear: ['Рассвет у моря без толп', 'Кофе на набережной', 'Рынок открывается в 6:00'], rain: ['Тёплый фо у рынка', 'Кофейня с видом на дождь', 'Массаж вместо прогулки'] },
  morning: { clear: ['Пляж до полудня', 'Завтрак на террасе', 'Маршруты без толп'], rain: ['Музей Cham рядом', 'Кофе и вьетнамский завтрак', 'Рынок под крышей'] },
  day: { clear: ['Море и кокос у воды', 'Обед с видом на реку', 'Сиеста или СПА'], rain: ['Крыша: кафе и музей', 'Массаж на час-другой', 'Торговый центр у моста'] },
  sunset: { clear: ['Закат на набережной', 'Мост Дракона после 19:00', 'Ужин у реки'], rain: ['Ужин с видом на дождь', 'Кофе и настолки', 'Мост светится и в дождь'] },
  evening: { clear: ['Ночной рынок и стрит-фуд', 'Прогулка по мостам', 'Коктейль на крыше'], rain: ['Стрит-фуд под крышей', 'Массаж и кофе', 'Кафе вместо набережной'] },
  night: { clear: ['Тихие улицы для прогулки', 'Ночной суп у рынка', 'Рассвет скоро — не проспи'], rain: ['Ночной дождь — время супа', 'Кофейня 24/7 рядом', 'Планы на утро без дождя'] }
};

// Рекомендации «время + погода»: заголовок знает про дождь, три бейджа — действия.
export function WeatherAdvice({ bucket, snap, fg, dim, acc, hair }: {
  bucket: BucketKey;
  snap: WeatherSnapshot | null;
  fg: string;
  dim: string;
  acc: string;
  hair: string;
}) {
  if (!snap) return null;
  const rainNow = isRain(snap.code);
    const heading = rainNow
    ? 'Сейчас дождь — крыша рядом: музей, кофе, массаж'
    : snap.turnHour
      ? `До дождя — ${snap.clearHours} ч. ${snap.clearHours >= 3 ? 'Успеете всё.' : 'Действуйте по окнам.'}`
      : snap.clearHours === 0
        ? 'Небо закрыто — гуляем без пляжа'
        : bucketGreeting(bucket);
  const set = ADVICE[bucket][rainNow || snap.clearHours <= 1 ? 'rain' : 'clear'];
  return (
    <View style={[advStyles.wrap, { borderBottomColor: hair }]}>
      <Text style={[advStyles.heading, { color: fg }]}>{heading}</Text>
      <View style={advStyles.row}>
        {set.map((item) => (
          <View key={item} style={[advStyles.badge, { borderColor: hair }]}>
            <View style={[advStyles.dot, { backgroundColor: acc }]} />
            <Text style={[advStyles.badgeText, { color: dim }]} numberOfLines={3}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const advStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1 },
  heading: { fontSize: 15, fontWeight: '900', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8 },
  badge: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  badgeText: { flex: 1, fontSize: 11, fontWeight: '800', lineHeight: 14 }
});
// Живая шапка вместо фото: небо от часов + силуэт города и моста + вода.
const SKY_IMAGES: Record<BucketKey, { uri: string }> = {
  dawn: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/10e61bfee-72df-46ff-9708-d329ff9c7f02.png' },
  morning: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/184f2c3d2-5e88-4c37-a2ba-ea22501ded8b.png' },
  day: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/1a070af71-2208-4691-8f84-85e88c8bc7e5.png' },
  sunset: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/10cd544f7-62a3-4fdc-a7f9-962bb711ca31.png' },
  evening: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/1439ba354-4248-4601-87fa-7de3bb9b20d2.png' },
  night: { uri: 'https://image.qwenlm.ai/public_source/00e99707-b25b-4ced-8044-aeabf8a6ea09/1b5599f9f-465e-404f-a198-55245fdf11bc.png' }
};

function classifySnap(snap: WeatherSnapshot | null): 'clear' | 'clouds' | 'rain' | 'heat' {
  if (!snap) return 'clear';
  if (isRain(snap.code) || (snap.hours[0] && snap.hours[0].pop >= 60)) return 'rain';
  if (snap.temp >= 35) return 'heat';
  if ((snap.code >= 2 && snap.code <= 3) || snap.code === 45 || snap.code === 48) return 'clouds';
  return 'clear';
}

function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 3) return 'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L');
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// Живая шапка 2.2: цельное небо по времени суток, вуаль по погоде,
// погода и горизонт — поверх неба, растворение в цвет страницы.
export function LivingHeader({ bucket, snap, pageColor, topInset = 0, onOpen }: {
  bucket: BucketKey;
  snap: WeatherSnapshot | null;
  pageColor: string;
  topInset?: number;
  onOpen: () => void;
}) {
  const sky = SKY[bucket];
  const kind = classifySnap(snap);
  const reduce = useReduceMotion();
  const rainAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (kind !== 'rain' || reduce) return undefined;
    const loop = Animated.loop(Animated.timing(rainAnim, { toValue: 1, duration: 900, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [kind, reduce]);
  const rainShift = rainAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] });

  const dn = new Date(Date.now() + 7 * 3600 * 1000);
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  const cityTime = `дананг · ${pad(dn.getUTCHours())}:${pad(dn.getUTCMinutes())}`;
  const upd = snap ? `погода в ${pad(new Date(snap.fetchedAt).getHours())}:${pad(new Date(snap.fetchedAt).getMinutes())}` : 'нет сети — только время';

  const hours = snap?.hours ?? [];
  const raining = kind === 'rain';
  const breakIndex = raining
    ? hours.findIndex((h) => h.pop < 35 && !isRain(h.code))
    : snap && snap.clearHours < 12
      ? snap.clearHours
      : -1;
  const ringNum = snap ? (raining ? (breakIndex >= 0 ? hours[breakIndex].label : '…') : `${snap.clearHours}ч`) : '';
  const keyText = !snap
    ? ''
    : raining
      ? 'дождь стихнет — окно на карте'
      : kind === 'heat'
        ? `УФ ${snap.uv ?? 9} — тень 11–15`
        : `ясно ещё ${snap.clearHours} ч`;

  const W = 340;
  const H = 96;
  const base = H - 20;
  const top = 12;
  const xs = (k: number) => 8 + k * ((W - 16) / 11);
  const temps = hours.map((h) => h.temp);
  const mn = Math.min(...temps);
  const mx = Math.max(...temps);
  const ys = (t: number) => top + ((mx - t) / (mx - mn || 1)) * (base - 30 - top) + 2;
  const pts: Array<[number, number]> = hours.map((h, k) => [xs(k), ys(h.temp)]);
  const line = hours.length > 1 ? smoothPath(pts) : '';
  const area = line ? `${line} L${xs(hours.length - 1).toFixed(1)},${base} L${xs(0).toFixed(1)},${base} Z` : '';
  const zones: Array<{ x: number; w: number }> = [];
  let run = 0;
  hours.forEach((h, i) => {
    if (h.pop >= 50) run += 1;
    else if (run > 0) {
      zones.push({ x: xs(i - run) - 4, w: xs(i - 1) - xs(i - run) + 8 });
      run = 0;
    }
  });
  if (run > 0) zones.push({ x: xs(hours.length - run) - 4, w: xs(hours.length - 1) - xs(hours.length - run) + 8 });

  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const moveRef = useRef(0);
  const updateScrub = (x: number) => {
    if (width <= 0 || hours.length < 2) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    setScrub(Math.round(ratio * (hours.length - 1)));
  };

  const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 };
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[sky.top, sky.mid, sky.bottom]} style={StyleSheet.absoluteFill} />
      <Image source={SKY_IMAGES[bucket]} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {kind === 'clouds' ? (
        <LinearGradient colors={['rgba(122,136,152,0.55)', 'rgba(122,136,152,0.28)', 'rgba(122,136,152,0.06)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
      ) : null}
      {raining ? (
        <>
          <LinearGradient colors={['rgba(52,66,82,0.6)', 'rgba(52,66,82,0.34)', 'rgba(52,66,82,0.12)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,22,32,0.16)' }]} />
        </>
      ) : null}
      {kind === 'heat' ? (
        <LinearGradient colors={['rgba(255,240,200,0.6)', 'rgba(255,214,140,0.16)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
      ) : null}
      {raining ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: rainShift }] }]}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
            {[36, 78, 120, 162, 204, 246, 288, 330].map((x, i) => (
              <Line key={x} x1={x} y1={60 + (i % 4) * 42} x2={x - 7} y2={76 + (i % 4) * 42} stroke="rgba(208,224,240,0.6)" strokeWidth={1.6} strokeLinecap="round" />
            ))}
          </Svg>
        </Animated.View>
      ) : null}

      <View style={{ paddingTop: topInset + 12, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 70 }}>
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700', letterSpacing: 2.4, ...shadow }}>{cityTime}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10.5, letterSpacing: 1.2, ...shadow }}>{upd}</Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 34 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 54, fontWeight: '600', fontStyle: 'italic', lineHeight: 54, ...shadow }}>
              {snap ? `${snap.temp}°` : '—'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 19, fontStyle: 'italic', fontWeight: '600', marginTop: 2, ...shadow }}>
              {snap ? weatherLabel(snap.code).toLowerCase() : 'нет прогноза'}
            </Text>
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 0.6, marginTop: 8, ...shadow }}>
              ощущается {snap?.temp ?? 0}° · ветер {snap?.wind ?? 0} км/ч
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View style={{ width: 76, height: 76 }}>
              <Svg width={76} height={76} viewBox="0 0 76 76">
                <Circle cx={38} cy={38} r={30} stroke="rgba(255,255,255,0.25)" strokeWidth={5} fill="none" />
                {raining ? <Circle cx={38} cy={38} r={30} stroke="rgba(74,143,212,0.8)" strokeWidth={5} fill="none" opacity={0.9} /> : null}
                <Circle
                  cx={38}
                  cy={38}
                  r={30}
                  stroke="#f0a35c"
                  strokeWidth={5}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30 * (Math.min(12, snap?.clearHours ?? 0) / 12)} ${2 * Math.PI * 30}`}
                  transform="rotate(-90 38 38)"
                />
              </Svg>
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', fontStyle: 'italic', ...shadow }}>{ringNum}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1, textAlign: 'right', maxWidth: 120, ...shadow }}>{keyText}</Text>
          </View>
        </View>

        {hours.length > 1 ? (
          <View
            style={{ marginTop: 12 }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              moveRef.current = 0;
              updateScrub(e.nativeEvent.locationX);
            }}
            onResponderMove={(e) => {
              moveRef.current += Math.abs((e.nativeEvent as any).dx || 0) + Math.abs((e.nativeEvent as any).dy || 0);
              updateScrub(e.nativeEvent.locationX);
            }}
            onResponderRelease={() => {
              if (moveRef.current < 8) onOpen();
              setScrub(null);
            }}
          >
            {scrub !== null ? (
              <View style={{ position: 'absolute', top: -12, left: Math.max(0, Math.min(width - 110, (scrub / (hours.length - 1)) * (width - 110))), backgroundColor: 'rgba(9,14,20,0.85)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, zIndex: 5 }}>
                <Text style={{ color: '#ffffff', fontSize: 10.5 }}>
                  <Text style={{ color: '#f0a35c', fontWeight: '700' }}>{hours[scrub].label}</Text> · {hours[scrub].temp}° · {hours[scrub].pop}%
                </Text>
              </View>
            ) : null}
            <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#f0a35c" stopOpacity={0.22} />
                  <Stop offset="1" stopColor="#f0a35c" stopOpacity={0} />
                </SvgLinearGradient>
                <SvgLinearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#f0a35c" />
                  <Stop offset="1" stopColor="#ffd08a" />
                </SvgLinearGradient>
              </Defs>
              {zones.map((z, i) => (
                <Rect key={`z-${i}`} x={z.x} y={top} width={z.w} height={base - top} rx={4} fill="rgba(74,143,212,0.14)" />
              ))}
              {hours.map((h, i) =>
                h.pop > 0 ? <Rect key={`b-${i}`} x={xs(i) - 2.5} y={base - (h.pop / 100) * 24} width={5} height={(h.pop / 100) * 24} rx={2.5} fill="rgba(96,158,224,0.9)" /> : null
              )}
              <Path d={area} fill="url(#ag)" />
              <Path d={line} fill="none" stroke="url(#lg)" strokeWidth={2} strokeLinecap="round" />
              {breakIndex >= 0 && breakIndex < hours.length ? (
                <>
                  <Line x1={xs(breakIndex)} y1={top - 4} x2={xs(breakIndex)} y2={base} stroke="#f0a35c" strokeWidth={1} strokeDasharray="3 4" opacity={0.9} />
                  <SvgText x={xs(breakIndex)} y={top - 7} fontSize={9} fill="#f0a35c" textAnchor="middle" letterSpacing={1}>
                    {raining ? 'стихнет' : 'сломается'}
                  </SvgText>
                </>
              ) : null}
              <Line x1={xs(0)} y1={top} x2={xs(0)} y2={base} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
              <Circle cx={xs(0)} cy={ys(hours[0].temp)} r={6} fill="#f0a35c" opacity={0.22} />
              <Circle cx={xs(0)} cy={ys(hours[0].temp)} r={3.2} fill="#f0a35c" />
              {[0, 3, 6, 9].map((k) =>
                k < hours.length ? (
                  <SvgText key={`t-${k}`} x={xs(k)} y={H - 4} fontSize={9.5} letterSpacing={1} fill="rgba(255,255,255,0.7)" textAnchor={k === 0 ? 'start' : 'middle'}>
                    {hours[k].label.slice(0, 2)}:00
                  </SvgText>
                ) : null
              )}
            </Svg>
            <Text style={{ textAlign: 'center', fontSize: 10.5, letterSpacing: 1.6, color: 'rgba(255,255,255,0.7)', marginTop: 4, ...shadow }}>
              веди по горизонту — часы · тап — прогноз
            </Text>
          </View>
        ) : null}
      </View>

      <LinearGradient colors={[pageColor + '00', pageColor]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }} pointerEvents="none" />
    </View>
  );
}