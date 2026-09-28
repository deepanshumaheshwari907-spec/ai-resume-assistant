import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ResumeAI landing page', () => {
  render(<App />);

  expect(screen.getByText(/ResumeAI/i)).toBeInTheDocument();
  expect(screen.getByText(/Land Your Dream Job/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Analyze My Resume Free/i })).toBeInTheDocument();
});
