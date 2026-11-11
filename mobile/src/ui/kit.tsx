// Small building blocks shared by every screen.

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { font, tint, useTheme } from './theme';

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'strong' | 'small' | 'eyebrow' | 'num';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontFamily: font.serif, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 },
  h2: { fontFamily: font.serif, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: font.bold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: font.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  num: { fontFamily: font.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.4 },
};

interface TProps {
  v?: Variant;
  muted?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  heading?: boolean;
}

/** Themed text. */
export function T({ v = 'body', muted, center, style, children, numberOfLines, heading }: TProps) {
  const t = useTheme();
  const quiet = muted ?? (v === 'small' || v === 'eyebrow');
  return (
    <Text
      accessibilityRole={heading || v === 'title' || v === 'h2' ? 'header' : undefined}
      numberOfLines={numberOfLines}
      style={[VARIANTS[v], { color: quiet ? t.ink2 : t.ink }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

/** A scrolling page with safe-area padding. */
export function Screen({ children, bottom }: { children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.page }}>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 18,
          paddingBottom: bottom ? 24 : insets.bottom + 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {bottom && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.border,
            backgroundColor: t.page,
          }}
        >
          {bottom}
        </View>
      )}
    </View>
  );
}

export function Card({ children, style, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.surface, borderWidth: 1, borderColor: strong ? t.btn : t.border, borderRadius: 14, padding: 16, gap: 10 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

interface BtnProps {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  iconAfter?: string;
  disabled?: boolean;
  busy?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Btn({ label, onPress, kind = 'primary', icon, iconAfter, disabled, busy, large, style }: BtnProps) {
  const t = useTheme();
  const color = kind === 'primary' ? t.btnInk : kind === 'danger' ? t.criticalInk : kind === 'ghost' ? t.ink2 : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: large ? 52 : 44,
          paddingHorizontal: large ? 26 : 18,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: kind === 'secondary' || kind === 'danger' ? t.borderStrong : 'transparent',
          backgroundColor: kind === 'primary' ? t.btn : kind === 'secondary' ? t.surface : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} size={large ? 18 : 16} color={color} /> : null}
      <Text style={{ fontFamily: font.bold, fontSize: large ? 16 : 15, color }}>{label}</Text>
      {iconAfter && <Icon name={iconAfter} size={16} color={color} />}
    </Pressable>
  );
}

/** A selectable pill. Used in single-choice groups. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? t.btn : t.borderStrong,
        backgroundColor: selected ? t.btn : t.surface,
      }}
    >
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: selected ? t.btnInk : t.ink2 }}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, icon }: { label: string; icon?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.surface2 }}>
      {icon && <Icon name={icon} size={12} color={t.ink2} />}
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: t.ink2 }}>{label}</Text>
    </View>
  );
}

const STATUS_ICON = { good: 'check', ok: 'check', warn: 'minus', bad: 'x' } as const;

/** Status is never colour alone: an icon and a word always travel with it. */
export function Status({ level, label }: { level: 'good' | 'ok' | 'warn' | 'bad'; label: string }) {
  const t = useTheme();
  const background = level === 'good' ? t.good : level === 'ok' ? t.accent : level === 'warn' ? t.warning : t.critical;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
        <Icon name={STATUS_ICON[level]} size={12} strokeWidth={3} color={level === 'warn' ? '#0b0b0b' : '#ffffff'} />
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.ink }}>{label}</Text>
    </View>
  );
}

export function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 14, gap: 1 }}>
      <T v="small">{label}</T>
      <Text style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.4, color: t.ink }}>
        {value}
        {unit ? <Text style={{ fontFamily: font.medium, fontSize: 14, letterSpacing: 0, color: t.ink2 }}> {unit}</Text> : null}
      </Text>
      {sub && <T v="small">{sub}</T>}
    </View>
  );
}

export function Notice({ text, error }: { text: string; error?: boolean }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: error ? tint(t.critical, 0.4) : t.border,
        backgroundColor: error ? tint(t.critical, 0.08) : t.surface2,
      }}
    >
      <View style={{ marginTop: 2 }}>
        <Icon name={error ? 'alert' : 'info'} size={16} color={error ? t.criticalInk : t.ink2} />
      </View>
      <Text style={{ flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: error ? t.ink : t.ink2 }}>{text}</Text>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.border }} />;
}

/** A section heading with an optional line of explanation. */
export function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 12, gap: 2 }}>
      <T v="h2">{title}</T>
      {sub && <T v="small">{sub}</T>}
    </View>
  );
}

/** A tappable card for choosing something to practise. */
export function Option({ icon, title, text, foot, onPress }: { icon?: string; title: string; text: string; foot?: ReactNode; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: pressed ? t.borderStrong : t.border,
        borderRadius: 14,
        padding: 16,
        gap: 6,
      })}
    >
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>
        {icon && (
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2 }}>
            <Icon name={icon} size={18} color={t.ink} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <T v="h3">{title}</T>
          <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
            {text}
          </T>
          {foot && <Row style={{ marginTop: 6 }}>{foot}</Row>}
        </View>
        <View style={{ marginTop: 8 }}>
          <Icon name="chevron-right" size={18} color={t.muted} />
        </View>
      </Row>
    </Pressable>
  );
}
