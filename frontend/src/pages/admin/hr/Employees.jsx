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
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
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
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Block as TerminateIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    job_title: '',
    employment_type: 'full-time',
    hire_date: new Date().toISOString().split('T')[0],
    department_id: '',
    category_id: '',
    requires_keycard: false,
    keycard_number: '',
    can_work_remotely: false,
    default_shift: 'morning',
    salary_amount: '',
    salary_period: 'monthly',
    reports_to: '',
    create_user_account: true,
    password: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchCategories();
  }, [selectedStatus]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus) params.status = selectedStatus;

      const response = await api.get('/employees', { params });
      if (response.data.success) {
        setEmployees(response.data.employees);
      }
    } catch (err) {
      setError('Failed to fetch employees');
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/jobs/meta/departments');
      if (response.data.success) {
        setDepartments(response.data.departments);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/jobs/meta/categories');
      if (response.data.success) {
        setCategories(response.data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone || '',
        date_of_birth: employee.date_of_birth ? employee.date_of_birth.split('T')[0] : '',
        gender: employee.gender || '',
        address: employee.address || '',
        job_title: employee.job_title,
        employment_type: employee.employment_type,
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : '',
        department_id: employee.department_id || '',
        category_id: employee.category_id || '',
        requires_keycard: employee.requires_keycard || false,
        keycard_number: employee.keycard_number || '',
        can_work_remotely: employee.can_work_remotely || false,
        default_shift: employee.default_shift || 'morning',
        salary_amount: employee.salary_amount || '',
        salary_period: employee.salary_period || 'monthly',
        reports_to: employee.reports_to || '',
        create_user_account: false,
        password: ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: '',
        job_title: '',
        employment_type: 'full-time',
        hire_date: new Date().toISOString().split('T')[0],
        department_id: '',
        category_id: '',
        requires_keycard: false,
        keycard_number: '',
        can_work_remotely: false,
        default_shift: 'morning',
        salary_amount: '',
        salary_period: 'monthly',
        reports_to: '',
        create_user_account: true,
        password: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEmployee(null);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');

      const payload = {
        ...formData,
        salary_amount: formData.salary_amount ? parseFloat(formData.salary_amount) : null
      };

      if (editingEmployee) {
        const response = await api.put(`/employees/${editingEmployee.id}`, payload);
        if (response.data.success) {
          setSuccess('Employee updated successfully');
          fetchEmployees();
          handleCloseDialog();
        }
      } else {
        const response = await api.post('/employees', payload);
        if (response.data.success) {
          setSuccess(`Employee created successfully. ${response.data.credentials ? `Login: ${response.data.credentials.email} / ${response.data.credentials.password}` : ''}`);
          fetchEmployees();
          handleCloseDialog();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save employee');
      console.error('Error saving employee:', err);
    }
  };

  const handleTerminate = async (employeeId) => {
    if (!window.confirm('Are you sure you want to terminate this employee?')) {
      return;
    }

    const reason = window.prompt('Please enter termination reason:');
    if (!reason) return;

    try {
      const response = await api.post(`/employees/${employeeId}/terminate`, {
        termination_date: new Date().toISOString().split('T')[0],
        reason
      });

      if (response.data.success) {
        setSuccess('Employee terminated successfully');
        fetchEmployees();
      }
    } catch (err) {
      setError('Failed to terminate employee');
      console.error('Error terminating employee:', err);
    }
  };

  const statusTabs = [
    { label: 'Active', value: 'active' },
    { label: 'On Leave', value: 'on_leave' },
    { label: 'Suspended', value: 'suspended' },
    { label: 'Terminated', value: 'terminated' },
    { label: 'All', value: '' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Employees</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Employee
        </Button>
      </Box>

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
              <TableCell>Employee #</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Job Title</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No employees found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.employee_number}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {employee.first_name} {employee.last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {employee.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{employee.job_title}</TableCell>
                  <TableCell>{employee.department_name || '-'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {employee.category_name || '-'}
                      {employee.requires_keycard && (
                        <Chip
                          icon={<BadgeIcon />}
                          label="Keycard"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{employee.employment_type}</TableCell>
                  <TableCell>
                    <Chip
                      label={employee.status}
                      size="small"
                      color={employee.status === 'active' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(employee)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    {employee.status === 'active' && (
                      <IconButton
                        size="small"
                        onClick={() => handleTerminate(employee.id)}
                        title="Terminate"
                        color="error"
                      >
                        <TerminateIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Employee Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Personal Information
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Date of Birth"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  label="Gender"
                >
                  <MenuItem value="">Prefer not to say</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Employment Details
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Job Title"
                name="job_title"
                value={formData.job_title}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Employment Type</InputLabel>
                <Select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  label="Employment Type"
                >
                  <MenuItem value="full-time">Full-Time</MenuItem>
                  <MenuItem value="part-time">Part-Time</MenuItem>
                  <MenuItem value="contract">Contract</MenuItem>
                  <MenuItem value="intern">Intern</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Hire Date"
                name="hire_date"
                value={formData.hire_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  label="Department"
                >
                  <MenuItem value="">None</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  label="Category"
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>{cat.display_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Reports To</InputLabel>
                <Select
                  name="reports_to"
                  value={formData.reports_to}
                  onChange={handleChange}
                  label="Reports To"
                >
                  <MenuItem value="">None</MenuItem>
                  {employees.filter(e => e.id !== editingEmployee?.id).map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.job_title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Work Configuration
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.requires_keycard}
                    onChange={handleChange}
                    name="requires_keycard"
                  />
                }
                label="Requires Keycard"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              {formData.requires_keycard && (
                <TextField
                  fullWidth
                  label="Keycard Number"
                  name="keycard_number"
                  value={formData.keycard_number}
                  onChange={handleChange}
                />
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.can_work_remotely}
                    onChange={handleChange}
                    name="can_work_remotely"
                  />
                }
                label="Can Work Remotely"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Default Shift</InputLabel>
                <Select
                  name="default_shift"
                  value={formData.default_shift}
                  onChange={handleChange}
                  label="Default Shift"
                >
                  <MenuItem value="morning">Morning</MenuItem>
                  <MenuItem value="afternoon">Afternoon</MenuItem>
                  <MenuItem value="night">Night</MenuItem>
                  <MenuItem value="flexible">Flexible</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Compensation
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Salary Amount (XAF)"
                name="salary_amount"
                value={formData.salary_amount}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Salary Period</InputLabel>
                <Select
                  name="salary_period"
                  value={formData.salary_period}
                  onChange={handleChange}
                  label="Salary Period"
                >
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {!editingEmployee && (
              <>
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    User Account
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.create_user_account}
                        onChange={handleChange}
                        name="create_user_account"
                      />
                    }
                    label="Create User Account (allows employee to login)"
                  />
                </Grid>
                {formData.create_user_account && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Initial Password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      helperText="Leave empty to generate a one-time password. It is shown once and must be changed at first sign-in."
                    />
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingEmployee ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;
