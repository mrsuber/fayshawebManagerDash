import LogoutIcon from '@mui/icons-material/Logout';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import TranslateIcon from '@mui/icons-material/Translate';
import { Badge, Box, Button, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '../api';
import config from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resetDb } from '../mocks/db';
import useApi from '../hooks/useApi';
import useSocketEvent from '../hooks/useSocketEvent';
import { LANGUAGES } from '../i18n';
import { getPushToken, onForegroundPush } from '../lib/firebase';
import { askDesktop, chime, desktop, desktopPermission, desktopSupported, titleCount } from '../lib/alerts';
import useNav from '../hooks/useNav';

const LEVEL = {
  urgent: { color: '#ff6b6b', icon: 'priority_high', label: 'Urgent' },
  action: { color: '#e8b84a', icon: 'pending_actions', label: 'Needs action' },
  info: { color: '#5b8ff0', icon: 'notifications', label: '' },
};
const isOpen = (n) => !n.resolvedAt && n.level && n.level !== 'info';

/**
 * The alert centre: everything that happened, and — first — what still needs someone (raised by the operations
 * monitor and by guest actions, resolved automatically when done). Live over Socket.io, with a chime, desktop
 * notifications while the tab is in the background, and the count in the tab title.
 */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const navigate = useNav();
  const [anchor, setAnchor] = useState(null);
  const [tab, setTab] = useState('action');
  const [permission, setPermission] = useState(desktopPermission());
  const { data, setData } = useApi(notificationsApi.list, [], []);
  const items = data || [];
  const open = items.filter(isOpen);
  const unread = items.filter((n) => !n.read && !n.resolvedAt).length;
  const shown = tab === 'action' ? open : items;

  useEffect(() => titleCount(open.length), [open.length]);
  useEffect(() => () => titleCount(0), []);

  const go = (n) => {
    setAnchor(null);
    if (!n.read) {
      setData((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const push = (n) => {
    setData((list) => [n, ...(list || []).filter((x) => x.id !== n.id)]);
    chime(n.level);
    desktop(n, () => go(n));
  };
  useSocketEvent('notification:new', push);
  useSocketEvent('notification:resolved', ({ ids = [] }) =>
    setData((list) => (list || []).map((x) => (ids.includes(x.id) ? { ...x, resolvedAt: new Date().toISOString() } : x))),
  );

  // Register this browser for Firebase Cloud Messaging (when configured); foreground pushes land in the same list.
  useEffect(() => {
    let unsubscribe = () => {};
    getPushToken()
      .then((token) => token && notificationsApi.registerDevice(token))
      .catch(() => {});
    onForegroundPush(({ notification = {}, messageId }) =>
      setData((list) => [{ id: messageId, title: notification.title, body: notification.body || '', createdAt: new Date().toISOString(), read: false, level: 'info' }, ...(list || [])]),
    ).then((fn) => (unsubscribe = fn));
    return () => unsubscribe();
  }, [setData]);

  const markAll = () => {
    setData((list) => list.map((n) => ({ ...n, read: true })));
    notificationsApi.markAllRead().catch(() => {});
  };

  return (
    <>
      <Tooltip title={t('layout.notifications')}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`${t('layout.notifications')}${open.length ? ` (${open.length} need action)` : ''}`} sx={{ color: 'text.primary' }}>
          <Badge badgeContent={open.length || unread} color={open.some((n) => n.level === 'urgent') ? 'error' : open.length ? 'warning' : 'error'}>
            <NotificationsNoneIcon sx={{ fontSize: 26 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 400, maxWidth: '94vw', maxHeight: '78vh' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, gap: 1 }}>
          <Typography variant="subtitle1">{t('layout.notifications')}</Typography>
          <Button size="small" onClick={markAll} disabled={!unread}>
            {t('layout.markAllRead')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, px: 2, pb: 1 }}>
          {[
            ['action', `Needs action (${open.length})`],
            ['all', 'All'],
          ].map(([k, l]) => (
            <Button key={k} size="small" variant={tab === k ? 'contained' : 'outlined'} onClick={() => setTab(k)} sx={{ borderRadius: 99, textTransform: 'none' }}>
              {l}
            </Button>
          ))}
        </Box>
        {desktopSupported() && permission === 'default' ? (
          <MenuItem onClick={() => askDesktop().then(setPermission)} sx={{ whiteSpace: 'normal', fontSize: 13, color: 'primary.main' }}>
            Turn on desktop alerts — be told even when FAY OS is in another tab
          </MenuItem>
        ) : null}
        <Divider />
        {shown.length === 0 && <MenuItem disabled sx={{ whiteSpace: 'normal' }}>{tab === 'action' ? 'Nothing needs attention right now.' : t('layout.noNotifications')}</MenuItem>}
        {shown.map((n) => {
          const lv = LEVEL[n.level] || LEVEL.info;
          return (
            <MenuItem key={n.id} onClick={() => go(n)} sx={{ whiteSpace: 'normal', alignItems: 'flex-start', gap: 1.25, opacity: n.resolvedAt ? 0.55 : 1, py: 1.25 }}>
              <span className="icon" style={{ fontSize: 20, color: lv.color, marginTop: 2 }} aria-hidden="true">{lv.icon}</span>
              <ListItemText
                primary={
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ flex: 1, fontWeight: n.read ? 400 : 600 }}>{n.title}</span>
                    {n.resolvedAt ? <span style={{ fontSize: 11, color: '#3fd283' }}>Resolved</span> : lv.label ? <span style={{ fontSize: 11, color: lv.color }}>{lv.label}</span> : null}
                  </span>
                }
                secondary={`${n.body ? `${n.body} · ` : ''}${moment(n.createdAt).fromNow()}`}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title={t('layout.language')}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('layout.language')} sx={{ color: 'text.primary' }}>
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {LANGUAGES.map((l) => (
          <MenuItem
            key={l.code}
            selected={i18n.resolvedLanguage === l.code}
            onClick={() => {
              i18n.changeLanguage(l.code);
              setAnchor(null);
            }}
          >
            {l.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Avatar + name; opens a menu with the signed-in user's email and sign-out. */
export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <div onClick={(e) => setAnchor(e.currentTarget)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8, cursor: 'pointer' }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            border: '2px solid var(--gold)',
            background: 'repeating-linear-gradient(135deg,#2a2520 0 4px,#221e1a 4px 8px)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 17 }}>FAY</span>
          <span style={{ fontSize: 13, color: '#b9b2a5' }}>{t('layout.concierge')}</span>
        </div>
      </div>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {user && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2">{user.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        )}
        <Divider />
        {config.useMocks && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              resetDb();
              toast(t('common.resetDone'));
              // Reload so every screen re-reads the restored sample data.
              setTimeout(() => window.location.reload(), 600);
            }}
          >
            <ListItemIcon>
              <RestartAltIcon fontSize="small" />
            </ListItemIcon>
            {t('common.resetDemo')}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setAnchor(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {t('layout.logout')}
        </MenuItem>
      </Menu>
    </>
  );
}
