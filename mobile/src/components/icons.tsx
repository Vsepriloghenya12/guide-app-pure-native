import { Text } from 'react-native';
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { RouteStep, TravelMode } from '../utils/directions';

export function WalkIcon({ size = 16, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={4.3} r={2.1} fill={color} stroke="none" />
      <Path d="M12 7.4v5.2" /> <Path d="M12 9.2l-3 1.9" /> <Path d="M12 9.2l3 1.3" /> <Path d="M12 12.6l-2.4 6" /> <Path d="M12 12.6l2.4 6" />
    </Svg>
  );
}

export function ScooterIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={6} cy={17} r={3} /> <Circle cx={18.5} cy={17} r={3} />
      <Path d="M9 17h4.8l2.4-6H19" /> <Path d="M11.2 11h3.6" /> <Path d="M6 17l3-6" />
    </Svg>
  );
}

export function BikeIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={5.6} cy={16.6} r={3.3} /> <Circle cx={18.4} cy={16.6} r={3.3} />
      <Path d="M5.6 16.6l4.2-7.2h4.4" /> <Path d="M9.8 9.4l4.4 7.2" /> <Path d="M8.3 9.4h3" />
    </Svg>
  );
}

export function TaxiIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.4 12.4l1.5-3.7A2 2 0 0 1 7.8 7.4h8.4a2 2 0 0 1 1.9 1.3l1.5 3.7" />
      <Path d="M3.6 12.4h16.8v3a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1z" />
      <Circle cx={7} cy={17} r={1.3} fill={color} stroke="none" /> <Circle cx={17} cy={17} r={1.3} fill={color} stroke="none" />
      <Path d="M9.8 7.4V5.6h4.4v1.8" />
    </Svg>
  );
}

export function TravelModeIcon({ mode, size = 22, color = '#8493a8' }: { mode: TravelMode; size?: number; color?: string }) {
  if (mode === 'walk') return <WalkIcon size={size} color={color} />;
  if (mode === 'scooter') return <ScooterIcon size={size} color={color} />;
  if (mode === 'bike') return <BikeIcon size={size} color={color} />;
  return <TaxiIcon size={size} color={color} />;
}

export function TrafficIcon({ active = false, size = 20 }: { active?: boolean; size?: number }) {
  const color = active ? '#1f63c7' : '#8493a8';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M8 3.5h8v17H8z" />
      <Circle cx={12} cy={7.5} r={1.7} fill="#e05a3f" stroke="none" />
      <Circle cx={12} cy={12} r={1.7} fill="#f5a623" stroke="none" />
      <Circle cx={12} cy={16.5} r={1.7} fill="#22a06b" stroke="none" />
    </Svg>
  );
}

export function CloseIcon({ size = 16, color = '#20304c' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function CompassIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#c7d2e0" strokeWidth={1.5} />
      <Path d="M12 5.5 15 12.5 9 12.5Z" fill="#e05a3f" />
      <Path d="M12 18.5 15 12.5 9 12.5Z" fill="#94a1b4" />
    </Svg>
  );
}

export function LocateIcon({ size = 22, color = '#1f63c7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <Circle cx={12} cy={12} r={1.3} fill={color} stroke="none" />
    </Svg>
  );
}

export function ZoomGlyph({ minus = false, size = 20 }: { minus?: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#35507a" strokeWidth={2.2} strokeLinecap="round">
      {minus ? <Path d="M6 12h12" /> : <Path d="M12 6v12M6 12h12" />}
    </Svg>
  );
}

export function SendIcon({ size = 17, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11l18-8-8 18-2-8-8-2z" />
    </Svg>
  );
}

export function ShareIcon({ size = 19, color = '#35507a' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={6} cy={12} r={2.4} /> <Circle cx={17} cy={6} r={2.4} /> <Circle cx={17} cy={18} r={2.4} />
      <Path d="M8.1 10.9 14.9 7.2M8.1 13.1 14.9 16.8" />
    </Svg>
  );
}

export function ForkIcon({ size = 20, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3v6a2 2 0 0 0 4 0V3" /> <Path d="M8 9v12" />
      <Path d="M16.5 3c-1.4 0-2.5 2-2.5 4.5s1.1 4 2.5 4" /> <Path d="M16.5 3v18" />
    </Svg>
  );
}

export function StarIcon({ size = 14, color = '#f5a623' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3.4l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.2 19.6l1-5.8L2.9 9.6l5.9-.9z" />
    </Svg>
  );
}

export function ClockIcon({ size = 17, color = '#e08a1e' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7.2v5l3.4 2" />
      <Path d="M12 3.4v1.3M20.6 12h-1.3M12 20.6v-1.3M3.4 12h1.3" />
    </Svg>
  );
}

export function PinIcon({ size = 17, color = '#e05a3f', strokeWidth = 1.5 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21.5c4-4 6.5-7 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14.5 8 17.5 12 21.5z" />
      <Circle cx={12} cy={10.8} r={2.4} />
    </Svg>
  );
}

export function CoffeeIcon({ size = 17, color = '#1f63c7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.4 13.8a3.4 3.4 0 0 1-.5-6.75 4.1 4.1 0 0 1 7.95-1.3A3.5 3.5 0 0 1 17.6 13.8z" />
      <Path d="M7 13.8h10v5a1.1 1.1 0 0 1-1.1 1.1H8.1A1.1 1.1 0 0 1 7 18.8z" />
      <Path d="M10 14v3.2M14 14v3.2" />
    </Svg>
  );
}

export function BanknoteIcon({ size = 17, color = '#1f9d63' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8.5h13a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5h9.5v4" />
      <Circle cx={16.2} cy={14} r={1.1} />
    </Svg>
  );
}

export function HeartIcon({ size = 19, color = '#e05a3f', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20s-7-4.7-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.3-7 10-7 10z" />
    </Svg>
  );
}

export function ChevronGlyph() {
  return <Text style={{ color: '#c2ccda', fontWeight: '800', fontSize: 15 }}>›</Text>;
}

export function StepManeuverIcon({ maneuver, size = 19 }: { maneuver: RouteStep['maneuver']; size?: number }) {
  if (maneuver === 'right') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 19v-6.3a3 3 0 0 1 3-3h5.2" /> <Path d="M13.6 6l4 3.7-4 3.7" />
      </Svg>
    );
  }
  if (maneuver === 'left') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 19v-6.3a3 3 0 0 0-3-3H7.8" /> <Path d="M10.4 6l-4 3.7 4 3.7" />
      </Svg>
    );
  }
  if (maneuver === 'finish') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e05a3f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M7 20V4.4" /> <Path d="M7 5.4h9l-2.2 3 2.2 3H7" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 19V6" /> <Path d="M7.6 10.4L12 6l4.4 4.4" />
    </Svg>
  );
}