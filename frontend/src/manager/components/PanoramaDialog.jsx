import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';

// pannellum touches `window` at import time, so load it only when a tour is opened.
const Pannellum = lazy(() => import('pannellum-react').then((m) => ({ default: m.Pannellum })));

/** 360° residence tour from an equirectangular image (residence.panoramaUrl). */
export default function PanoramaDialog({ residence, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog open={!!residence} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {residence?.name} · {t('residences.view360')}
        <IconButton onClick={onClose} aria-label={t('common.cancel')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {residence?.panoramaUrl ? (
          <Suspense fallback={null}>
            <Pannellum width="100%" height="560px" image={residence.panoramaUrl} pitch={0} yaw={0} hfov={110} autoLoad showZoomCtrl={false} />
          </Suspense>
        ) : (
          <div className="ph" style={{ height: 360, display: 'grid', placeItems: 'center', borderRadius: 8 }}>
            <Typography color="text.secondary">{t('residences.no360')}</Typography>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
