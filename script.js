const earthquakeList = document.getElementById('earthquake-list');
const themeToggleButton = document.getElementById('theme-toggle');
const mapElement = document.getElementById('map'); // Harita elementi
const magnitudeFilter = document.getElementById('magnitude-filter'); // Filtre input
const magnitudeValueSpan = document.getElementById('magnitude-value'); // Filtre değer span
const distanceFilter = document.getElementById('distance-filter'); // Mesafe filtresi input
const distanceValueSpan = document.getElementById('distance-value'); // Mesafe değer span
const sortBySelect = document.getElementById('sort-by'); // Sıralama ölçütü
const sortOrderSelect = document.getElementById('sort-order'); // Sıralama yönü
const sourceRadios = document.querySelectorAll('input[name="source"]'); // Kaynak radio butonları
const chartCanvas = document.getElementById('earthquake-chart').getContext('2d'); // Grafik canvas
const datePicker = document.getElementById('earthquake-date'); // Tarih seçici
const mapContainer = document.getElementById('map');
const loadingIndicator = document.getElementById('loading'); // Yükleniyor göstergesi
const errorContainer = document.getElementById('error-message'); // Hata mesajı alanı
const modal = document.getElementById('earthquake-modal'); // Modal
const modalBody = document.getElementById('modal-body'); // Modal içeriği
const closeModalButton = document.querySelector('.close-button'); // Kapatma butonu
const notificationPermissionButton = document.getElementById('request-notification-permission'); // Bildirim izin butonu
const enableNotificationsCheckbox = document.getElementById('enable-notifications'); // Bildirim etkinleştirme checkbox'ı
const notificationMagnitudeInput = document.getElementById('notification-magnitude'); // Bildirim büyüklük ayarı
const notificationMagnitudeValueSpan = document.getElementById('notification-magnitude-value'); // Bildirim büyüklük değeri span'ı

// API URL'leri
const afadApiUrl = 'https://deprem-api.vercel.app/?type=afad';
const kandilliLiveApiUrl = 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live';
const kandilliArchiveBaseUrl = 'https://api.orhanaydogdu.com.tr/deprem/kandilli/archive'; // /YYYY-MM-DD eklenecek

let userLocation = null; // Kullanıcı konumu global değişkende tutulacak
let map = null; // Harita objesi
let earthquakeLayerGroup = null; // Artık MarkerClusterGroup olacak
let userMarker = null;
let currentMinMagnitude = 1.0;
let currentMaxDistance = 1000; // Başlangıç filtre değeri (1000 = Tümü)
let currentSortBy = 'date'; // Başlangıç sıralama ölçütü
let currentSortOrder = 'desc'; // Başlangıç sıralama yönü
let currentDataSource = 'kandilli'; // Başlangıç kaynak
let currentDate = null; // Seçili tarih (YYYY-MM-DD formatında veya null)
let allEarthquakes = [];
let earthquakeMarkers = {};
let earthquakeChart = null; // Grafik objesi referansı
let currentApiSource = 'kandilli'; // Başlangıç API kaynağı
let currentSortCriteria = 'timestamp';
let currentMagnitudeFilter = 0;
let currentDistanceFilter = 2000; // Varsayılan maks mesafe (veya uygun bir değer)
let selectedDate = null; // Seçili tarih (geçmiş veriler için)
let pollingIntervalId = null; // Otomatik yenileme ID'si
let lastCheckedTimestamp = 0; // Bildirimler için son kontrol zamanı
let notificationPermission = 'default'; // Bildirim izni durumu (default, granted, denied)
let notificationsEnabled = true; // Bildirimler varsayılan olarak etkin
let minNotificationMagnitude = 4.0; // Varsayılan min bildirim büyüklüğü

// Harita Başlatma Fonksiyonu
function initializeMap() {
    if (map) return;

    // Farklı harita katmanları tanımla
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        // maxZoom: 18 // Uydu katmanı için zoom seviyesi ayarlanabilir
    });

    // Varsayılan katman
    map = L.map(mapElement, {
        center: [39.0, 35.0],
        zoom: 5,
        layers: [osmLayer] // Başlangıçta OSM katmanını yükle
    });

    // Katman kontrolü ekle
    const baseMaps = {
        "Sokak": osmLayer,
        "Uydu": satelliteLayer
    };

    L.control.layers(baseMaps).addTo(map);

    // İşaretçi gruplama için MarkerClusterGroup kullan
    earthquakeLayerGroup = L.markerClusterGroup({ // L.layerGroup() yerine
         maxClusterRadius: 60, // Gruplama yarıçapı
         disableClusteringAtZoom: 9 // Bu zoom seviyesinde gruplamayı kapat
    });
    map.addLayer(earthquakeLayerGroup); // Grubu haritaya ekle

    console.log('Harita başlatıldı (Katmanlar ve Clustering ile).');
}

// Tema Yükleme Fonksiyonu
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleButton.textContent = 'Açık Tema';
    } else {
        document.body.classList.remove('dark-theme');
        themeToggleButton.textContent = 'Koyu Tema';
    }
}

// Tema Değiştirme Fonksiyonu
function toggleTheme() {
    let currentTheme = 'light';
    if (document.body.classList.contains('dark-theme')) {
        // Koyu temadan açık temaya geç
        currentTheme = 'light';
    } else {
        // Açık temadan koyu temaya geç
        currentTheme = 'dark';
    }
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
}

// Grafik Başlatma Fonksiyonu
function initializeChart() {
    if (earthquakeChart) earthquakeChart.destroy(); // Varsa eski grafiği yok et

    earthquakeChart = new Chart(chartCanvas, {
        type: 'line', // Çizgi grafik
        data: {
            labels: [], // Deprem zamanları (veya indexleri)
            datasets: [{
                label: 'Deprem Büyüklüğü (ML)',
                data: [], // Büyüklükler
                borderColor: 'rgba(211, 47, 47, 1)', // Kırmızı tonu
                backgroundColor: 'rgba(211, 47, 47, 0.2)',
                borderWidth: 1.5,
                tension: 0.1, // Hafif eğim
                pointBackgroundColor: 'rgba(211, 47, 47, 1)',
                pointRadius: 3,
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Büyüklük (ML)'
                    }
                },
                x: {
                     title: {
                        display: true,
                        text: 'Zaman (En Yeni -> En Eski)'
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Tek veri seti olduğu için legend'ı gizle
                },
                 tooltip: {
                     callbacks: {
                        // Tooltip'te ek bilgi gösterme (opsiyonel)
                        // label: function(context) {
                        //     let label = context.dataset.label || '';
                        //     // ... context.raw kullanarak ilgili deprem bilgisini allEarthquakes'dan bulup ekle ...
                        //     return label;
                        // }
                    }
                 }
            }
        }
    });
     console.log('Grafik başlatıldı.');
}

// Grafik Güncelleme Fonksiyonu
function updateChart(earthquakes) {
    if (!earthquakeChart) return;

    const chartData = earthquakes.slice(0, 15).reverse();

    earthquakeChart.data.labels = chartData.map(eq => getDateString(eq).substring(11)); // getDateString kullan
    earthquakeChart.data.datasets[0].data = chartData.map(eq => getMagnitude(eq) || 0); // getMagnitude kullan
    earthquakeChart.update();
}

// --- Yardımcı Fonksiyonlar ---

// Debounce fonksiyonu
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- Sayfa Yükleme ve Olay Dinleyicileri ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let initialTheme = 'light';
    if (savedTheme) {
        initialTheme = savedTheme;
    } else if (prefersDark) {
        initialTheme = 'dark';
    }
    applyTheme(initialTheme);

    themeToggleButton.addEventListener('click', toggleTheme);

    // Haritayı başlat
    initializeMap();

    // Kontrollerin başlangıç değerleri ve dinleyiciler
    sourceRadios.forEach(radio => {
        if (radio.checked) {
            currentDataSource = radio.value;
            toggleDatePickerVisibility(); // Başlangıçta tarih seçiciyi ayarla
        }
        radio.addEventListener('change', handleSourceChange);
    });

    datePicker.addEventListener('change', handleDateChange);

    currentMinMagnitude = parseFloat(magnitudeFilter.value);
    magnitudeValueSpan.textContent = currentMinMagnitude.toFixed(1);
    currentMaxDistance = parseFloat(distanceFilter.value);
    distanceValueSpan.textContent = currentMaxDistance >= 1000 ? 'Tümü' : `${currentMaxDistance} km`;
    currentSortBy = sortBySelect.value;
    currentSortOrder = sortOrderSelect.value;

    // Dinleyicileri Ayarla
    if (magnitudeFilter) {
        magnitudeFilter.addEventListener('input', handleFilterChange);
    }
    if (distanceFilter) {
        distanceFilter.addEventListener('input', handleDistanceFilterChange);
    }
    if (sortBySelect) {
        sortBySelect.addEventListener('change', handleSortChange);
    }
    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', handleSortChange);
    }

    // Başlangıçta hata ve yükleniyor göstergelerini gizle
    loadingIndicator.style.display = 'none';
    errorContainer.style.display = 'none';

    // Bildirim Ayarlarını Yükle
    loadNotificationSettings();

    // Bildirim Desteğini ve İzin Durumunu Kontrol Et
    checkNotificationSupportAndStatus();

    // Bildirim Olay Dinleyicileri
    // Buton null olabilir, kontrol ekleyelim
    if (notificationPermissionButton) {
        notificationPermissionButton.addEventListener('click', requestNotificationPermission);
    }

    // Checkbox null olabilir
    if (enableNotificationsCheckbox) {
        enableNotificationsCheckbox.addEventListener('change', (e) => {
            notificationsEnabled = e.target.checked;
            // Range input null olabilir
            if (notificationMagnitudeInput) {
                 notificationMagnitudeInput.disabled = !notificationsEnabled;
            }
            saveNotificationSettings();
        });
    }

    // Range input null olabilir
    if (notificationMagnitudeInput) {
        notificationMagnitudeInput.addEventListener('input', (e) => {
            minNotificationMagnitude = parseFloat(e.target.value);
            // Span null olabilir
            if (notificationMagnitudeValueSpan) {
                notificationMagnitudeValueSpan.textContent = minNotificationMagnitude.toFixed(1);
            }
        });
        // 'change' olayını da kontrol edelim
        notificationMagnitudeInput.addEventListener('change', () => {
            saveNotificationSettings();
        });
    }

    // Grafiği başlat ve ilk veriyi çek
    initializeChart();
    fetchEarthquakes();
});

// Tarih Seçicinin Görünürlüğünü Ayarla
function toggleDatePickerVisibility() {
    if (currentDataSource === 'kandilli') {
        document.body.classList.add('kandilli-selected');
    } else {
        document.body.classList.remove('kandilli-selected');
        // AFAD seçilince tarihi sıfırla ve bugünün verisini çek
        if(currentDate !== null) {
            currentDate = null;
            datePicker.value = ''; // Tarih inputunu temizle
             allEarthquakes = []; // Eski veriyi temizle
             fetchEarthquakes();
        }
    }
}

// Kaynak Değişikliğini Yönet
function handleSourceChange(event) {
    currentDataSource = event.target.value;
    console.log('Veri Kaynağı Değiştirildi:', currentDataSource);
    toggleDatePickerVisibility();
    allEarthquakes = [];
    fetchEarthquakes();
}

// Tarih Değişikliğini Yönet
function handleDateChange(event) {
    currentDate = event.target.value; // YYYY-MM-DD formatında
    console.log('Tarih Değiştirildi:', currentDate);
    allEarthquakes = [];
    fetchEarthquakes();
}

// Filtre Değişikliğini Yönet (Büyüklük)
function handleFilterChange(event) {
    // Input null olabilir, kontrol edelim
    if (!event || !event.target || !magnitudeValueSpan) return;
    currentMinMagnitude = parseFloat(event.target.value);
    magnitudeValueSpan.textContent = currentMinMagnitude.toFixed(1);
    // Filtrelemeyi debounce ile uygula
    debouncedFilterAndDisplay();
}

// Mesafe Filtresi Değişikliğini Yönet
function handleDistanceFilterChange(event) {
    // Input null olabilir, kontrol edelim
    if (!event || !event.target || !distanceValueSpan) return;
    currentMaxDistance = parseFloat(event.target.value);
    distanceValueSpan.textContent = currentMaxDistance >= 1000 ? 'Tümü' : `${currentMaxDistance} km`;
     // Filtrelemeyi debounce ile uygula
     debouncedFilterAndDisplay();
}

// Sıralama Değişikliğini Yönet
function handleSortChange() {
    // Select elementleri null olabilir
    if (!sortBySelect || !sortOrderSelect) return;
    currentSortBy = sortBySelect.value;
    currentSortOrder = sortOrderSelect.value;
    // Sıralama yönü etiketini güncelle (Tarih için)
    if (currentSortBy === 'date') {
        sortOrderSelect.options[0].text = 'En Yeni';
        sortOrderSelect.options[1].text = 'En Eski';
    } else {
        sortOrderSelect.options[0].text = 'En Büyük';
        sortOrderSelect.options[1].text = 'En Küçük';
    }
    // Sıralama anında uygulanır, debounce'a gerek yok
    filterAndDisplayData();
}

// Veriyi Filtrele ve Sırala ve Göster
function filterAndDisplayData() {
    // 1. Büyüklük Filtrele
    let processedEarthquakes = allEarthquakes.filter(eq => (getMagnitude(eq) || 0) >= currentMinMagnitude);

    // 2. Mesafe Filtrele
    if (userLocation && currentMaxDistance < 1000) {
        processedEarthquakes = processedEarthquakes.filter(eq => {
            const coords = getCoordinates(eq);
            if (coords) {
                const distance = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lon);
                eq.calculated_distance = distance;
                return distance <= currentMaxDistance;
            } else {
                eq.calculated_distance = Infinity;
                return false;
            }
        });
    } else {
        processedEarthquakes.forEach(eq => eq.calculated_distance = null);
    }

    // 3. Sırala
    processedEarthquakes.sort((a, b) => {
        let comparison = 0;
        if (currentSortBy === 'magnitude') {
            comparison = (getMagnitude(a) || 0) - (getMagnitude(b) || 0);
        } else { // date
            comparison = (getTimestamp(a) || 0) - (getTimestamp(b) || 0);
        }
        return currentSortOrder === 'desc' ? comparison * -1 : comparison;
    });

    displayEarthquakes(processedEarthquakes);
    updateMapMarkers(processedEarthquakes);
    updateChart(processedEarthquakes);
}

// Debounce edilmiş filtreleme fonksiyonu (300ms gecikme)
const debouncedFilterAndDisplay = debounce(filterAndDisplayData, 300);

// ---- API Bağımsız Veri Erişim Fonksiyonları ----
function getMagnitude(eq) {
    // Kandilli (orhanayd): eq.mag
    // AFAD (emirkabal): eq.size?.ml
    return eq.mag ?? eq.size?.ml; // Öncelik Kandilli'de (geçmiş veri için)
}

function getCoordinates(eq) {
    // Kandilli (orhanayd): eq.geojson?.coordinates -> [lon, lat]
    // AFAD (emirkabal): eq.latitude, eq.longitude
    if (eq.geojson?.coordinates) {
        return { lat: eq.geojson.coordinates[1], lon: eq.geojson.coordinates[0] };
    } else if (eq.latitude && eq.longitude) {
        return { lat: eq.latitude, lon: eq.longitude };
    }
    return null;
}

function getTimestamp(eq) {
    // Kandilli (orhanayd): eq.created_at (unix)
    // AFAD (emirkabal): eq.timestamp (unix)
    return eq.created_at ?? eq.timestamp;
}

function getLocationTitle(eq) {
     // Kandilli (orhanayd): eq.title
    // AFAD (emirkabal): eq.location
    return eq.title ?? eq.location ?? 'Konum Bilgisi Yok';
}

function getDepth(eq) {
    // İkisi de eq.depth kullanıyor gibi ama kontrol edelim
    return eq.depth !== undefined ? eq.depth : '-';
}

function getDateString(eq) {
    // İkisi de eq.date kullanıyor gibi
    return eq.date || '-';
}

function getEarthquakeId(eq, source) {
    // Kandilli (orhanayd): eq.earthquake_id
    // AFAD (emirkabal): Yok, geçici oluştur
    return eq.earthquake_id ?? `${getTimestamp(eq)}-${source}-${getMagnitude(eq)}`; // Kandilli ID'si varsa onu kullan
}
// ----------------------------------------------

// Haversine formülü ile mesafe hesaplama
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Mesafe (km)
    return distance;
}

// Kullanıcı Konumunu Alma
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (userLocation) { // Eğer konum zaten alınmışsa tekrar isteme
            resolve(userLocation);
            return;
        }
        if (!navigator.geolocation) {
            reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log('Kullanıcı konumu alındı:', userLocation);

                // Kullanıcı işaretçisini haritaya ekle (veya güncelle)
                if (map) {
                    if (userMarker) {
                        userMarker.setLatLng([userLocation.latitude, userLocation.longitude]);
                    } else {
                        userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
                            // Özel ikon kullanabiliriz, şimdilik varsayılan
                            // icon: L.icon({ iconUrl: 'path/to/user-icon.png', ... })
                        })
                        .bindPopup('Sizin Konumunuz')
                        .addTo(map);
                    }
                    // İlk konum alındığında haritayı kullanıcıya ortala (isteğe bağlı)
                    // map.setView([userLocation.latitude, userLocation.longitude], 10);
                }
                resolve(userLocation);
            },
            (error) => {
                let errorMessage = 'Konum alınamadı.';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Konum izni verilmedi.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Konum bilgisi mevcut değil.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Konum alma isteği zaman aşımına uğradı.";
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = "Bilinmeyen bir hata oluştu.";
                        break;
                }
                console.error('Konum hatası:', errorMessage);
                // Hata durumunda bile devam etmesi için null resolve edilebilir veya reject kullanılabilir.
                // Şimdilik null ile devam edelim, mesafe gösterilmez.
                resolve(null);
                // reject(new Error(errorMessage)); // Hata fırlatmak istenirse
            }
        );
    });
}

async function fetchEarthquakes() {
    // Yükleniyor durumunu göster, eski hataları temizle
    loadingIndicator.style.display = 'block'; // Göstergeyi göster
    errorContainer.style.display = 'none'; // Eski hatayı gizle
    errorContainer.textContent = ''; // Hata mesajını temizle
    earthquakeList.innerHTML = ''; // Listeyi temizle (Yükleniyor yazısı yerine gösterge var)
    earthquakeList.classList.remove('loading-text'); // Varsa eski classı kaldır
    // Haritayı temizlemek opsiyonel, belki eski işaretçiler kalsa daha iyi?
    // if(earthquakeLayerGroup) earthquakeLayerGroup.clearLayers();

    const locationPromise = getUserLocation(); // Konum alma paralel başlasın

    // API URL'sini belirle
    let apiUrl;
    let isOrhanAydAPI = false; // Hangi API'nin kullanıldığını takip et
    if (currentDataSource === 'kandilli') {
        isOrhanAydAPI = true;
        if (currentDate) {
            apiUrl = `${kandilliArchiveBaseUrl}/${currentDate}`;
        } else {
            apiUrl = kandilliLiveApiUrl;
        }
    } else { // AFAD
        isOrhanAydAPI = false;
        apiUrl = afadApiUrl;
    }
    // console.log(`Fetching data from: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            // API özelinde hata mesajı (varsa)
            let errorDetail = '';
            try {
                 const errorData = await response.json();
                 // API'ye özgü hata mesajlarını yakalamaya çalış
                 errorDetail = errorData.desc || errorData.message || errorData.error || response.statusText;
            } catch (e) { errorDetail = response.statusText; }
            throw new Error(`API Hatası (${response.status}): ${errorDetail}`);
        }
        const data = await response.json();

        await locationPromise; // Konumun alınmasını bekle

        // Gelen veriyi işle (API yapısına göre)
        let earthquakesRaw = [];
        if (isOrhanAydAPI) {
            if (data && data.status && data.result) {
                 earthquakesRaw = data.result;
            } else if (data && !data.status && data.desc === 'Bu tarihe ait veri bulunamadı.') {
                 console.log('Seçilen tarih için veri yok.');
            } else if (data && data.http_status === 404 && data.desc === "Arşiv bulunamadı.") { // Arşiv yok hatası
                 console.log('Seçilen tarih için Kandilli arşivi bulunamadı.');
            } else {
                 console.warn('Beklenmeyen Kandilli API yanıtı:', data);
            }
        } else { // Emirkabal (AFAD)
            if (data && data.earthquakes) {
                earthquakesRaw = data.earthquakes;
            } else {
                 console.warn('Beklenmeyen AFAD API yanıtı:', data);
            }
        }

        // Veri işlendikten sonra yükleniyor göstergesini gizle
        loadingIndicator.style.display = 'none';

        if (earthquakesRaw.length > 0) {
            const currentTimestamp = Date.now(); // Mevcut zamanı al

            // Yeni depremleri bul (bildirim için)
            const newEarthquakes = earthquakesRaw.filter(eq => {
                const eqTimestamp = getTimestamp(eq) * 1000; // API'den gelen saniye cinsinden ise ms'ye çevir
                // API yanıtına göre kontrol et: orhanayd 'created_at', emirkabal 'timestamp'
                return eqTimestamp > lastCheckedTimestamp;
            });

            // console.log(`Son kontrol: ${new Date(lastCheckedTimestamp)}, Yeni deprem sayısı: ${newEarthquakes.length}`);

            if (lastCheckedTimestamp > 0 && newEarthquakes.length > 0 && notificationsEnabled && notificationPermission === 'granted') { // Etkinlik ve izin kontrolü eklendi
                // Bildirim gönderme mantığı
                newEarthquakes.forEach(eq => {
                    const magnitude = getMagnitude(eq);
                    // Kullanıcının belirlediği eşik değeri kullan
                    if (magnitude >= minNotificationMagnitude) {
                        const title = `${magnitude.toFixed(1)} Büyüklüğünde Deprem`;
                        const body = `${getLocationTitle(eq)}`;
                        showNotification(title, body);
                        console.log(`Bildirim Gönderildi (Min ${minNotificationMagnitude.toFixed(1)}):`, title, body);
                    }
                });
            }

            // Son kontrol zamanını güncelle (en yeni depremin zamanı olabilir veya mevcut zaman)
            if (earthquakesRaw.length > 0) {
                 const latestTimestamp = Math.max(...earthquakesRaw.map(eq => (getTimestamp(eq) || 0) * 1000));
                 // Eğer API çok eski veri döndürürse diye mevcut zamanla karşılaştır
                 lastCheckedTimestamp = Math.max(lastCheckedTimestamp, latestTimestamp, currentTimestamp - 60000); // Son 1dk içinde gelmişse bile yakala
            } else {
                 lastCheckedTimestamp = currentTimestamp;
            }

            // ID'leri ekleyerek allEarthquakes'i oluştur
            allEarthquakes = earthquakesRaw.map((eq, index) => ({ ...eq, internal_id: getEarthquakeId(eq, currentDataSource) }));
            filterAndDisplayData(); // Filtrele, sırala ve göster
        } else {
            // Veri yoksa
            allEarthquakes = [];
            earthquakeList.innerHTML = '<div class="loading-text">Gösterilecek deprem verisi bulunamadı.</div>'; // Liste alanında mesaj göster
            earthquakeList.classList.add('loading-text');
            if(earthquakeLayerGroup) earthquakeLayerGroup.clearLayers(); // Haritayı temizle
             if(earthquakeChart) updateChart([]); // Grafiği temizle
            lastCheckedTimestamp = Date.now(); // Veri olmasa da zamanı güncelle
        }

    } catch (error) {
        console.error('Deprem verileri alınırken hata oluştu:', error);
        loadingIndicator.style.display = 'none'; // Hata durumunda da göstergeyi gizle
        allEarthquakes = [];
        earthquakeList.innerHTML = ''; // Listeyi temizle
        if(earthquakeLayerGroup) earthquakeLayerGroup.clearLayers(); // Haritayı temizle
        if(earthquakeChart) updateChart([]); // Grafiği temizle
        // Hata mesajını göster
        errorContainer.textContent = `Hata: ${error.message}. Lütfen tekrar deneyin veya farklı bir kaynak/tarih seçin.`;
        errorContainer.style.display = 'block';
        lastCheckedTimestamp = Date.now(); // Hata olsa da zamanı güncelle
    }
}

function displayEarthquakes(earthquakes) {
    earthquakeList.innerHTML = '';
    earthquakeList.classList.remove('loading-text');

    earthquakes.forEach((eq, index) => { // index'i de alalım (ID için)
        const item = document.createElement('div');
        item.classList.add('earthquake-item');

        // ID ve koordinatları ekle
        item.dataset.id = eq.internal_id; // Oluşturulan internal_id'yi kullan
        const coords = getCoordinates(eq);
        if (coords) {
            item.dataset.lat = coords.lat;
            item.dataset.lon = coords.lon;
            item.style.cursor = 'pointer';
            item.addEventListener('click', handleListItemClick);
        }

        // Bilgi Bölümü
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('info');

        const location = document.createElement('span');
        location.classList.add('location');
        location.textContent = getLocationTitle(eq);

        const depth = document.createElement('span');
        depth.classList.add('depth');
        depth.textContent = `Derinlik: ${getDepth(eq)} km`;

        // Mesafe Bilgisi (Artık filtrelemede hesaplanıyor, varsa göster)
        const distanceSpan = document.createElement('span');
        distanceSpan.classList.add('distance');
        if (eq.calculated_distance !== null && eq.calculated_distance !== Infinity) {
            distanceSpan.textContent = `Mesafe: ~${Math.round(eq.calculated_distance)} km`;
            distanceSpan.style.fontWeight = 'bold';
        }

        infoDiv.appendChild(location);
        infoDiv.appendChild(depth);
        if (distanceSpan.textContent) {
            infoDiv.appendChild(distanceSpan);
        }

        const date = document.createElement('span');
        date.classList.add('date');
        date.textContent = `Tarih: ${getDateString(eq)}`;

        infoDiv.appendChild(date);

        // Büyüklük Bölümü
        const magnitudeDiv = document.createElement('div');
        magnitudeDiv.classList.add('magnitude-container');

        const magnitude = document.createElement('span');
        magnitude.classList.add('magnitude');
        const magValue = getMagnitude(eq) || 0;
        magnitude.textContent = magValue > 0 ? magValue.toFixed(1) : '-';

        magnitudeDiv.appendChild(magnitude);

        item.appendChild(infoDiv);
        item.appendChild(magnitudeDiv);

        earthquakeList.appendChild(item);
    });

    if (earthquakes.length === 0) {
        earthquakeList.innerHTML = '<div class="loading-text">Filtreye veya sıralamaya uygun deprem bulunamadı.</div>';
        earthquakeList.classList.add('loading-text');
    }
}

// Liste Öğesi Tıklama İşleyicisi
function handleListItemClick(event) {
    const listItem = event.target.closest('.earthquake-item');
    if (!listItem || !map) return;

    const lat = listItem.dataset.lat;
    const lon = listItem.dataset.lon;
    const eqId = listItem.dataset.id; // Geçici ID'yi kullan

    if (lat && lon) {
        map.setView([parseFloat(lat), parseFloat(lon)], 10);
        if (eqId && earthquakeMarkers[eqId]) {
            earthquakeMarkers[eqId].openPopup();
        }
    }
}

// Harita İşaretçilerini Güncelleme Fonksiyonu
function updateMapMarkers(earthquakes) {
    if (!map || !earthquakeLayerGroup) {
        console.error('Harita veya katman grubu başlatılamadı.');
        return;
    }

    earthquakeLayerGroup.clearLayers();
    earthquakeMarkers = {};

    const markers = [];
    earthquakes.forEach((eq, index) => {
        const coords = getCoordinates(eq);
        if (coords) {
            const lat = coords.lat;
            const lon = coords.lon;
            const mag = getMagnitude(eq) || 0;
            const title = getLocationTitle(eq);
            const eqId = eq.internal_id; // internal_id kullan

            let markerColor = 'blue';
            let markerRadius = 5 + mag * 1.5;
            if (mag >= 4.0) markerColor = 'red';
            else if (mag >= 3.0) markerColor = 'orange';

            const marker = L.circleMarker([lat, lon], {
                    radius: markerRadius,
                    fillColor: markerColor,
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.7
                })
                .bindPopup(`<b>${title}</b><br>Büyüklük: ${mag > 0 ? mag.toFixed(1) : 'N/A'}`);

            markers.push(marker);
            if(eqId) {
                 earthquakeMarkers[eqId] = marker;
            }
        }
    });

    earthquakeLayerGroup.addLayers(markers);
}

// Sayfa yüklendiğinde ve her 10 saniyede bir verileri yenile
fetchEarthquakes();
setInterval(fetchEarthquakes, 10 * 1000); // 10 saniye

// --- Modal Fonksiyonları ---

function openModal(earthquake) {
    if (!earthquake) return; // Deprem verisi yoksa çık

    const source = currentApiSource; // Mevcut kaynağı al

    const magnitude = getMagnitude(earthquake) || 0;
    const depth = getDepth(earthquake) || 0;
    const location = getLocationTitle(earthquake) || 'N/A';
    const timestamp = getTimestamp(earthquake);
    const formattedDate = timestamp ? new Date(timestamp).toLocaleString() : 'N/A';
    const coordinates = getCoordinates(earthquake);
    const lat = coordinates ? coordinates.lat?.toFixed(4) : 'N/A';
    const lon = coordinates ? coordinates.lon?.toFixed(4) : 'N/A';

    modalBody.innerHTML = `
        <p><strong>Lokasyon:</strong> ${location}</p>
        <p><strong>Büyüklük (ML):</strong> ${magnitude.toFixed(1)}</p>
        <p><strong>Derinlik:</strong> ${depth.toFixed(1)} km</p>
        <p><strong>Tarih ve Saat:</strong> ${formattedDate}</p>
        <p><strong>Enlem:</strong> ${lat}</p>
        <p><strong>Boylam:</strong> ${lon}</p>
    `;
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    modalBody.innerHTML = ''; // İçeriği temizle
}

// Kapatma butonuna tıklanınca modalı kapat
closeModalButton.onclick = closeModal;

// Modal dışına tıklanınca modalı kapat
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

// Harita tile katmanını tema değişikliğine göre günceller
function updateMapTileLayer(isDarkMode) {
    if (!map) return;

    // Mevcut tile katmanını kaldır
    map.eachLayer(function (layer) {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    // Yeni tile katmanını ekle
    const tileUrl = isDarkMode ?
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : // Karanlık tema için CartoDB Dark Matter
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // Açık tema için OpenStreetMap
    const attribution = isDarkMode ?
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' :
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 18, // Gerekirse ayarlayın
    }).addTo(map);
}

// --- Ayarları Yükleme/Kaydetme ---
function saveNotificationSettings() {
    try {
        localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
        localStorage.setItem('minNotificationMagnitude', minNotificationMagnitude);
        // console.log('Bildirim ayarları kaydedildi.');
    } catch (e) {
        console.error("'LocalStorage'a bildirim ayarları kaydedilemedi:", e);
    }
}

function loadNotificationSettings() {
    try {
        const savedEnabled = localStorage.getItem('notificationsEnabled');
        const savedMagnitude = localStorage.getItem('minNotificationMagnitude');

        if (savedEnabled !== null) {
            notificationsEnabled = JSON.parse(savedEnabled);
        }
        if (savedMagnitude !== null) {
            minNotificationMagnitude = parseFloat(savedMagnitude);
        }

        // UI elementlerini yüklenen ayarlara göre güncelle
        enableNotificationsCheckbox.checked = notificationsEnabled;
        notificationMagnitudeInput.value = minNotificationMagnitude;
        notificationMagnitudeValueSpan.textContent = minNotificationMagnitude.toFixed(1);

        // console.log('Bildirim ayarları yüklendi.');

    } catch (e) {
        console.error("'LocalStorage'dan bildirim ayarları okunamadı:", e);
        // Hata durumunda varsayılan değerler zaten ayarlı
    }
}

// Bildirim desteğini ve durumunu kontrol et, butonu ayarla
function checkNotificationSupportAndStatus() {
    if (!('Notification' in window)) {
        console.warn('Tarayıcı bildirimleri desteklemiyor.');
        notificationPermissionButton.textContent = 'Bildirimler Desteklenmiyor';
        notificationPermissionButton.disabled = true;
        return;
    }

    notificationPermission = Notification.permission;
    updateNotificationButtonState();
}

// Bildirim izin butonu durumunu ve ayar alanını güncelle
function updateNotificationButtonState() {
    if (!notificationPermissionButton || !notificationMagnitudeInput || !enableNotificationsCheckbox) return;

    const settingsDisabled = (notificationPermission !== 'granted' || !notificationsEnabled);
    notificationMagnitudeInput.disabled = settingsDisabled;
    // enableNotificationsCheckbox.disabled = (notificationPermission !== 'granted'); // İzin yoksa etkinleştirmeyi de kapatabiliriz

    if (notificationPermission !== 'granted') {
        // İzin yoksa veya engellenmişse
        notificationPermissionButton.disabled = (notificationPermission === 'denied'); // Engellenmişse butonu tamamen disable et
        notificationPermissionButton.textContent = (notificationPermission === 'denied') ? 'Bildirimler Engellendi' : 'Bildirimlere İzin Ver';
         enableNotificationsCheckbox.checked = false; // İzin yoksa etkinleştirme kutusunu kapat
         notificationsEnabled = false; // State'i de güncelle
         notificationMagnitudeInput.disabled = true; // Ayarı da disable et
         saveNotificationSettings(); // Durumu kaydet
    } else {
        // İzin verilmişse
        notificationPermissionButton.textContent = 'Bildirimlere İzin Verildi';
        notificationPermissionButton.disabled = true;
        // Checkbox ve range input'un durumu sadece notificationsEnabled'a bağlı
        enableNotificationsCheckbox.disabled = false;
        notificationMagnitudeInput.disabled = !notificationsEnabled;
    }
}

// Bildirim izni isteme fonksiyonu
async function requestNotificationPermission() {
    if (!('Notification' in window)) return; // Destek yoksa çık

    try {
        const permissionResult = await Notification.requestPermission();
        notificationPermission = permissionResult;
        updateNotificationButtonState();
        if (permissionResult === 'granted') {
            console.log('Bildirim izni verildi.');
            // İzin verilince belki bir test bildirimi gönderilebilir (opsiyonel)
             // showNotification('Test Bildirimi', 'Bildirim izni başarıyla alındı!');
        } else if (permissionResult === 'denied') {
            console.log('Bildirim izni reddedildi.');
            alert('Bildirimler engellendi. Tarayıcı ayarlarından izin vermeniz gerekebilir.');
        } else {
            console.log('Bildirim izni isteği kapatıldı.');
        }
    } catch (error) {
        console.error('Bildirim izni istenirken hata:', error);
    }
}

// Bildirim gösterme fonksiyonu
function showNotification(title, body) {
    if (notificationPermission !== 'granted' || !notificationsEnabled) return;

    new Notification(title, { body: body, icon: './earthquake-icon.png' });
} 