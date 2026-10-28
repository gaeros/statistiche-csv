"use client";

// Modulo GET che non manda i campi lasciati vuoti, così l'indirizzo della pagina resta leggibile.
// Con invioAutomatico si aggiorna da solo a ogni scelta (menu e caselle).
export function FormPulito({ invioAutomatico = false, ...props }: React.ComponentProps<"form"> & { invioAutomatico?: boolean }) {
  return (
    <form
      {...props}
      onChange={
        invioAutomatico
          ? (e) => {
              const el = e.target as HTMLElement;
              if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type))) {
                e.currentTarget.requestSubmit();
              }
            }
          : props.onChange
      }
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
