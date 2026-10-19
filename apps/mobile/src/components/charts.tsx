import type { Candle } from '@pek/shared';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

function scale(values: number[], baseline: number | undefined, height: number, pad = 2) {
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const span = max - min || 1;
  return (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
}

/** Tiny trend line coloured against the previous close (or first point). */
export function Sparkline({ candles, baseline, width = 120, height = 36 }: { candles: Candle[]; baseline?: number; width?: number; height?: number }) {
  const theme = useTheme();
  if (candles.length < 2) return <View style={{ width, height }} />;
  const closes = candles.map((c) => c.close);
  const y = scale(closes, baseline, height);
  const points = closes.map((v, i) => `${((i / (closes.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = closes[closes.length - 1] >= (baseline ?? closes[0]);
  return (
    <Svg width={width} height={height}>
      {baseline != null && (
        <Line x1={0} x2={width} y1={y(baseline)} y2={y(baseline)} stroke={theme.textSecondary} strokeWidth={0.75} strokeDasharray="3 3" />
      )}
      <Polyline points={points} fill="none" stroke={up ? theme.up : theme.down} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

/** Full-width area chart for the stock screen. */
export function AreaChart({ candles, baseline, height = 220 }: { candles: Candle[]; baseline?: number; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (candles.length < 2 || width === 0) return <View style={{ height }} onLayout={onLayout} />;
  const closes = candles.map((c) => c.close);
  const y = scale(closes, baseline, height, 8);
  const x = (i: number) => (i / (closes.length - 1)) * width;
  const line = closes.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const up = closes[closes.length - 1] >= (baseline ?? closes[0]);
  const color = up ? theme.up : theme.down;

  return (
    <View onLayout={onLayout} accessibilityLabel={`Price chart, ${up ? 'up' : 'down'} over this range`}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#fill)" />
        {baseline != null && (
          <Line x1={0} x2={width} y1={y(baseline)} y2={y(baseline)} stroke={theme.textSecondary} strokeWidth={1} strokeDasharray="4 4" />
        )}
        <Path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
