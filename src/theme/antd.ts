import type { ThemeConfig } from 'antd';
import roRO from 'antd/locale/ro_RO';
import enGB from 'antd/locale/en_GB';
import ruRU from 'antd/locale/ru_RU';
import type { Lang } from '../lib/types';

/**
 * CareBridge × Ant Design theme.
 * Păstrează identitatea vizuală existentă (petrol + soare) dar o exprimă
 * prin design-token-ii Ant Design, ca tot UI-ul să arate enterprise, consistent.
 */
export const carebridgeTheme: ThemeConfig = {
  token: {
    colorPrimary: '#164b56',
    colorInfo: '#2a7886',
    colorSuccess: '#3a8a4b',
    colorWarning: '#b26f0f',
    colorError: '#c23b2c',
    colorLink: '#1c5e6b',

    colorBgLayout: '#f1f4f3',
    colorBgContainer: '#ffffff',
    colorBorder: '#d6dedd',
    colorText: '#13222a',
    colorTextSecondary: '#485a61',
    colorTextTertiary: '#74868c',

    fontFamily: "'Onest Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 19,

    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 8,

    controlHeight: 40,
    controlHeightSM: 32,
    controlHeightLG: 46,

    boxShadow: '0 1px 2px rgb(13 45 52 / 0.05), 0 10px 28px -16px rgb(13 45 52 / 0.18)',
    boxShadowSecondary: '0 2px 6px rgb(13 45 52 / 0.08), 0 24px 48px -20px rgb(13 45 52 / 0.35)',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 42,
      controlHeightSM: 32,
      fontWeight: 600,
      primaryShadow: '0 6px 16px -8px rgb(22 75 86 / 0.55)',
    },
    Card: {
      borderRadiusLG: 18,
      boxShadowTertiary: '0 1px 2px rgb(13 45 52 / 0.05), 0 10px 28px -16px rgb(13 45 52 / 0.18)',
    },
    Tag: {
      borderRadiusSM: 999,
      fontSizeSM: 12,
    },
    Modal: {
      borderRadiusLG: 18,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 42,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 42,
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: '#ffffff',
      darkItemSelectedColor: '#0d2d34',
      darkItemColor: 'rgba(210, 229, 232, 0.85)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemHoverColor: '#ffffff',
      itemBorderRadius: 12,
      itemMarginInline: 0,
    },
    Layout: {
      siderBg: '#0d2d34',
      headerBg: '#0d2d34',
      bodyBg: '#f1f4f3',
    },
    Segmented: {
      borderRadius: 12,
    },
    Statistic: {
      titleFontSize: 14,
      contentFontSize: 28,
    },
  },
};

export function antdLocale(lang: Lang) {
  return lang === 'ru' ? ruRU : lang === 'en' ? enGB : roRO;
}

/** Culoarea accent „soare" — folosită punctual (marker „acum", badge-uri count). */
export const SUN = '#e9a23b';
export const SUN_DARK = '#c9831f';
