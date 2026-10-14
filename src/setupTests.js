import '@testing-library/jest-dom';
import { resetDb } from './mocks/db';

// jsdom doesn't implement scrolling; Layout scrolls to top on navigation.
window.scrollTo = () => {};

// Every test starts from the seed data (the mock db persists to localStorage).
beforeEach(() => resetDb());
