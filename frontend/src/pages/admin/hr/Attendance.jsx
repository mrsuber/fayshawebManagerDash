import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert
} from '@mui/material';
import {
  CheckCircle as PresentIcon,
  Cancel as AbsentIcon,
  AccessTime as ClockIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const Attendance = () => {
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [stats, setStats] = useState({
    present: 0,
    total_employees: 0,
    currently_clocked_in: 0,
    absent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get('/attendance/today');
      if (response.data.success) {
        setTodayAttendance(response.data.attendance);
        setStats(response.data.stats);
      }
    } catch (err) {
      setError('Failed to fetch attendance data');
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Attendance Dashboard
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Employees
                  </Typography>
                  <Typography variant="h4">{stats.total_employees}</Typography>
                </Box>
                <PresentIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Present Today
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.present}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.total_employees > 0 ? Math.round((stats.present / stats.total_employees) * 100) : 0}% attendance
                  </Typography>
                </Box>
                <PresentIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Currently Clocked In
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {stats.currently_clocked_in}
                  </Typography>
                </Box>
                <ClockIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Absent Today
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.absent}
                  </Typography>
                </Box>
                <AbsentIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Today's Attendance</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Job Title</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Clock In</TableCell>
                <TableCell>Clock Out</TableCell>
                <TableCell>Hours Worked</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todayAttendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No attendance records for today.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                todayAttendance.map((record) => (
                  <TableRow key={record.employee_id}>
                    <TableCell>{record.employee_number}</TableCell>
                    <TableCell>
                      {record.first_name} {record.last_name}
                    </TableCell>
                    <TableCell>{record.job_title}</TableCell>
                    <TableCell>{record.department_name || '-'}</TableCell>
                    <TableCell>{formatTime(record.clock_in_time)}</TableCell>
                    <TableCell>{formatTime(record.clock_out_time)}</TableCell>
                    <TableCell>
                      {record.total_hours ? `${parseFloat(record.total_hours).toFixed(1)}h` : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.clock_out_time ? 'Clocked Out' : 'Clocked In'}
                        size="small"
                        color={record.clock_out_time ? 'default' : 'success'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Attendance;
