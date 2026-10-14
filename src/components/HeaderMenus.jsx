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

/** Bell with unread count; loads GET /notifications and prepends `notification:new` socket events. */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const { data, setData } = useApi(notificationsApi.list, [], []);
  const items = data || [];
  const unread = items.filter((n) => !n.read).length;

  const push = (n) => setData((list) => [n, ...(list || [])]);
  useSocketEvent('notification:new', push);

  // Register this browser for Firebase Cloud Messaging; foreground pushes land in the same list.
  useEffect(() => {
    let unsubscribe = () => {};
    getPushToken()
      .then((token) => token && notificationsApi.registerDevice(token))
      .catch(() => {});
    onForegroundPush(({ notification = {}, messageId }) =>
      setData((list) => [{ id: messageId, title: notification.title, body: notification.body || '', createdAt: new Date().toISOString(), read: false }, ...(list || [])]),
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
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('layout.notifications')} sx={{ color: 'text.primary' }}>
          <Badge badgeContent={unread} color="error">
            <NotificationsNoneIcon sx={{ fontSize: 26 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 340, maxWidth: '90vw' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
          <Typography variant="subtitle1">{t('layout.notifications')}</Typography>
          <Button size="small" onClick={markAll} disabled={!unread}>
            {t('layout.markAllRead')}
          </Button>
        </Box>
        <Divider />
        {items.length === 0 && <MenuItem disabled>{t('layout.noNotifications')}</MenuItem>}
        {items.map((n) => (
          <MenuItem key={n.id} onClick={() => setAnchor(null)} sx={{ whiteSpace: 'normal', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, mt: 1, borderRadius: '50%', flexShrink: 0, bgcolor: n.read ? 'transparent' : 'primary.main' }} />
            <ListItemText primary={n.title} secondary={`${n.body} · ${moment(n.createdAt).fromNow()}`} />
          </MenuItem>
        ))}
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
