import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar as AntAvatar, Badge as AntBadge, Button, Drawer, Dropdown, Flex, Layout as AntLayout, Menu, Space, Typography } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  DashboardOutlined,
  HeartOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  ScheduleOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useI18n, type TKey } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LogoMark, Wordmark } from './Logo';
import { Avatar } from './ui';

const { Sider, Header, Content } = AntLayout;

interface NavItem {
  key: string;
  to: string;
  label: TKey;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: 'notifications' | 'messages';
}

const NAV: NavItem[] = [
  { key: '/', to: '/', label: 'nav.dashboard', icon: <DashboardOutlined /> },
  { key: '/elders', to: '/elders', label: 'nav.elders', icon: <HeartOutlined /> },
  { key: '/planner', to: '/planner', label: 'nav.planner', icon: <ScheduleOutlined /> },
  { key: '/events', to: '/events', label: 'nav.events', icon: <CalendarOutlined /> },
  { key: '/messages', to: '/messages', label: 'nav.messages', icon: <MessageOutlined />, badge: 'messages' },
  { key: '/notifications', to: '/notifications', label: 'nav.notifications', icon: <BellOutlined />, badge: 'notifications' },
  { key: '/admin', to: '/admin', label: 'nav.admin', icon: <SettingOutlined />, adminOnly: true },
];

function activeKey(pathname: string): string {
  if (pathname === '/') return '/';
  const hit = NAV.filter((n) => n.key !== '/').find((n) => pathname === n.key || pathname.startsWith(`${n.key}/`));
  return hit?.key ?? '/';
}

export function Layout() {
  const { profile, signOut, isAdmin } = useAuth();
  const { unread, unreadMessages } = useNotifications();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!profile) return null;
  const counts = { notifications: unread, messages: unreadMessages };
  const visible = NAV.filter((n) => !n.adminOnly || isAdmin);

  const menuItems = visible.map((item) => {
    const count = item.badge ? counts[item.badge] : 0;
    return {
      key: item.key,
      icon: item.icon,
      label: (
        <Flex justify="space-between" align="center" gap={8} style={{ width: '100%' }}>
          <span>{t(item.label)}</span>
          {count > 0 && (
            <AntBadge count={count > 99 ? '99+' : count} size="small" style={{ backgroundColor: '#e9a23b', color: '#09222a', fontWeight: 700 }} />
          )}
        </Flex>
      ),
    };
  });

  const siderMenu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[activeKey(location.pathname)]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ background: 'transparent', border: 'none' }}
    />
  );

  const userMenu = [
    { key: 'profile', icon: <UserOutlined />, label: t('nav.profile') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: t('nav.logout'), danger: true },
  ];

  const userBlock = (
    <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
      <LanguageSwitcher userId={profile.id} dark />
      <Flex align="center" gap={8}>
        <NavLink to="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 hover:bg-white/8">
          <Avatar name={profile.full_name} size={36} />
          <div className="min-w-0 flex-1">
            <Typography.Text strong style={{ color: '#fff', display: 'block' }} ellipsis>
              {profile.full_name || profile.email}
            </Typography.Text>
            <Typography.Text style={{ color: '#a6cbd1', fontSize: 12 }}>{t(`role.${profile.role}`)}</Typography.Text>
          </div>
        </NavLink>
        <Dropdown
          menu={{
            items: userMenu,
            onClick: ({ key }) => {
              if (key === 'logout') void signOut();
              else navigate('/profile');
            },
          }}
          trigger={['click']}
          placement="topRight"
        >
          <Button type="text" style={{ color: '#a6cbd1' }} aria-label={t('nav.logout')}>
            <LogoutOutlined />
          </Button>
        </Dropdown>
      </Flex>
    </div>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* Desktop sider */}
      <Sider width={272} breakpoint="lg" collapsedWidth={0} trigger={null} className="!hidden lg:!block" style={{ position: 'sticky', top: 0, height: '100vh', padding: 16 }}>
        <SidebarGlow />
        <Flex align="center" gap={10} style={{ padding: '4px 8px 24px', position: 'relative' }}>
          <LogoMark dark />
          <Wordmark light />
        </Flex>
        <Typography.Text strong style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(166,203,209,0.7)', padding: '0 12px 8px', display: 'block', position: 'relative' }}>
          {t('nav.section')}
        </Typography.Text>
        <div style={{ position: 'relative' }}>{siderMenu}</div>
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>{userBlock}</div>
      </Sider>

      <AntLayout>
        {/* Mobile header */}
        <Header className="lg:!hidden" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30, height: 56 }}>
          <Space>
            <LogoMark size={30} dark />
            <Wordmark light />
          </Space>
          <Space>
            <NavLink to="/notifications" aria-label={t('nav.notifications')} style={{ color: '#d2e5e8', padding: 8, position: 'relative' }}>
              <AntBadge dot={unread > 0} color="#e9a23b">
                <BellOutlined style={{ fontSize: 20 }} />
              </AntBadge>
            </NavLink>
            <Button type="text" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" style={{ color: '#d2e5e8' }}>
              <MenuOutlined style={{ fontSize: 20 }} />
            </Button>
          </Space>
        </Header>

        <Drawer
          placement="left"
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          styles={{ body: { background: '#0d2d34', padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }, header: { background: '#0d2d34', borderBottom: '1px solid rgba(255,255,255,0.1)' } }}
          title={
            <Space>
              <LogoMark size={28} dark />
              <Wordmark light />
            </Space>
          }
          width={300}
        >
          <div>
            <Typography.Text strong style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(166,203,209,0.7)', padding: '0 12px 8px', display: 'block' }}>
              {t('nav.section')}
            </Typography.Text>
            <Menu theme="dark" mode="inline" selectedKeys={[activeKey(location.pathname)]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ background: 'transparent', border: 'none' }} />
          </div>
          <div style={{ marginTop: 'auto' }}>{userBlock}</div>
        </Drawer>

        <Content style={{ padding: '24px 16px 48px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

/** Faint arc motif in the sidebar corner — the same arc as the logo and the dashboard. */
function SidebarGlow() {
  return (
    <svg className="pointer-events-none absolute -right-24 -bottom-10 opacity-[0.07]" width="320" height="220" viewBox="0 0 320 220" aria-hidden>
      <path d="M20 210a140 140 0 0 1 280 0" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M60 210a100 100 0 0 1 200 0" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M100 210a60 60 0 0 1 120 0" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function UserAvatar({ name }: { name: string }) {
  return <AntAvatar style={{ backgroundColor: '#2a7886' }}>{name.slice(0, 2).toUpperCase()}</AntAvatar>;
}
