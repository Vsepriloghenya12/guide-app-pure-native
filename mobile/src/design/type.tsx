import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
// по-весовые входы вместо корня пакета: корневой index.js тянет require() на все
// начертания семейства (~0.9 МБ лишних ttf в бандле), сабпат — только нужный файл
import { Prata_400Regular } from '@expo-google-fonts/prata';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { color, text } from './tokens';

export function useDesignFonts() {
  const [loaded, error] = useFonts({
    Prata_400Regular,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Manrope_500Medium,
  });
  // при ошибке загрузки приложение стартует на системных шрифтах, а не висит на пустом экране
  return loaded || Boolean(error);
}

type Preset = keyof typeof text;

interface TProps extends TextProps {
  preset?: Preset;
  tone?: 'warm' | 'warm60' | 'warm40' | 'gold' | 'amber' | 'open' | 'soon' | 'ink';
  /** Тень для текста, лежащего прямо на фотографии, без подложки */
  onPhoto?: boolean;
}

const tones = {
  warm: color.warm,
  warm60: color.warm60,
  warm40: color.warm40,
  gold: color.gold,
  amber: color.amber,
  open: color.open,
  soon: color.soon,
  ink: color.onAmber,
};

export function T({ preset = 'body', tone = 'warm', onPhoto, style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[
        text[preset],
        { color: tones[tone] },
        onPhoto && styles.onPhoto,
        preset === 'micro' && styles.upper,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  onPhoto: {
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  upper: { textTransform: 'uppercase' },
});
