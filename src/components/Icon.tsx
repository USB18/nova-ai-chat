import React, { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * SVG icon set (24×24 grid, 2px round strokes). Use these instead of emoji or
 * Unicode glyphs so icons render identically on every platform and follow the theme.
 */
const ICON_SHAPES = {
  plus: <Path d="M12 5v14M5 12h14" />,
  mic: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  stop: <Rect x={6} y={6} width={12} height={12} rx={2} fill="currentColor" />,
  arrowUp: <Path d="M12 19V5M5 12l7-7 7 7" />,
  image: (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Path d="M21 15l-5-5L5 21" />
    </>
  ),
  camera: (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </>
  ),
  video: (
    <>
      <Rect x={2} y={6} width={14} height={12} rx={2} />
      <Path d="M16 10l6-4v12l-6-4z" />
    </>
  ),
  play: <Path d="M7 4l13 8-13 8z" fill="currentColor" />,
  close: <Path d="M18 6L6 18M6 6l12 12" />,
  chevronDown: <Path d="M6 9l6 6 6-6" />,
  chevronUp: <Path d="M18 15l-6-6-6 6" />,
  chevronRight: <Path d="M9 6l6 6-6 6" />,
  refresh: <Path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" />,
  alert: (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8v4M12 16h.01" />
    </>
  ),
  check: (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M8 12l3 3 5-6" />
    </>
  ),
  tick: <Path d="M20 6L9 17l-5-5" />,
  settings: (
    <>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  sparkles: (
    <>
      <Path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0l1.58 6.13a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z" />
      <Path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </>
  ),
  key: (
    <>
      <Path d="M2.59 17.41A2 2 0 0 0 2 18.83V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.17a2 2 0 0 0 1.42-.59l.81-.81a6.5 6.5 0 1 0-4-4z" />
      <Circle cx={16.5} cy={7.5} r={0.5} fill="currentColor" />
    </>
  ),
  lock: (
    <>
      <Rect x={3} y={11} width={18} height={11} rx={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  cpu: (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={2} />
      <Rect x={9} y={9} width={6} height={6} rx={1} />
      <Path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </>
  ),
  sliders: (
    <Path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 16v-4M12 8h.01" />
    </>
  ),
};

export type IconName = keyof typeof ICON_SHAPES;

function IconImpl({
  name,
  size = 20,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_SHAPES[name]}
    </Svg>
  );
}

export const Icon = memo(IconImpl);
