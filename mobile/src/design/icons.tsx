import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { color } from './tokens';

interface IProps { size?: number; stroke?: string; }

const base = (size = 20) => ({
  width: size, height: size, viewBox: '0 0 24 24',
});

export const ArrowBack = ({ size = 20, stroke = color.warm60 }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M11 5.5L4.5 12l6.5 6.5M4.8 12h15" stroke={stroke} strokeWidth={1.8}
      fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Фильтр — линии разной длины с ползунками.
 * В активном состоянии ползунки стоят в других позициях:
 * иконка показывает, что регуляторы двигали, а не просто подсвечивается.
 */
export const Sliders = ({ size = 20, stroke = color.warm40, active = false }: IProps & { active?: boolean }) => {
  const rows = active
    ? [{ a: 'M4 7h4.4M12.6 7H20', cx: 10 }, { a: 'M4 12h9.4M17.6 12H20', cx: 15 }, { a: 'M4 17h2.4M10.6 17H20', cx: 8 }]
    : [{ a: 'M4 7h8M17.5 7H20', cx: 14.8 }, { a: 'M4 12h3.4M12.6 12H20', cx: 10 }, { a: 'M4 17h10.4M19.6 17H20', cx: 17 }];
  const y = [7, 12, 17];
  return (
    <Svg {...base(size)}>
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          <Path d={r.a} stroke={stroke} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Circle cx={r.cx} cy={y[i]} r={2.1} stroke={stroke} strokeWidth={1.8} fill="none" />
        </React.Fragment>
      ))}
    </Svg>
  );
};

export const Check = ({ size = 12, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M4.5 12.5l5 5 10-11" stroke={stroke} strokeWidth={3.2} fill="none"
      strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Navigate = ({ size = 19, stroke = color.onAmber }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M12 20V6M12 4.5l6.5 6.5M12 4.5L5.5 11" stroke={stroke} strokeWidth={2.3}
      fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Bookmark = ({ size = 20, stroke = color.warm, filled = false }: IProps & { filled?: boolean }) => (
  <Svg {...base(size)}>
    <Path d="M7 4h10v16l-5-4-5 4z" stroke={stroke} strokeWidth={1.7}
      fill={filled ? stroke : 'none'} strokeLinejoin="round" />
  </Svg>
);

export const Share = ({ size = 21, stroke = color.warm60 }: IProps) => (
  <Svg {...base(size)}>
    <Circle cx={18} cy={5.5} r={2.3} stroke={stroke} strokeWidth={1.8} fill="none" />
    <Circle cx={6} cy={12} r={2.3} stroke={stroke} strokeWidth={1.8} fill="none" />
    <Circle cx={18} cy={18.5} r={2.3} stroke={stroke} strokeWidth={1.8} fill="none" />
    <Path d="M8.2 13.2l7.6 4.2M15.8 6.6l-7.6 4.2" stroke={stroke} strokeWidth={1.8} fill="none" strokeLinecap="round" />
  </Svg>
);

/** Атрибуты места. Тонкий штрих, золото — они информация, а не управление. */
export const Breakfast = ({ size = 15, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M3.5 17h17M6 17a6 6 0 0112 0M12 4.5v2M6.2 7.2l1.4 1.4M17.8 7.2l-1.4 1.4"
      stroke={stroke} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Quiet = ({ size = 15, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M5 19c0-8 5.5-12 14-12 0 8.5-5.5 12-14 12zM5 19c2.5-4 6-6.5 10-8"
      stroke={stroke} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Vegan = ({ size = 15, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M12 20v-7M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 15.5c0-3-2.4-5-5.5-5 0 3 2.4 5 5.5 5z"
      stroke={stroke} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const Paw = ({ size = 15, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Path d="M12 19.5c-2.9 0-4.8-1.5-4.8-3.3 0-2 2.1-3.8 4.8-3.8s4.8 1.8 4.8 3.8c0 1.8-1.9 3.3-4.8 3.3z"
      stroke={stroke} strokeWidth={1.7} fill="none" strokeLinejoin="round" />
    <Circle cx={5.8} cy={9.6} r={1.7} stroke={stroke} strokeWidth={1.7} fill="none" />
    <Circle cx={9.8} cy={6.6} r={1.7} stroke={stroke} strokeWidth={1.7} fill="none" />
    <Circle cx={14.2} cy={6.6} r={1.7} stroke={stroke} strokeWidth={1.7} fill="none" />
    <Circle cx={18.2} cy={9.6} r={1.7} stroke={stroke} strokeWidth={1.7} fill="none" />
  </Svg>
);

export const Child = ({ size = 15, stroke = color.gold }: IProps) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={7} r={2.7} stroke={stroke} strokeWidth={1.7} fill="none" />
    <Path d="M6.8 19.5c0-3.4 2.3-5.7 5.2-5.7s5.2 2.3 5.2 5.7"
      stroke={stroke} strokeWidth={1.7} fill="none" strokeLinecap="round" />
  </Svg>
);
