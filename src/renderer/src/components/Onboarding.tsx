import { PiLogoIcon } from "./Icons";

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg">
      <div className="mb-8 flex flex-col items-center">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full bg-accent opacity-10 blur-2xl"
            style={{ width: 80, height: 80 }}
          />
          <PiLogoIcon size={64} className="relative" />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-text">Pi Desktop</h1>
        <p className="mt-1 text-sm text-text-faint">Your AI coding agent, native on macOS</p>
      </div>

      <button
        onClick={onComplete}
        className="rounded-lg bg-accent px-8 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Get Started
      </button>
    </div>
  );
}
