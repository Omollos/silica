# Silica Station

A lunar survival decision game where players command a Moon outpost and make critical decisions to keep their crew alive through 12 rounds of challenges.

## Features

- **Real-time Strategy**: Make decisions about power, oxygen, health, and resources
- **Educational**: Learn about real NASA space missions and lunar science
- **Accessibility**: Text-to-speech support for all content
- **Multiple Difficulties**: Cadet, Standard, and Commander modes
- **Rich Feedback**: Visual and audio feedback for all decisions

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4
- **State Management**: Zustand
- **Build Tool**: Vite 8
- **Audio**: Web Audio API for procedural sound effects
- **Speech**: Web Speech API for text-to-speech

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`

## Project Structure

```
src/
├── audio/          # Sound effects and speech synthesis
├── engine/         # Game logic and rules
├── screens/        # React screens
│   ├── end/       # Mission report screens
│   ├── round/     # Gameplay screens
│   └── title/     # Title screen
├── store/         # Zustand state stores
├── types.ts       # TypeScript type definitions
└── ui/            # Reusable UI components
```

## License

MIT