// Parola scritta nella finestra di conferma. Vale quella di entrambe le lingue,
// perché l'utente può cambiare lingua mentre la finestra è aperta.
export function confermaScritta(formData: FormData) {
  const scritto = String(formData.get("conferma") ?? "").trim();
  return scritto === "ELIMINA" || scritto === "DELETE";
}
