import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** Prompts offered as one-click suggestions. */
export const suggestions = Object.keys(mock.aiAnswers);

/** POST /ai/ask { prompt } → { answer } */
export const ask = (prompt) => withMock(() => api.post('/ai/ask', { prompt }), () => ({ answer: mock.aiAnswers[prompt] ?? mock.aiFallback }));
