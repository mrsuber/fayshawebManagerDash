import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const TAB_SCREENS = ['Home', 'Wellness', 'Residence', 'Concierge', 'Profile'];

/** Opens a screen from outside a component (push notification taps, in-app banners). */
export function openScreen(screen, params) {
  if (!screen || !navigationRef.isReady()) return;
  if (TAB_SCREENS.includes(screen)) navigationRef.navigate('Main', { screen, params });
  else navigationRef.navigate(screen, params);
}
