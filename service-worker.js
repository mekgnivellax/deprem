const CACHE_NAME = 'deprem-takip-cache-v1';
const urlsToCache = [
  '/index.html', // Ana sayfa (start_url ile aynı)
  '/style.css',
  '/script.js',
  '/manifest.json',
  'icons/icon-192x192.png', // Güncellendi: .png
  'icons/icon-512x512.png', // Güncellendi: .png
  // 'icons/favicon.ico', // Kaldırıldı: Favicon yoksa
  // Leaflet marker ikonları (v1.9.4 için)
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  // Leaflet katman kontrol ikonları
  'https://unpkg.com/leaflet@1.9.4/dist/images/layers.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/layers-2x.png',
  // Fontlar ve diğer statik varlıklar
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css', // Font Awesome CSS
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
  // Gerekirse Leaflet ikon/gölge resimleri:
  // 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  // 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
];

// Service Worker'ı yükle (install)
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

// Eski önbellekleri temizle (activate)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Aktif olur olmaz kontrolü ele al
});

// İstekleri yönet (fetch) - Cache First Stratejisi
self.addEventListener('fetch', event => {
  // Sadece GET isteklerini ve http/https olmayanları (örn. chrome-extension://) cache'le
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
     // console.log('[Service Worker] Non-cacheable request:', event.request.url);
    return;
  }

  // API isteklerini şimdilik cache'lemiyoruz, direkt network'e gitsin
  // (Daha sonra Stale-While-Revalidate veya Network-First eklenebilir)
  if (event.request.url.includes('api.orhanaydogdu.com.tr') || event.request.url.includes('deprem-api.vercel.app')) {
    // console.log('[Service Worker] Skipping cache for API request:', event.request.url);
    return;
  }

  // console.log('[Service Worker] Fetching:', event.request.url);
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          // console.log('[Service Worker] Returning from Cache:', event.request.url);
          return response;
        }

        // Cache miss - fetch from network
        // console.log('[Service Worker] Fetching from Network:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Başarılı yanıt geldiyse, yanıtı cache'e ekle ve döndür
            if (networkResponse && networkResponse.ok) {
              // console.log('[Service Worker] Caching new resource:', event.request.url);
              const responseToCache = networkResponse.clone(); // Yanıtı klonla (stream bir kere okunabilir)
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            } else {
                 // Başarısız yanıtı cache'leme
                 console.warn('[Service Worker] Network request failed, not caching:', event.request.url, networkResponse.status);
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] Fetch failed; returning offline page instead.', error);
            // İnternet yoksa ve cache'de de yoksa, basit bir offline sayfası gösterilebilir.
            // Şimdilik sadece hatayı loglayıp undefined döndürelim.
            // return caches.match('/offline.html'); // Eğer bir offline.html varsa
          });
      })
  );
}); 