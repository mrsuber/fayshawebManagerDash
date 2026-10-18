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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Tab,
  Tabs
} from '@mui/material';
import {
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const Applications = () => {
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [selectedJob, setSelectedJob] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchApplications();
    fetchJobs();
  }, [selectedStatus, selectedJob]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus) params.status = selectedStatus;
      if (selectedJob) params.job_id = selectedJob;

      const response = await api.get('/jobs/applications/all', { params });
      if (response.data.success) {
        setApplications(response.data.applications);
      }
    } catch (err) {
      setError('Failed to fetch applications');
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs');
      if (response.data.success) {
        setJobs(response.data.jobs);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const handleViewApplication = (application) => {
    setSelectedApplication(application);
    setReviewNotes(application.review_notes || '');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedApplication(null);
    setReviewNotes('');
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedApplication) return;

    try {
      const response = await api.put(`/jobs/applications/${selectedApplication.id}/status`, {
        status,
        review_notes: reviewNotes
      });

      if (response.data.success) {
        setSuccess(`Application ${status} successfully`);
        fetchApplications();
        handleCloseDialog();
      }
    } catch (err) {
      setError('Failed to update application status');
      console.error('Error updating status:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      reviewed: 'info',
      shortlisted: 'primary',
      interviewed: 'secondary',
      rejected: 'error',
      hired: 'success'
    };
    return colors[status] || 'default';
  };

  const statusTabs = [
    { label: 'Pending', value: 'pending' },
    { label: 'Reviewed', value: 'reviewed' },
    { label: 'Shortlisted', value: 'shortlisted' },
    { label: 'Interviewed', value: 'interviewed' },
    { label: 'Hired', value: 'hired' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: '' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Job Applications
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filter by Job</InputLabel>
                <Select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  label="Filter by Job"
                >
                  <MenuItem value="">All Jobs</MenuItem>
                  {jobs.map((job) => (
                    <MenuItem key={job.id} value={job.id}>
                      {job.title} ({job.application_count || 0} applications)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
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
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Applicant</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Job Position</TableCell>
              <TableCell>Applied Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No applications found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    {application.first_name} {application.last_name}
                  </TableCell>
                  <TableCell>{application.email}</TableCell>
                  <TableCell>{application.phone}</TableCell>
                  <TableCell>{application.job_title}</TableCell>
                  <TableCell>
                    {new Date(application.applied_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={application.status}
                      size="small"
                      color={getStatusColor(application.status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewApplication(application)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Application Details Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Application Details</DialogTitle>
        <DialogContent>
          {selectedApplication && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Applicant Information
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Name</Typography>
                <Typography variant="body1">
                  {selectedApplication.first_name} {selectedApplication.last_name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography variant="body1">{selectedApplication.email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Phone</Typography>
                <Typography variant="body1">{selectedApplication.phone}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Applied Date</Typography>
                <Typography variant="body1">
                  {new Date(selectedApplication.applied_at).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Job Position</Typography>
                <Typography variant="body1">{selectedApplication.job_title}</Typography>
              </Grid>
              {selectedApplication.expected_salary && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Expected Salary</Typography>
                  <Typography variant="body1">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'XAF',
                      minimumFractionDigits: 0
                    }).format(selectedApplication.expected_salary)}
                  </Typography>
                </Grid>
              )}
              {selectedApplication.available_start_date && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Available Start Date</Typography>
                  <Typography variant="body1">
                    {new Date(selectedApplication.available_start_date).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
              {selectedApplication.cover_letter_text && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Cover Letter
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedApplication.cover_letter_text}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Documents
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {selectedApplication.cv_file_path && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      href={`${api.defaults.baseURL}/${selectedApplication.cv_file_path}`}
                      target="_blank"
                    >
                      Download CV
                    </Button>
                  )}
                  {selectedApplication.cover_letter_file_path && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      href={`${api.defaults.baseURL}/${selectedApplication.cover_letter_file_path}`}
                      target="_blank"
                    >
                      Download Cover Letter
                    </Button>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Current Status</Typography>
                <Chip
                  label={selectedApplication.status}
                  color={getStatusColor(selectedApplication.status)}
                  sx={{ mt: 1 }}
                />
              </Grid>
              {selectedApplication.reviewed_by_name && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Reviewed By</Typography>
                  <Typography variant="body1">{selectedApplication.reviewed_by_name}</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Review Notes"
                  multiline
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this application..."
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {selectedApplication && selectedApplication.status !== 'rejected' && (
            <Button
              onClick={() => handleUpdateStatus('rejected')}
              color="error"
              startIcon={<RejectIcon />}
            >
              Reject
            </Button>
          )}
          {selectedApplication && selectedApplication.status === 'pending' && (
            <Button
              onClick={() => handleUpdateStatus('reviewed')}
              variant="outlined"
            >
              Mark as Reviewed
            </Button>
          )}
          {selectedApplication && selectedApplication.status === 'reviewed' && (
            <Button
              onClick={() => handleUpdateStatus('shortlisted')}
              variant="contained"
              color="primary"
            >
              Shortlist
            </Button>
          )}
          {selectedApplication && selectedApplication.status === 'shortlisted' && (
            <Button
              onClick={() => handleUpdateStatus('interviewed')}
              variant="contained"
              color="secondary"
            >
              Mark as Interviewed
            </Button>
          )}
          {selectedApplication && selectedApplication.status === 'interviewed' && (
            <Button
              onClick={() => handleUpdateStatus('hired')}
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
            >
              Hire
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Applications;
