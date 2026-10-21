import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const Leave = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchLeaveRequests();
  }, [selectedStatus]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/leave', { params: { status: selectedStatus } });
      if (response.data.success) {
        setLeaveRequests(response.data.requests);
      }
    } catch (err) {
      setError('Failed to fetch leave requests');
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRequest(null);
    setRejectionReason('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      const response = await api.put(`/leave/${selectedRequest.id}/approve`, {
        approved_by: 1 // Should be current user ID
      });

      if (response.data.success) {
        setSuccess('Leave request approved successfully');
        fetchLeaveRequests();
        handleCloseDialog();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve leave request');
      console.error('Error approving leave:', err);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      const response = await api.put(`/leave/${selectedRequest.id}/reject`, {
        rejection_reason: rejectionReason,
        approved_by: 1 // Should be current user ID
      });

      if (response.data.success) {
        setSuccess('Leave request rejected');
        fetchLeaveRequests();
        handleCloseDialog();
      }
    } catch (err) {
      setError('Failed to reject leave request');
      console.error('Error rejecting leave:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      cancelled: 'default'
    };
    return colors[status] || 'default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const statusTabs = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Leave Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs
            value={selectedStatus}
            onChange={(e, newValue) => setSelectedStatus(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {statusTabs.map((tab) => (
              <Tab key={tab.value} label={tab.label} value={tab.value} />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Leave Type</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Days</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No leave requests found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {request.first_name} {request.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {request.employee_number}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{request.leave_type_name}</TableCell>
                  <TableCell>{formatDate(request.start_date)}</TableCell>
                  <TableCell>{formatDate(request.end_date)}</TableCell>
                  <TableCell>{request.number_of_days}</TableCell>
                  <TableCell>
                    {new Date(request.requested_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={request.status}
                      size="small"
                      color={getStatusColor(request.status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => handleViewRequest(request)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Leave Request Details Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Leave Request Details</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Employee</Typography>
                <Typography variant="body1">
                  {selectedRequest.first_name} {selectedRequest.last_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedRequest.employee_number} - {selectedRequest.job_title}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Leave Type</Typography>
                <Typography variant="body1">{selectedRequest.leave_type_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Number of Days</Typography>
                <Typography variant="body1">{selectedRequest.number_of_days} days</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Start Date</Typography>
                <Typography variant="body1">{formatDate(selectedRequest.start_date)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">End Date</Typography>
                <Typography variant="body1">{formatDate(selectedRequest.end_date)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Reason</Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', mt: 1 }}>
                  <Typography variant="body2">{selectedRequest.reason}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Current Status</Typography>
                <Chip
                  label={selectedRequest.status}
                  color={getStatusColor(selectedRequest.status)}
                  sx={{ mt: 1 }}
                />
              </Grid>
              {selectedRequest.approved_by_name && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {selectedRequest.status === 'approved' ? 'Approved By' : 'Reviewed By'}
                  </Typography>
                  <Typography variant="body1">{selectedRequest.approved_by_name}</Typography>
                  {selectedRequest.approved_at && (
                    <Typography variant="caption" color="text.secondary">
                      on {new Date(selectedRequest.approved_at).toLocaleString()}
                    </Typography>
                  )}
                </Grid>
              )}
              {selectedRequest.rejection_reason && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Rejection Reason</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'error.lighter', mt: 1 }}>
                    <Typography variant="body2">{selectedRequest.rejection_reason}</Typography>
                  </Paper>
                </Grid>
              )}
              {selectedRequest.status === 'pending' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Rejection Reason (if rejecting)"
                    multiline
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Required if rejecting..."
                  />
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {selectedRequest && selectedRequest.status === 'pending' && (
            <>
              <Button
                onClick={handleReject}
                color="error"
                startIcon={<RejectIcon />}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
              >
                Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Leave;
