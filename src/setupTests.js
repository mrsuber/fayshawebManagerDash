import '@testing-library/jest-dom';

// jsdom doesn't implement scrolling; Layout scrolls to top on navigation.
window.scrollTo = () => {};
