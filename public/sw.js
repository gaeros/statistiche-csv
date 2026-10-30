// Service worker di Datahue: c'è solo perché l'app si possa installare sul telefono.
// Regola: non si salvano MAI pagine, risposte del server o dati dell'utente (sono personali e
// dietro login). In cache vanno solo la pagina statica "sei offline" e l'icona che usa.
// Le richieste normali passano dritte alla rete, come senza service worker.
const CACHE = "datahue-statico-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE, "/icone/icona-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  // Solo l'apertura di una pagina: se la rete non risponde si mostra la pagina offline.
  // La risposta della rete non viene salvata.
  if (richiesta.mode === "navigate") {
    evento.respondWith(fetch(richiesta).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (new URL(richiesta.url).pathname === "/icone/icona-192.png") {
    evento.respondWith(fetch(richiesta).catch(() => caches.match(richiesta)));
  }
});
