// Sanificazione dei nomi di tabelle e colonne (SPEC §4.6).

// Parole riservate di PostgreSQL che non possono essere nomi senza virgolette.
const RISERVATE = new Set([
  "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "asymmetric", "authorization",
  "binary", "both", "case", "cast", "check", "collate", "collation", "column", "concurrently",
  "constraint", "create", "cross", "current_catalog", "current_date", "current_role",
  "current_schema", "current_time", "current_timestamp", "current_user", "default", "deferrable",
  "desc", "distinct", "do", "else", "end", "except", "false", "fetch", "for", "foreign", "freeze",
  "from", "full", "grant", "group", "having", "ilike", "in", "initially", "inner", "intersect",
  "into", "is", "isnull", "join", "lateral", "leading", "left", "like", "limit", "localtime",
  "localtimestamp", "natural", "not", "notnull", "null", "offset", "on", "only", "or", "order",
  "outer", "overlaps", "placing", "primary", "references", "returning", "right", "select",
  "session_user", "similar", "some", "symmetric", "system_user", "table", "tablesample", "then",
  "to", "trailing", "true", "union", "unique", "user", "using", "variadic", "verbose", "when",
  "where", "window", "with",
]);

// Colonne che ogni tabella ha già.
const DI_SISTEMA = new Set(["id", "user_id", "created_at"]);

// Il nome fisico è "u" + 8 caratteri dell'utente + "_" + nome: il nome può avere al massimo 53 caratteri.
export const MAX_NOME_TABELLA = 53;
export const MAX_NOME_COLONNA = 63;

const SIMBOLI: Record<string, string> = {
  "€": " eur ",
  "$": " usd ",
  "£": " gbp ",
  "%": " perc ",
  "&": " e ",
  "°": " gradi ",
};

function base(testo: string): string {
  let s = testo.replace(/^\uFEFF/, "").trim().toLowerCase();
  for (const [simbolo, parola] of Object.entries(SIMBOLI)) s = s.split(simbolo).join(parola);
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tronca(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).replace(/_+$/, "") : s;
}

export function nomeFileSenzaEstensione(nomeFile: string): string {
  return nomeFile.replace(/\.[^.]+$/, "");
}

export function sanificaNomeTabella(testo: string): string {
  let s = base(testo);
  if (!s) s = "tabella";
  if (/^[0-9]/.test(s)) s = `t_${s}`;
  if (RISERVATE.has(s)) s = `${s}_tab`;
  return tronca(s, MAX_NOME_TABELLA);
}

export function sanificaNomeColonna(testo: string, posizione: number): string {
  let s = base(testo);
  if (!s) return `colonna_${posizione}`;
  if (/^[0-9]/.test(s)) s = `c_${s}`;
  if (RISERVATE.has(s)) s = `${s}_col`;
  if (DI_SISTEMA.has(s)) s = `${s}_file`;
  return tronca(s, MAX_NOME_COLONNA);
}

// Aggiunge _2, _3, ... ai nomi ripetuti, restando entro la lunghezza massima.
export function deduplica(nomi: string[], max = MAX_NOME_COLONNA): string[] {
  const usati = new Set<string>();
  return nomi.map((nome) => {
    let candidato = nome;
    let n = 1;
    while (usati.has(candidato)) {
      n += 1;
      const suffisso = `_${n}`;
      candidato = tronca(nome, max - suffisso.length) + suffisso;
    }
    usati.add(candidato);
    return candidato;
  });
}

export const NOME_TABELLA_VALIDO = /^[a-z_][a-z0-9_]{0,52}$/;
export const NOME_COLONNA_VALIDO = /^[a-z_][a-z0-9_]{0,62}$/;

export function nomeColonnaValido(nome: string): boolean {
  return NOME_COLONNA_VALIDO.test(nome) && !DI_SISTEMA.has(nome) && !RISERVATE.has(nome);
}
