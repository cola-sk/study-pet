import confetti from 'canvas-confetti';

export const shootCoinsConfetti = () => {
  try {
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF4500', '#1677FF'],
      shapes: ['circle', 'square'],
      scalar: 1.2,
    });
  } catch {
    // Ignore canvas error if canvas is unavailable
  }
};
