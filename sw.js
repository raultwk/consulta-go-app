// Service worker do "Consulta Municípios GO".
// Cacheia só o "casco" do app (HTML/manifest/ícones) para abrir sem internet.
// Estratégia: SEMPRE responde com o que já está salvo no aparelho na hora (nunca
// espera a rede para abrir a tela); se há internet, busca uma versão nova por trás
// e só troca o que está salvo depois que a versão nova chegar 100% completa —
// ela vale a partir da próxima abertura do app (nada é apagado antes de a nova
// versão estar toda baixada).
// Requisições para o Supabase (dados) NUNCA passam pelo cache deste service worker.
// 20260912064222 é substituído pela data/hora da publicação em ferramentas/publicar_app.py
// (em app/sw.js, para desenvolvimento, fica com o marcador mesmo).
const VERSAO = '20260912064222';
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

  // Casco do app (HTML, manifest, ícones): responde na hora com o que já está
  // salvo e, se houver internet, busca uma versão nova por trás para a próxima vez.
  const buscaNova = fetch(req).then(r => {
    if (r && r.ok) caches.open(CACHE_NOME).then(cache => cache.put(req, r.clone()));
    return r;
  }).catch(() => null);
  event.waitUntil(buscaNova);
  event.respondWith(
    caches.match(req).then(respSalva => respSalva || buscaNova.then(r => r || caches.match('./index.html')))
  );
});
