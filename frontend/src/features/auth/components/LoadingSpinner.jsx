import React from "react";

export const LoadingSpinner = ({ message }) => (
  <div className='flex flex-col items-center justify-center p-4'>
    <div className='animate-spin text-4xl mb-2'>🌈</div>
    <p className='text-lg font-medium'>{message}</p>
  </div>
);

export const loadingMessages = [
  "🚀 Launching your request to space...",
  "🎪 Juggling your data...",
  "🎭 Getting the show ready...",
  "🎪 Training digital monkeys...",
  "🎡 Taking your request for a spin...",
  "🎪 Performing authentication acrobatics...",
  "🎭 Preparing the grand entrance...",
  "🎪 Teaching elephants to dance...",
];
