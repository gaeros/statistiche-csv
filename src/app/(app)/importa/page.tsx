import { Importatore } from "./Importatore";

export default function PaginaImporta() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Importa file</h1>
        <p className="text-slate-600 dark:text-slate-400">
          CSV, TSV, TXT delimitati o Excel (.xlsx, .xls), fino a 50 MB ciascuno. Ogni file (o foglio
          Excel) diventa una tabella.
        </p>
      </div>
      <Importatore />
    </div>
  );
}
