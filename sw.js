// Service worker do "Consulta Municípios GO".
// Cacheia só o "casco" do app (HTML/manifest/ícones) para abrir sem internet.
// Estratégia do index.html: rede primeiro, cache como reserva (assim uma publicação
// nova chega quando há internet). Ícones: cache primeiro (mudam muito pouco).
// Requisições para o Supabase (dados) NUNCA passam pelo cache deste service worker.
// 20260910185350 é substituído pela data/hora da publicação em ferramentas/publicar_app.py
// (em app/sw.js, para desenvolvimento, fica com o marcador mesmo).
const VERSAO = '20260910185350';
const CACHE_NOME = 'cmgo-' + VERSAO;
const CASCO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NOME).then(cache => cache.addAll(CASCO)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE_NOME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca cachear/interceptar chamadas ao Supabase — sempre vão direto à rede.
  if (url.hostname.endsWith('supabase.co')) return;

  // Só cuida de pedidos de mesma origem (o casco do app).
  if (url.origin !== self.location.origin) return;

  const ehIcone = url.pathname.includes('/icones/');

  if (ehIcone) {
    // Ícones: cache primeiro (raramente mudam).
    event.respondWith(
      caches.match(req).then(resp => resp || fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE_NOME).then(cache => cache.put(req, copia));
        return r;
      }))
    );
    return;
  }

  // HTML / manifest / demais arquivos do casco: rede primeiro, cache como reserva.
  event.respondWith(
    fetch(req).then(r => {
      const copia = r.clone();
      caches.open(CACHE_NOME).then(cache => cache.put(req, copia));
      return r;
    }).catch(() => caches.match(req).then(resp => resp || caches.match('./index.html')))
  );
});
