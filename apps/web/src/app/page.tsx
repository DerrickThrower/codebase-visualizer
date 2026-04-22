import RepoConnector from '@/components/repo/RepoConnector';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Codebase Visualizer
          </h1>
          <p className="text-[#888888] text-sm leading-relaxed">
            Point at a GitHub repo. Get an interactive system design diagram.
          </p>
        </div>
        <RepoConnector />
      </div>
    </main>
  );
}
