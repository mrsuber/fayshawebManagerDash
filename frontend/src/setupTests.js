import '@testing-library/jest-dom';
import { resetDb } from './manager/mocks/db';

// jsdom doesn't implement scrolling; the manager Layout scrolls to top on navigation.
window.scrollTo = () => {};

// Manager tests run on the mock store (REACT_APP_USE_MOCKS=true in .env.test), which persists to
// localStorage; every test starts from the seed data.
beforeEach(() => resetDb());
