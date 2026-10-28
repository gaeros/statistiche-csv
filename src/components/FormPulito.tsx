"use client";

// Modulo GET che non manda i campi lasciati vuoti, così l'indirizzo della pagina resta leggibile.
export function FormPulito(props: React.ComponentProps<"form">) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        for (const el of Array.from(e.currentTarget.elements)) {
          if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name && el.value === "") {
            el.disabled = true;
          }
        }
      }}
    />
  );
}
