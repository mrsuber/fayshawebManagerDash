import { render, screen } from '@testing-library/react';
import TaskTimer, { clockText, minutesText, orderTimer, timerState } from '../components/TaskTimer';

const iso = (ms) => new Date(ms).toISOString();

test('formats clock and minutes', () => {
  expect(clockText(754)).toBe('12:34');
  expect(clockText(3 * 3600)).toBe('3:00:00');
  expect(minutesText(40)).toBe('40 min');
  expect(minutesText(95)).toBe('1 h 35 min');
  expect(minutesText(120)).toBe('2 h');
});

test('running timer shows time left, then keeps counting when late', () => {
  const now = Date.now();
  const onTime = { minutes: 30, startedAt: iso(now - 10 * 60000), dueAt: iso(now + 20 * 60000), endedAt: null, running: true };
  render(<TaskTimer timer={onTime} />);
  expect(screen.getByRole('timer').textContent).toMatch(/1\d:\d\d left/);

  const late = { minutes: 15, startedAt: iso(now - 25 * 60000), dueAt: iso(now - 10 * 60000), endedAt: null, running: true };
  expect(timerState(late, now).late).toBe(true);
  render(<TaskTimer timer={late} />);
  expect(screen.getByText(/Late \+10:0\d/)).toBeInTheDocument();
});

test('finished timer says how long it took and whether on time', () => {
  const t = { minutes: 15, startedAt: iso(0), dueAt: iso(15 * 60000), endedAt: iso(25 * 60000), running: false, takenMinutes: 25, lateMinutes: 10, onTime: false };
  render(<TaskTimer timer={t} />);
  expect(screen.getByText(/Took 25 min · 10 min late/)).toBeInTheDocument();
});

test('untimed or unassigned tasks', () => {
  const { container } = render(<TaskTimer timer={null} />);
  expect(container.textContent).toBe('');
  render(<TaskTimer timer={null} minutes={45} assigned={false} />);
  expect(screen.getByText(/45 min once assigned/)).toBeInTheDocument();
});

test('work order clock from collection fields', () => {
  expect(orderTimer({ minutes: 60 })).toBeNull();
  const t = orderTimer({ minutes: 60, assignedAt: iso(0), completedAt: iso(30 * 60000), status: 'Completed' });
  expect(t).toMatchObject({ takenMinutes: 30, lateMinutes: 0, onTime: true, running: false });
});
