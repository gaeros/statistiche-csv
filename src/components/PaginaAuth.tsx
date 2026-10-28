export function PaginaAuth({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="scheda w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Datahue</p>
          <h1 className="text-2xl font-semibold">{titolo}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
