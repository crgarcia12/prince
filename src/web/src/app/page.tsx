import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-gray-900 px-4 text-center">
      <h1 className="mb-2 text-5xl font-bold text-amber-500 tracking-wider" style={{ fontFamily: 'serif' }}>
        PRINCE OF PERSIA
      </h1>
      <p className="mb-2 text-lg text-amber-700" style={{ fontFamily: 'serif' }}>
        A Web Recreation
      </p>
      <div className="my-6 w-48 border-t border-amber-800" />
      <p className="mb-8 max-w-md text-gray-400">
        Escape the dungeon. Defeat the guards. Save the Princess.
        <br />
        You have 60 minutes.
      </p>
      <Link
        href="/game"
        className="rounded-lg bg-amber-600 px-10 py-3 text-lg font-bold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/30"
      >
        Play Now
      </Link>
      <div className="mt-12 text-xs text-gray-600 max-w-sm">
        <p className="mb-1 text-gray-500 font-semibold">Controls</p>
        <p>← → Move &amp; Run | ↑ Jump &amp; Climb | ↓ Crouch</p>
        <p>Shift: Walk / Attack | Up: Block | ESC: Pause</p>
      </div>
      <p className="mt-8 text-xs text-gray-700">
        Based on the original Prince of Persia (1989) by Jordan Mechner.
        <br />
        Specifications extracted from{' '}
        <a href="https://github.com/NagyD/SDLPoP" className="text-amber-800 hover:text-amber-600 underline" target="_blank" rel="noopener noreferrer">
          SDLPoP
        </a>
        .
      </p>
    </main>
  );
}
