import { MenuItem, TextField } from '@mui/material';
import useGuestOptions from '../hooks/useGuestOptions';

/** Compact guest selector for page toolbars (Guest Journey, Communications…). */
export default function GuestPicker({ value, onChange, label = 'Guest', minWidth = 300 }) {
  const { options } = useGuestOptions();
  if (!options.length) return null;
  return (
    <TextField select size="small" label={label} value={options.some(([id]) => id === value) ? value : ''} onChange={(e) => onChange(Number(e.target.value))} sx={{ minWidth }}>
      {options.map(([id, l]) => (
        <MenuItem key={id} value={id}>
          {l}
        </MenuItem>
      ))}
    </TextField>
  );
}
