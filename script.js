const earthquakeList = document.getElementById('earthquake-list');
const themeToggleButton = document.getElementById('theme-toggle');
const mapElement = document.getElementById('map'); // Harita elementi
const magnitudeFilter = document.getElementById('magnitude-filter'); // Filtre input
const magnitudeValueSpan = document.getElementById('magnitude-value'); // Filtre değer span
const distanceFilter = document.getElementById('distance-filter'); // Mesafe filtresi input
const distanceValueSpan = document.getElementById('distance-value'); // Mesafe değer span
const depthFilter = document.getElementById('depth-filter'); // Derinlik filtresi input
const depthValueSpan = document.getElementById('depth-value'); // Derinlik değer span
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
const enableNotificationsCheckbox = document.getElementById('enable-notifications'); // Eski, kaldırılacak?
const notificationMagnitudeInput = document.getElementById('notification-magnitude'); // Bildirim büyüklük ayarı
const notificationMagnitudeValueSpan = document.getElementById('notification-magnitude-value'); // Bildirim büyüklük değeri span'ı
const enableDistanceNotificationCheckbox = document.getElementById('enable-distance-notification'); // Eski, kaldırılacak?
const notificationDistanceSettingDiv = document.querySelector('.notification-distance-setting'); // Mesafe ayar div'i
const notificationDistanceInput = document.getElementById('notification-distance'); // Mesafe bildirim ayarı
const notificationDistanceValueSpan = document.getElementById('notification-distance-value'); // Mesafe bildirim değeri span'ı
const downloadCsvButton = document.getElementById('download-csv'); // CSV İndirme Butonu
const downloadJsonButton = document.getElementById('download-json'); // JSON İndirme Butonu
// Yeni Buton Referansları
const toggleNotificationsBtn = document.getElementById('toggle-notifications-btn');
const toggleNearbyOnlyBtn = document.getElementById('toggle-nearby-only-btn');

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
let currentMaxDepth = 200; // Başlangıç maks derinlik filtresi (200 = Tümü)
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
let initialNotificationNeeded = false; // İlk bildirim için bayrak
let notificationPermission = 'default'; // Bildirim izni durumu (default, granted, denied)
let notificationsEnabled = true; // Bildirimler varsayılan olarak etkin
let minNotificationMagnitude = 4.0; // Varsayılan min bildirim büyüklüğü
let notificationDistanceEnabled = false; // Mesafe bildirimi varsayılan olarak kapalı
let maxNotificationDistance = 100; // Varsayılan maks bildirim mesafesi (km)
let processedEarthquakesForDownload = []; // Global değişken için işlenmiş veri

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

// --- Ayarları Yükleme/Kaydetme ---
function saveSettings() {
    try {
        // Bildirim Ayarları
        localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
        localStorage.setItem('minNotificationMagnitude', minNotificationMagnitude);
        localStorage.setItem('notificationDistanceEnabled', JSON.stringify(notificationDistanceEnabled));
        localStorage.setItem('maxNotificationDistance', maxNotificationDistance);

        // Filtre Ayarları
        localStorage.setItem('currentMinMagnitude', currentMinMagnitude);
        localStorage.setItem('currentMaxDistance', currentMaxDistance);
        localStorage.setItem('currentMaxDepth', currentMaxDepth);

        // Sıralama Ayarları
        localStorage.setItem('currentSortBy', currentSortBy);
        localStorage.setItem('currentSortOrder', currentSortOrder);

        // Kaynak Ayarı
        localStorage.setItem('currentDataSource', currentDataSource);

        // console.log('Ayarlar kaydedildi.');
    } catch (e) {
        console.error("'LocalStorage'a ayarlar kaydedilemedi:", e);
    }
}

function loadSettings() {
    try {
        // Bildirim Ayarları
        const savedEnabled = localStorage.getItem('notificationsEnabled');
        const savedMagnitude = localStorage.getItem('minNotificationMagnitude');
        const savedDistanceEnabled = localStorage.getItem('notificationDistanceEnabled');
        const savedDistance = localStorage.getItem('maxNotificationDistance');

        // Önce değerleri yükle
        if (savedEnabled !== null) notificationsEnabled = JSON.parse(savedEnabled);
        if (savedMagnitude !== null) minNotificationMagnitude = parseFloat(savedMagnitude);
        if (savedDistanceEnabled !== null) notificationDistanceEnabled = JSON.parse(savedDistanceEnabled);
        if (savedDistance !== null) maxNotificationDistance = parseFloat(savedDistance);

        // Filtre Ayarları
        const savedMinMag = localStorage.getItem('currentMinMagnitude');
        const savedMaxDist = localStorage.getItem('currentMaxDistance');
        const savedMaxDepth = localStorage.getItem('currentMaxDepth');

        if (savedMinMag !== null) currentMinMagnitude = parseFloat(savedMinMag);
        if (savedMaxDist !== null) currentMaxDistance = parseFloat(savedMaxDist);
        if (savedMaxDepth !== null) currentMaxDepth = parseFloat(savedMaxDepth);

        // Sıralama Ayarları
        const savedSortBy = localStorage.getItem('currentSortBy');
        const savedSortOrder = localStorage.getItem('currentSortOrder');

        if (savedSortBy !== null) currentSortBy = savedSortBy;
        if (savedSortOrder !== null) currentSortOrder = savedSortOrder;

        // Kaynak Ayarı
        const savedDataSource = localStorage.getItem('currentDataSource');
        if (savedDataSource !== null) currentDataSource = savedDataSource;

        // ----- UI Elementlerini Yüklenen Ayarlara Göre Güncelle ----- 
        // NOT: Bildirim butonlarının durumu (active/disabled) artık sadece
        // `updateNotificationSettingsUIState` tarafından yönetilecek.
        // Bu fonksiyon DOMContentLoaded sonunda çağrılacak ve zaten izin durumunu da biliyor olacak.

        // Bildirim slider değerlerini yükle (durumları updateUI'da ayarlanacak)
        if (notificationMagnitudeInput) {
             notificationMagnitudeInput.value = minNotificationMagnitude;
         }
        if (notificationMagnitudeValueSpan) {
            notificationMagnitudeValueSpan.textContent = minNotificationMagnitude.toFixed(1);
        }
        if (notificationDistanceInput) {
             notificationDistanceInput.value = maxNotificationDistance;
         }
        if (notificationDistanceValueSpan) {
            notificationDistanceValueSpan.textContent = maxNotificationDistance.toFixed(0);
        }

        // Filtre UI
        if (magnitudeFilter) magnitudeFilter.value = currentMinMagnitude;
        if (magnitudeValueSpan) magnitudeValueSpan.textContent = currentMinMagnitude.toFixed(1);
        if (distanceFilter) distanceFilter.value = currentMaxDistance;
        if (distanceValueSpan) distanceValueSpan.textContent = currentMaxDistance >= 1000 ? 'Tümü' : `${currentMaxDistance} km`;
        if (depthFilter) depthFilter.value = currentMaxDepth;
        if (depthValueSpan) depthValueSpan.textContent = currentMaxDepth >= 200 ? 'Tümü' : `${currentMaxDepth} km`;

        // Sıralama UI
        if (sortBySelect) sortBySelect.value = currentSortBy;
        if (sortOrderSelect) sortOrderSelect.value = currentSortOrder;
        // Sıralama etiketleri handleSortChange ile ayarlanacak

        // Kaynak UI
        sourceRadios.forEach(radio => {
            if (radio.value === currentDataSource) {
                radio.checked = true;
            }
        });
        // toggleDatePickerVisibility(); // Bu, DOMContentLoaded sonunda çağrılacak

        // console.log('Ayarlar yüklendi, UI güncellemesi DOMContentLoaded sonunda yapılacak.');

    } catch (e) {
        console.error("'LocalStorage'dan ayarlar okunamadı:", e);
    }
}

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

    // Harita katmanını da güncelle
    if (typeof updateMapTileLayer === 'function') {
        updateMapTileLayer(currentTheme === 'dark');
    }
}

// Grafik Başlatma Fonksiyonu
function initializeChart() {
    if (earthquakeChart) earthquakeChart.destroy(); // Varsa eski grafiği yok et

    // CSS değişkenlerinden renkleri al
    const style = getComputedStyle(document.documentElement);
    const lineColor = style.getPropertyValue('--chart-line-color').trim() || '#dc3545';
    const bgColor = style.getPropertyValue('--chart-bg-color').trim() || 'rgba(220, 53, 69, 0.1)';
    const gridColor = style.getPropertyValue('--chart-grid-color').trim() || 'rgba(0, 0, 0, 0.05)'; // Yeni grid rengi değişkeni
    const textColor = style.getPropertyValue('--text-color').trim() || '#333';
    const tooltipBgColor = style.getPropertyValue('--container-bg-color').trim() || '#fff';
    const fontFamily = style.getPropertyValue('font-family') || 'Inter, sans-serif'; // Fontu da alalım

    earthquakeChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Deprem Büyüklüğü (ML)',
                data: [],
                borderColor: lineColor,
                backgroundColor: bgColor,
                borderWidth: 2, // Biraz daha kalın çizgi
                tension: 0.3, // Daha yumuşak eğim
                pointRadius: 0, // Noktaları normalde gizle
                pointBackgroundColor: lineColor,
                pointBorderColor: lineColor,
                pointHoverRadius: 5, // Hover'da göster
                pointHoverBackgroundColor: tooltipBgColor, // Hover nokta içi
                pointHoverBorderColor: lineColor, // Hover nokta çerçevesi
                pointHoverBorderWidth: 2,
                fill: true // Alanı doldur
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    border: { display: false }, // Eksen çizgisini kaldır
                    grid: {
                        color: gridColor, // Daha soluk grid
                        // drawBorder: false,
                    },
                    ticks: {
                         color: textColor,
                         font: { family: fontFamily }
                    }
                },
                x: {
                    border: { display: false }, // Eksen çizgisini kaldır
                    grid: {
                         color: gridColor, // Daha soluk grid
                         // drawBorder: false,
                    },
                     ticks: {
                         color: textColor,
                         font: { family: fontFamily },
                         maxRotation: 0, // Etiketleri döndürme
                         autoSkip: true, // Otomatik atlama
                         maxTicksLimit: 7 // Maksimum etiket sayısı
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            interaction: { // Hover ve tooltip etkileşimleri
                 mode: 'index',
                 intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: tooltipBgColor,
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 10, // İç boşluk
                    caretPadding: 10, // Ok ile kutu arası boşluk
                    caretSize: 6, // Ok boyutu
                    cornerRadius: 6, // Köşe yuvarlaklığı (Sabit değer veya JS ile hesapla)
                    usePointStyle: true, // Nokta stilini kullan (legend için)
                    boxPadding: 3,
                    titleFont: { family: fontFamily, weight: '600' },
                    bodyFont: { family: fontFamily },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                 }
            }
        }
    });
}

// Grafik Güncelleme Fonksiyonu
function updateChart(earthquakes) {
    if (!earthquakeChart) return;

    const chartData = earthquakes.slice(0, 15).reverse();

    earthquakeChart.data.labels = chartData.map(eq => getDateString(eq).substring(11)); // getDateString kullan
    earthquakeChart.data.datasets[0].data = chartData.map(eq => getMagnitude(eq) || 0); // getMagnitude kullan
    earthquakeChart.update();
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
    applyTheme(initialTheme); // Temayı uygula

    themeToggleButton.addEventListener('click', toggleTheme);

    // 1. Önce Harita ve Grafiği Başlat
    initializeMap();
    initializeChart();

    // 2. Kontrolleri Ayarla
    sourceRadios.forEach(radio => {
        if (radio.checked) {
            currentDataSource = radio.value;
            toggleDatePickerVisibility();
        }
        radio.addEventListener('change', handleSourceChange);
    });
    datePicker.addEventListener('change', handleDateChange);

    // Kontroller null olabilir, kontrol ekleyerek event listener ekleyelim
    if (magnitudeFilter) {
        magnitudeFilter.addEventListener('input', handleFilterChange);
        currentMinMagnitude = parseFloat(magnitudeFilter.value);
        if (magnitudeValueSpan) magnitudeValueSpan.textContent = currentMinMagnitude.toFixed(1);
    }
    if (distanceFilter) {
        distanceFilter.addEventListener('input', handleDistanceFilterChange);
        currentMaxDistance = parseFloat(distanceFilter.value);
        if (distanceValueSpan) distanceValueSpan.textContent = currentMaxDistance >= 1000 ? 'Tümü' : `${currentMaxDistance} km`;
    }
    if (sortBySelect) {
        sortBySelect.addEventListener('change', handleSortChange);
        currentSortBy = sortBySelect.value;
    }
    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', handleSortChange);
        currentSortOrder = sortOrderSelect.value;
    }

    // 3. Bildirim Ayarları: Durumu kontrol et, ayarları YÜKLE, sonra UI'ı GÜNCELLE
    checkNotificationSupportAndStatus(); // notificationPermission set edilir
    loadSettings(); // Ayarlar yüklenir (notificationsEnabled vs.)
    updateNotificationSettingsUIState(); // Yüklenen ayarlar ve izin durumu ile UI güncellenir

    // 4. Arayüz Hazır Olduktan Sonra Konumu Al ve Veri Çek
    handleSortChange();
    toggleDatePickerVisibility();
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
    saveSettings(); // Ayarı kaydet
    allEarthquakes = [];
    fetchEarthquakes();
}

// Tarih Değişikliğini Yönet
function handleDateChange(event) {
    currentDate = event.target.value; // YYYY-MM-DD formatında
    console.log('Tarih Değiştirildi:', currentDate);
    // Tarih değişikliği ayar olarak kaydedilmez, sadece veri çekmeyi tetikler
    allEarthquakes = [];
    fetchEarthquakes();
}

// Filtre Değişikliğini Yönet (Büyüklük)
function handleFilterChange(event) {
    // Input null olabilir, kontrol edelim
    if (!event || !event.target || !magnitudeValueSpan) return;
    currentMinMagnitude = parseFloat(event.target.value);
    magnitudeValueSpan.textContent = currentMinMagnitude.toFixed(1);
    saveSettings(); // Ayarı kaydet
    // Filtrelemeyi debounce ile uygula
    debouncedFilterAndDisplay();
}

// Mesafe Filtresi Değişikliğini Yönet
function handleDistanceFilterChange(event) {
    // Input null olabilir, kontrol edelim
    if (!event || !event.target || !distanceValueSpan) return;
    currentMaxDistance = parseFloat(event.target.value);
    distanceValueSpan.textContent = currentMaxDistance >= 1000 ? 'Tümü' : `${currentMaxDistance} km`;
     saveSettings(); // Ayarı kaydet
     // Filtrelemeyi debounce ile uygula
     debouncedFilterAndDisplay();
}

// Derinlik Filtresi Değişikliğini Yönet
function handleDepthFilterChange(event) {
    if (!event || !event.target || !depthValueSpan) return;
    currentMaxDepth = parseFloat(event.target.value);
    depthValueSpan.textContent = currentMaxDepth >= 200 ? 'Tümü' : `${currentMaxDepth} km`;
    saveSettings(); // Ayarı kaydet
    // Filtrelemeyi debounce ile uygula
    debouncedFilterAndDisplay();
}

// Sıralama Değişikliğini Yönet
function handleSortChange() {
    // Select elementleri null olabilir
    if (!sortBySelect || !sortOrderSelect) return;
    currentSortBy = sortBySelect.value;
    currentSortOrder = sortOrderSelect.value;
    saveSettings(); // Ayarı kaydet

    // Sıralama yönü etiketini kritere göre güncelle
    let descText = "Azalan";
    let ascText = "Artan";

    switch (currentSortBy) {
        case 'date':
            descText = 'En Yeni';
            ascText = 'En Eski';
            break;
        case 'magnitude':
            descText = 'En Büyük';
            ascText = 'En Küçük';
            break;
        case 'depth':
            descText = 'En Derin';
            ascText = 'En Sığ';
            break;
        case 'distance':
            descText = 'En Uzak';
            ascText = 'En Yakın';
            break;
    }

    sortOrderSelect.options[0].text = descText; // desc için
    sortOrderSelect.options[1].text = ascText;  // asc için

    // Sıralama anında uygulanır, debounce'a gerek yok
    filterAndDisplayData();
}

// Veriyi Filtrele ve Sırala ve Göster
function filterAndDisplayData() {
    // 1. Büyüklük Filtrele
    let processedEarthquakes = allEarthquakes.filter(eq => (getMagnitude(eq) || 0) >= currentMinMagnitude);

    // 2. Derinlik Filtrele (Maksimum derinlik)
    if (currentMaxDepth < 200) { // Derinlik filtresi aktifse (Tümü değilse)
        processedEarthquakes = processedEarthquakes.filter(eq => {
            const depth = getDepth(eq);
            // Derinlik bilgisi varsa ve filtreden geçiyorsa tut
            return depth !== null && !isNaN(depth) && depth <= currentMaxDepth;
        });
    }

    // 3. Mesafe Hesapla ve Filtrele
    processedEarthquakes.forEach(eq => {
        const coords = getCoordinates(eq);
        if (userLocation && coords) { // Konum ve koordinat varsa
            eq.calculated_distance = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lon);
        } else { // Konum veya koordinat yoksa
            eq.calculated_distance = null; // Mesafeyi null yap
        }
    });

    if (userLocation && currentMaxDistance < 1000) { // Mesafe filtresi aktifse
        processedEarthquakes = processedEarthquakes.filter(eq => {
            // calculated_distance zaten yukarıda hesaplandı
            return eq.calculated_distance !== null && eq.calculated_distance <= currentMaxDistance;
        });
    }

    // 4. Sırala
    processedEarthquakes.sort((a, b) => {
        let comparison = 0;
        let valA, valB;

        switch (currentSortBy) {
            case 'magnitude':
                valA = getMagnitude(a) || 0;
                valB = getMagnitude(b) || 0;
                comparison = valA - valB;
                break;
            case 'depth':
                valA = getDepth(a);
                valB = getDepth(b);
                // Null/geçersiz değerleri sona at
                if (valA === null || isNaN(valA)) return 1;
                if (valB === null || isNaN(valB)) return -1;
                comparison = valA - valB;
                break;
            case 'distance':
                valA = a.calculated_distance;
                valB = b.calculated_distance;
                // Null mesafeleri sona at
                if (valA === null) return 1;
                if (valB === null) return -1;
                comparison = valA - valB;
                break;
            default: // date (veya bilinmeyen)
                valA = getTimestamp(a) || 0;
                valB = getTimestamp(b) || 0;
                comparison = valA - valB;
                break;
        }

        return currentSortOrder === 'desc' ? comparison * -1 : comparison;
    });

    displayEarthquakes(processedEarthquakes);
    updateMapMarkers(processedEarthquakes);
    updateChart(processedEarthquakes);

    processedEarthquakesForDownload = processedEarthquakes; // Sonucu global değişkende tut
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
    const dateStr = eq.date; // API'den gelen tarih (YYYY-MM-DD veya YYYY.MM.DD olabilir)
    if (!dateStr || typeof dateStr !== 'string') return '-';

    try {
        const parts = dateStr.split(' ');
        if (parts.length !== 2) throw new Error('Beklenmeyen tarih/saat formatı');

        const datePart = parts[0]; // YYYY-MM-DD veya YYYY.MM.DD
        const timePart = parts[1]; // HH:MM:SS

        // Hem '-' hem de '.' ayracını dene
        let dateComponents = datePart.split('-');
        if (dateComponents.length !== 3) {
            dateComponents = datePart.split('.'); // Eğer '-' ile bölünmediyse '.' ile dene
        }

        if (dateComponents.length !== 3) throw new Error('Beklenmeyen tarih bileşenleri ayracı');

        const year = dateComponents[0];
        const month = dateComponents[1];
        const day = dateComponents[2];

        // Yılın 4 haneli olduğunu varsayalım (güvenlik kontrolü eklenebilir)
        if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
             console.warn(`Beklenmeyen tarih bileşen uzunlukları: ${datePart}`);
             // Yine de formatlamayı dene?
        }

        // Yeni formatı oluştur: GG/AA/YYYY SS:DD:ss
        return `${day}/${month}/${year} ${timePart}`;
    } catch (error) {
        console.warn(`Tarih formatlanamadı (${dateStr}):`, error);
        return dateStr; // Hata durumunda orijinal string'i döndür
    }
}

function getEarthquakeId(eq, source) {
    // Kandilli (orhanayd): eq.earthquake_id
    // AFAD (emirkabal): Yok, geçici oluştur
    return eq.earthquake_id ?? `${getTimestamp(eq)}-${source}-${getMagnitude(eq)}`; // Kandilli ID'si varsa onu kullan
}

// Büyüklüğe göre renk döndüren fonksiyon
function getMagnitudeColor(magnitude) {
    // CSS değişkenlerinden renkleri al
    const style = getComputedStyle(document.documentElement);

    if (!magnitude || isNaN(magnitude)) return style.getPropertyValue('--secondary-text-color').trim() || '#bdbdbd'; // Gri (veri yoksa/geçersizse)
    if (magnitude >= 5.0) {
        return style.getPropertyValue('--magnitude-high-bg').trim() || '#dc3545'; // Koyu Kırmızı
    } else if (magnitude >= 4.0) {
        return style.getPropertyValue('--magnitude-medium-bg').trim() || '#fd7e14'; // Turuncu
    } else if (magnitude >= 3.0) {
        return style.getPropertyValue('--magnitude-low-bg').trim() || '#ffc107'; // Sarı
    } else {
        return style.getPropertyValue('--magnitude-default-bg').trim() || '#28a745'; // Açık Yeşil
    }
}
// ----------------------------------------------

// Haversine formülü ile mesafe hesaplama
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Koordinatlar geçerli değilse null döndür
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
        console.warn("Geçersiz veya eksik koordinatlar:", { lat1, lon1, lat2, lon2 });
        return null;
    }
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance; // km cinsinden mesafe
}

// Kullanıcı Konumunu Alma
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log('Kullanıcı konumu alındı:', userLocation);

                // Kullanıcı konum işaretçisini haritaya ekle/güncelle
                if (map) {
                     const userIcon = L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png', // Mavi standart ikon
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                        shadowSize: [41, 41]
                    });

                    if (!userMarker) {
                        userMarker = L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
                                      .addTo(map)
                                      .bindPopup('<b>Konumunuz</b>')
                                      .openPopup(); // Popup'ı hemen aç
                    } else {
                        userMarker.setLatLng([userLocation.latitude, userLocation.longitude]);
                         userMarker.getPopup().setContent('<b>Konumunuz</b>'); // Popup içeriğini güncelle (gerekirse)
                    }
                   // map.setView([userLocation.latitude, userLocation.longitude], 7); // Konuma odaklan (isteğe bağlı)
                }

                // Konum alındıktan sonra filtrelemeyi ve gösterimi yeniden yap
                 filterAndDisplayData();

            },
            (error) => {
                console.error('Konum alınamadı:', error.message); // Hata mesajını logla
                userLocation = null; // Hata durumunda null yap
                if (error.code === error.PERMISSION_DENIED) {
                    console.warn("Kullanıcı konum iznini reddetti.");
                    // Kullanıcıya bilgi verilebilir (örn. bir mesaj gösterme)
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                     console.warn("Konum bilgisi mevcut değil.");
                } else if (error.code === error.TIMEOUT) {
                     console.warn("Konum alma isteği zaman aşımına uğradı.");
                }
                 // Konum alınamasa bile listeyi/haritayı mevcut depremlerle güncelle
                 filterAndDisplayData();
            },
            {
                enableHighAccuracy: true, // Daha hassas konum için true dene (pil tüketimi artabilir)
                timeout: 15000, // Timeout süresini biraz artır (15 saniye)
                maximumAge: 300000 // 5 dakika boyunca önbellekteki konumu kullan
            }
        );
    } else {
        console.warn('Tarayıcı konum servisini desteklemiyor.');
        userLocation = null;
         // Konum desteklenmese bile listeyi/haritayı mevcut depremlerle güncelle
         filterAndDisplayData();
    }
}

async function fetchEarthquakes() {
    // Yükleniyor durumunu göster, eski hataları temizle
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (errorContainer) errorContainer.style.display = 'none';
    // earthquakeList.innerHTML = ''; // Liste temizleme display'de yapılıyor

    const locationPromise = getUserLocation(); // Konum alma paralel başlasın

    // API URL'sini belirle
    let apiUrl;
    let isOrhanAydAPI = false;
    if (currentDataSource === 'kandilli') {
        isOrhanAydAPI = true;
        if (currentDate) {
            apiUrl = `${kandilliArchiveBaseUrl}?date=${currentDate}`;
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
            } else if (data && !data.status && (data.desc?.includes('veri bulunamadı') || data.desc?.includes('Arşiv bulunamadı'))) {
                 console.log('Seçilen kaynak/tarih için veri yok.');
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

        // Yükleniyor göstergesini veri işlendikten sonra gizle
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (earthquakesRaw.length > 0) {
            const currentTimestamp = Date.now();

            // --- Periyodik Yeni Deprem Bildirimleri --- (İlk çalıştırmada göndermez)
            const newEarthquakes = earthquakesRaw.filter(eq => {
                const eqTimestamp = getTimestamp(eq) * 1000; // ms'ye çevir
                // lastCheckedTimestamp 0 ise veya deprem zamanı ondan küçükse, yeni değildir.
                return lastCheckedTimestamp > 0 && eqTimestamp > lastCheckedTimestamp;
            });

            // console.log(`Son kontrol: ${new Date(lastCheckedTimestamp)}, Yeni deprem sayısı: ${newEarthquakes.length}`);

            if (newEarthquakes.length > 0 && notificationsEnabled && notificationPermission === 'granted') {
                 // En yeni olanları önce bildirelim (liste zaten genelde ters sıralı gelir ama garanti edelim)
                 newEarthquakes.sort((a, b) => getTimestamp(b) - getTimestamp(a));
                newEarthquakes.forEach(eq => {
                    const magnitude = getMagnitude(eq);
                    // 1. Büyüklük kontrolü
                    if (magnitude >= minNotificationMagnitude) {
                        let shouldNotify = true;
                        // 2. Mesafe kontrolü (eğer aktifse ve konum varsa)
                        if (notificationDistanceEnabled && userLocation) {
                            const coords = getCoordinates(eq);
                            if (coords) {
                                const distance = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lon);
                                // Mesafe hesaplanabildiyse ve ayar limitinin altındaysa devam et, değilse bildirme
                                if (distance === null || distance > maxNotificationDistance) {
                                    shouldNotify = false;
                                }
                            } else {
                                shouldNotify = false; // Koordinat yoksa bildirme (mesafe filtresi aktifken)
                            }
                        }

                        // 3. Bildirimi gönder (eğer tüm kontrollerden geçtiyse)
                        if (shouldNotify) {
                            const title = `${magnitude.toFixed(1)} Büyüklüğünde Yeni Deprem`;
                            const body = `${getLocationTitle(eq)}`;
                            showNotification(title, body);
                            console.log(`Yeni Deprem Bildirimi (Min ${minNotificationMagnitude.toFixed(1)}${notificationDistanceEnabled && userLocation ? `, Maks ${maxNotificationDistance}km` : ''}):`, title);
                        }
                    }
                });
            }
            // --- Periyodik Bildirim Sonu ---

            // Son kontrol zamanını güncelle (Her zaman en yeni depremin zamanı olmalı)
             const latestTimestamp = Math.max(0, ...earthquakesRaw.map(eq => (getTimestamp(eq) || 0) * 1000));
              // Eğer API'den hiç geçerli timestamp gelmezse (latestTimestamp=0), mevcut zamanı kullan
             const validLatestTimestamp = latestTimestamp > 0 ? latestTimestamp : currentTimestamp;
              // lastCheckedTimestamp'ı sadece ileri taşıyalım
             lastCheckedTimestamp = Math.max(lastCheckedTimestamp, validLatestTimestamp);
             // console.log("Yeni son kontrol zamanı:", new Date(lastCheckedTimestamp));

            // ID'leri ekleyerek allEarthquakes'i oluştur
            allEarthquakes = earthquakesRaw.map((eq) => ({ ...eq, internal_id: getEarthquakeId(eq, currentDataSource) }));
            filterAndDisplayData(); // Filtrele, sırala ve göster (displayEarthquakes burada çağrılır)
        } else {
            // Veri yoksa
            allEarthquakes = [];
            filterAndDisplayData(); // Boş listeyi göstermek için yine de çağır
            // earthquakeList.innerHTML = '<div class="loading-text">Gösterilecek deprem verisi bulunamadı.</div>';
            // Veri olmasa da lastCheckedTimestamp güncellenebilir mi? Belki hayır.
        }

    } catch (error) {
        console.error('Deprem verileri alınırken hata oluştu:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        allEarthquakes = [];
        filterAndDisplayData(); // Hata durumunda da boş listeyi göster
        // Hata mesajını göster
        if (errorContainer) {
             errorContainer.textContent = `Hata: ${error.message}. Lütfen tekrar deneyin veya farklı bir kaynak/tarih seçin.`;
             errorContainer.style.display = 'block';
        }
         // Hata durumunda timestamp'i güncellemek kafa karıştırıcı olabilir, güncelleme yapmayalım.
    }
}

// Deprem Verilerini Gösterme Fonksiyonu
function displayEarthquakes(earthquakes) {
    if (!earthquakeList) return;

    // --- İlk Bildirim Kontrolü --- (Listeyi oluşturmadan hemen önce)
    if (initialNotificationNeeded && earthquakes.length > 0 && notificationPermission === 'granted' && notificationsEnabled) {
        const latestEarthquake = earthquakes[0]; // earthquakes zaten sıralanmış olmalı
        const magnitude = getMagnitude(latestEarthquake);
        if (magnitude >= minNotificationMagnitude) {
             const title = `${magnitude.toFixed(1)} Büyüklüğünde Deprem (En Son)`;
             const body = `${getLocationTitle(latestEarthquake)}`;
             showNotification(title, body);
             console.log('İlk bildirim gönderildi (İzin sonrası en son deprem): ', title);
        }
        initialNotificationNeeded = false; // Bayrağı sıfırla, sadece bir kere çalışsın
    }
    // --- İlk Bildirim Kontrolü Sonu ---

    earthquakeList.innerHTML = ''; // Mevcut listeyi temizle

    // Yükleniyor göstergesini gizle (display'e taşındı, veri varsa veya yoksa çalışır)
    // if (loadingIndicator) loadingIndicator.style.display = 'none';

    if (earthquakes.length === 0) {
        // Boş liste mesajını filterAndDisplayData'dan sonra burada ayarlayalım
        if (allEarthquakes.length > 0) { // Filtreleme sonucu boşsa
            earthquakeList.innerHTML = '<li>Filtreye uygun deprem bulunamadı.</li>';
        } else { // Hiç veri yoksa (API'den boş geldi veya hata)
            earthquakeList.innerHTML = '<li>Gösterilecek deprem verisi bulunamadı.</li>';
        }
        updateMapMarkers([]); // Haritayı temizle
        updateChart([]); // Grafiği temizle
        return;
    }

    earthquakes.forEach((earthquake, index) => {
        const listItem = document.createElement('li');
        listItem.classList.add('earthquake-item');
        // listItem ID'sini setAttribute ile eklemek daha güvenli olabilir
        listItem.setAttribute('data-id', getEarthquakeId(earthquake, currentDataSource));

        const magnitude = getMagnitude(earthquake);
        const depth = getDepth(earthquake);
        const dateStr = getDateString(earthquake);
        const locationTitle = getLocationTitle(earthquake);
        const coords = getCoordinates(earthquake);

        // Büyüklüğe göre renk sınıfı
        if (magnitude >= 5.0) listItem.classList.add('magnitude-high');
        else if (magnitude >= 4.0) listItem.classList.add('magnitude-medium');
        else if (magnitude >= 3.0) listItem.classList.add('magnitude-low');

        // Mesafe metnini oluştur
        let distanceInfoHtml = '';
        let distanceKm = earthquake.calculated_distance; // filterAndDisplayData'dan gelen hesaplanmış mesafe

         // Eğer mesafe hesaplanmamışsa (örn. konum izni yoksa) ve koordinat varsa, tekrar hesapla
         if (distanceKm === undefined && userLocation && coords) {
             distanceKm = calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lon);
         }

        // Mesafe varsa HTML'i oluştur
        if (distanceKm !== null && distanceKm !== undefined && !isNaN(distanceKm) && distanceKm !== Infinity) {
            distanceInfoHtml = `
                <span class="distance-info">
                    <i class="fas fa-road"></i> Uzaklık: ${distanceKm.toFixed(1)} km
                </span>`;
        }

        // Liste öğesi içeriği
        listItem.innerHTML = `
            <div class="magnitude" style="background-color: ${getMagnitudeColor(magnitude)};">
                ${magnitude && !isNaN(magnitude) ? magnitude.toFixed(1) : 'N/A'}
            </div>
            <div class="details">
                <span class="location">${locationTitle || 'Bilinmeyen Konum'}</span>
                <span class="date-depth">
                    <i class="far fa-calendar-alt"></i> ${dateStr || 'Bilinmeyen Zaman'} |
                    <i class="fas fa-arrows-alt-v"></i> Derinlik: ${depth !== null && !isNaN(depth) ? depth.toFixed(1) + ' km' : 'N/A'}
                </span>
                ${distanceInfoHtml}
            </div>
             <div class="map-icon-container">
                <i class="fas fa-map-marker-alt map-icon" title="Haritada göster"></i>
             </div>
        `;

        // Tıklama olayı
        listItem.addEventListener('click', (e) => {
            const currentItem = e.currentTarget; // Tıklanan li öğesini al
             // Eğer harita ikonuna tıklandıysa modal açma, haritaya odaklan
            if (e.target.classList.contains('map-icon')) {
                 const eqId = currentItem.getAttribute('data-id');
                if (map && earthquakeMarkers[eqId]) {
                     const markerLatLng = earthquakeMarkers[eqId].getLatLng();
                     // Cluster içindeyse cluster'ı açmayı dene
                     const parent = earthquakeLayerGroup.getVisibleParent(earthquakeMarkers[eqId]);
                     if(parent && typeof parent.spiderfy === 'function') { // spiderfy metodu var mı kontrol et
                          parent.spiderfy(); // Veya zoomToShowLayer(marker)
                     }
                     map.setView(markerLatLng, Math.max(map.getZoom(), 11)); // Biraz daha yakınlaş
                    earthquakeMarkers[eqId].openPopup();
                } else if(coords) {
                     // İşaretçi henüz oluşturulmamışsa veya bulunamadıysa koordinata git
                     map.setView([coords.lat, coords.lon], 11);
                     console.warn("Harita ikonu tıklandı ancak işaretçi bulunamadı, koordinata gidiliyor.", eqId);
                }
            } else {
                 // Liste öğesinin geri kalanına tıklandıysa modal aç
                  if (typeof openModal === 'function') {
                         const eqId = currentItem.getAttribute('data-id');
                        // allEarthquakes içinden doğru depremi bulmamız gerekiyor
                         const originalEarthquakeData = allEarthquakes.find(eq => getEarthquakeId(eq, currentDataSource) === eqId);
                        if(originalEarthquakeData) {
                             openModal(originalEarthquakeData);
                        } else {
                             console.warn("Modal için orijinal deprem verisi bulunamadı:", eqId);
                             // Belki liste öğesindeki verilerle basit bir modal gösterilebilir?
                             // openModal({ location: locationTitle, magnitude: magnitude, ... });
                        }

                  } else {
                      console.warn("openModal fonksiyonu tanımlı değil.");
                  }
            }
        });

        earthquakeList.appendChild(listItem);
    });

    // Harita ve Grafik Güncelleme
    updateMapMarkers(earthquakes);
    updateChart(earthquakes);
}

// Harita İşaretçilerini Güncelleme Fonksiyonu
function updateMapMarkers(earthquakes) {
    // Harita veya katman grubu hazır değilse işlem yapma (zamanlama sorununu önle)
    if (!map || !earthquakeLayerGroup) {
        console.warn('updateMapMarkers çağrıldı ancak harita veya katman grubu hazır değil.');
        return;
    }

    // console.log(`Haritayı güncellemek için ${earthquakes.length} deprem işleniyor.`);
    earthquakeLayerGroup.clearLayers(); // Önceki işaretçileri temizle

    // Mevcut işaretçileri temizle (alternatif)
    // Object.values(earthquakeMarkers).forEach(marker => marker.remove());
    // earthquakeMarkers = {};

    earthquakes.forEach(eq => {
        const coords = getCoordinates(eq);
        if (!coords) return; // Koordinat yoksa atla

        const mag = getMagnitude(eq);
        const depth = getDepth(eq);
        const title = getLocationTitle(eq);
        const dateStr = getDateString(eq);
        const eqId = getEarthquakeId(eq, currentDataSource); // Benzersiz ID

        // Dinamik boyut ve renk
        const radius = 3 + mag * 1.5; // Büyüklüğe göre dinamik yarıçap
        const color = getMagnitudeColor(mag);

        const marker = L.circleMarker([coords.lat, coords.lon], {
            radius: radius,
            fillColor: color,
            color: "#000",
            weight: 0.5,
            opacity: 1,
            fillOpacity: 0.7
        });

        // Popup içeriği
        const popupContent = `
            <b>${title}</b><br>
            Büyüklük: ${mag.toFixed(1)}<br>
            Derinlik: ${depth.toFixed(1)} km<br>
            Tarih: ${dateStr}<br>
            <button class="details-button" data-earthquake-id="${eqId}">Detayları Gör</button>
        `;
        marker.bindPopup(popupContent);

        // İşaretçiyi gruba ekle
        earthquakeLayerGroup.addLayer(marker);
        earthquakeMarkers[eqId] = eq; // Detaylar için depremi sakla

    });
    // console.log(`${earthquakes.length} işaretçi haritaya eklendi.`);

    // İşaretçi detay butonu olay dinleyicisi (delegasyon)
    map.off('popupopen'); // Önceki dinleyiciyi kaldır
    map.on('popupopen', function(e) {
        const detailsButton = e.popup._container.querySelector('.details-button');
        if (detailsButton) {
            const eqId = detailsButton.getAttribute('data-earthquake-id');
            detailsButton.onclick = () => {
                const selectedEq = earthquakeMarkers[eqId];
                if (selectedEq) {
                    openModal(selectedEq);
                }
            };
        }
    });
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

    // Tarih formatlama
    let formattedDate = 'N/A';
    if (timestamp) {
        try {
            const dateObj = new Date(timestamp * 1000); // Unix timestamp saniye cinsinden, ms'ye çevir
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Aylar 0'dan başlar
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.warn(`Modal için tarih formatlanamadı: ${timestamp}`, error);
            // Hata olursa orijinal getDateString'i kullanmayı deneyebiliriz?
            formattedDate = getDateString(earthquake) || 'Hata';
        }
    }

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

// Bildirim desteğini ve durumunu kontrol et ve UI durumunu ayarla
function checkNotificationSupportAndStatus() {
    if (!('Notification' in window)) {
        console.warn('Tarayıcı bildirimleri desteklemiyor.');
        // Buton ve ayarların durumu updateUI tarafından yönetilecek
        notificationPermission = 'denied'; // Desteklenmiyorsa reddedilmiş gibi davranalım?
        // updateNotificationSettingsUIState(); // Bu çağrıyı kaldırıyoruz
        return false;
    }

    notificationPermission = Notification.permission;
    console.log('Başlangıç Bildirim İzni Durumu:', notificationPermission);

    // UI durumu loadSettings sonundaki updateUI çağrısı ile ayarlanacak
    // updateNotificationSettingsUIState(); // Bu çağrıyı kaldırıyoruz
    return true; // Destek var
}

// Bildirim ayarları UI elemanlarının aktif/pasif durumunu güncelleyen fonksiyon
function updateNotificationSettingsUIState() {
    const isDenied = notificationPermission === 'denied';
    const isUnsupported = !('Notification' in window);
    // DÜZELTİLMİŞ: Bildirimler sadece izin VERİLMİŞSE, KULLANICI ETKİNLEŞTİRMİŞSE ve DESTEKLENİYORSA etkindir.
    const areNotificationsEffectivelyEnabled = notificationPermission === 'granted' && notificationsEnabled && !isUnsupported;

    // Ana Bildirim Butonu
    if (toggleNotificationsBtn) {
        toggleNotificationsBtn.disabled = isDenied || isUnsupported; // Reddedilmiş veya desteklenmiyorsa devre dışı

        if (areNotificationsEffectivelyEnabled) {
            toggleNotificationsBtn.classList.add('active'); // Sadece etkinse aktif yap
        } else {
            toggleNotificationsBtn.classList.remove('active'); // Diğer tüm durumlarda pasif yap
            // Reddedilmiş veya desteklenmiyorsa, ayarı da kapalı tut
            if (isDenied || isUnsupported) {
                notificationsEnabled = false;
            }
        }
    }

    // Büyüklük Slider
    if (notificationMagnitudeInput) {
        notificationMagnitudeInput.disabled = !areNotificationsEffectivelyEnabled;
    }

    // Yakındaki Bildirim Butonu
    if (toggleNearbyOnlyBtn) {
        toggleNearbyOnlyBtn.disabled = !areNotificationsEffectivelyEnabled; // Ana ayar etkin değilse devre dışı
        if (!areNotificationsEffectivelyEnabled) {
            toggleNearbyOnlyBtn.classList.remove('active'); // Ana ayar etkin değilse pasif yap
            notificationDistanceEnabled = false; // Ayarı da kapat
        } else {
            // Ana ayar etkinse, kendi durumuna göre aktif/pasif yap
            toggleNearbyOnlyBtn.classList.toggle('active', notificationDistanceEnabled);
        }
    }

    // Mesafe Slider Div'i
    // Sadece ana bildirimler ve yakındaki ayarı etkinse göster
    const showDistanceSettings = areNotificationsEffectivelyEnabled && notificationDistanceEnabled;
    if (notificationDistanceSettingDiv) {
        notificationDistanceSettingDiv.style.display = showDistanceSettings ? 'flex' : 'none';
    }

    // Mesafe Slider
    if (notificationDistanceInput) {
        notificationDistanceInput.disabled = !showDistanceSettings; // Sadece gösteriliyorsa etkin
    }
}

// Bildirim izni isteme fonksiyonu (Promise döndürür: true=izin verildi, false=verilmedi/kapatıldı)
async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;

    try {
        const permissionResult = await Notification.requestPermission();
        notificationPermission = permissionResult; // Global durumu güncelle

        if (permissionResult === 'granted') {
            console.log('Bildirim izni verildi.');
            notificationsEnabled = true; // Bildirimleri etkinleştir
            initialNotificationNeeded = true; // İlk bildirim bayrağını ayarla
            if (enableNotificationsCheckbox) {
                enableNotificationsCheckbox.checked = true; // Toggle'ı AÇIK yap
                enableNotificationsCheckbox.disabled = false; // Artık disable değil
            }
            updateNotificationSettingsUIState(); // Diğer UI'ları etkinleştir
            saveSettings(); // Yeni durumu kaydet
            // İlk bildirimi göndermek için veriyi yeniden işle
            filterAndDisplayData();
            return true; // Başarılı
        } else {
             console.log('Bildirim izni verilmedi veya istek kapatıldı.');
             notificationsEnabled = false;
             if (enableNotificationsCheckbox) {
                 enableNotificationsCheckbox.checked = false; // Toggle'ı KAPALI bırak/yap
                 enableNotificationsCheckbox.disabled = (permissionResult === 'denied'); // Reddedildiyse disable et
             }
             updateNotificationSettingsUIState(); // Diğer UI'ları devre dışı bırak
             saveSettings(); // Yeni durumu kaydet
            if (permissionResult === 'denied') {
                 alert('Bildirimler engellendi. Tarayıcı ayarlarından izin vermeniz gerekebilir.');
            }
            return false; // Başarısız
        }
    } catch (error) {
        console.error('Bildirim izni istenirken hata:', error);
        notificationsEnabled = false; // Hata durumunda kapat
        if (enableNotificationsCheckbox) enableNotificationsCheckbox.checked = false;
        updateNotificationSettingsUIState();
        saveSettings();
        return false; // Başarısız
    }
}

// Bildirim gösterme fonksiyonu
function showNotification(title, body) {
    // İzin kontrolü zaten çağıran yerde yapılıyor ama burada da dursun
    if (Notification.permission !== 'granted' || !notificationsEnabled) return;

    // Aktif service worker üzerinden bildirim göndermeyi dene (daha iyi çevrimdışı destek için)
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function(registration) {
            registration.showNotification(title, {
                body: body,
                icon: 'icons/icon-192x192.png', // Manifest'teki ikon
                badge: 'icons/icon-192x192.png' // Küçük ikon (Android)
                // tag: 'deprem-bildirimi' // Aynı tag'li bildirimler birbirini günceller (isteğe bağlı)
            });
        });
    } else {
        // SW yoksa veya hazır değilse standart Notification API kullan
        new Notification(title, { body: body, icon: 'icons/icon-192x192.png' });
    }
}

// Service Worker Kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
} else {
    console.log('Service workers are not supported.');
}

// --- Veri İndirme Fonksiyonları ---

// Helper: Veriyi indirmek için link oluşturma
function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// O anki filtrelenmiş/sıralanmış veriyi CSV olarak indirir
function downloadDataAsCSV() {
    if (!processedEarthquakesForDownload || processedEarthquakesForDownload.length === 0) {
        alert('İndirilecek veri bulunamadı.');
        return;
    }

    const header = ['Tarih', 'Saat', 'Enlem', 'Boylam', 'Derinlik(km)', 'Büyüklük(ML)', 'Yer', 'Kaynak'];
    const rows = processedEarthquakesForDownload.map(eq => {
        const coords = getCoordinates(eq);
        const dateStr = getDateString(eq) || ' '; // Boşluk bırakırsak ayırma kolaylaşır
        const dateParts = dateStr.split(' ');
        const tarih = dateParts[0] || '';
        const saat = dateParts[1] || '';
        const lat = coords ? coords.lat?.toFixed(4) : '';
        const lon = coords ? coords.lon?.toFixed(4) : '';
        const depth = getDepth(eq);
        const mag = getMagnitude(eq);
        // CSV'de virgül sorun yaratabilir, yer bilgisini çift tırnak içine alalım
        const location = getLocationTitle(eq).replace(/"/g, '""'); // Çift tırnağı escape et

        return [
            tarih,
            saat,
            lat,
            lon,
            (depth !== null && !isNaN(depth)) ? depth.toFixed(1) : '',
            (mag !== null && !isNaN(mag)) ? mag.toFixed(1) : '',
            `"${location}"`,
            currentDataSource // O an seçili olan kaynak
        ];
    });

    // Başlık ve satırları birleştir
    let csvContent = header.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(`depremler_${timestamp}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

// O anki filtrelenmiş/sıralanmış veriyi JSON olarak indirir
function downloadDataAsJSON() {
    if (!processedEarthquakesForDownload || processedEarthquakesForDownload.length === 0) {
        alert('İndirilecek veri bulunamadı.');
        return;
    }

    // Ham veriyi değil, işlenmiş ve okunabilir veriyi indirelim
    const jsonData = processedEarthquakesForDownload.map(eq => {
        const coords = getCoordinates(eq);
        return {
            tarih_saat: getDateString(eq),
            enlem: coords ? coords.lat?.toFixed(4) : null,
            boylam: coords ? coords.lon?.toFixed(4) : null,
            derinlik_km: getDepth(eq),
            buyukluk_ml: getMagnitude(eq),
            yer: getLocationTitle(eq),
            kaynak: currentDataSource,
            timestamp_unix: getTimestamp(eq) // Orijinal timestamp
        };
    });

    const jsonContent = JSON.stringify(jsonData, null, 2); // Güzelleştirilmiş JSON
    const timestamp = new Date().toISOString().slice(0, 10);
    triggerDownload(`depremler_${timestamp}.json`, jsonContent, 'application/json;charset=utf-8;');
}

// --- Yeni Buton Listener'ları ---
if (toggleNotificationsBtn) {
    toggleNotificationsBtn.addEventListener('click', async () => {
        if (notificationPermission === 'denied') {
            alert('Tarayıcı ayarlarından bildirim izinlerini değiştirmeniz gerekiyor.');
            return;
        }

        notificationsEnabled = !notificationsEnabled;
        // toggleNotificationsBtn.classList.toggle('active', notificationsEnabled); // -> Bu satır kaldırıldı, updateUI yönetecek

        console.log(`Button Clicked: notificationsEnabled=${notificationsEnabled}, notificationPermission='${notificationPermission}'`);

        if (notificationsEnabled && notificationPermission === 'default') {
            console.log('İzin isteme koşulu sağlandı. requestNotificationPermission çağrılıyor...');
            await requestNotificationPermission();
        } else {
            // Eğer izin zaten verilmişse veya kapatılıyorsa, sadece UI'ı ve ayarı güncelle
            saveSettings();
            updateNotificationSettingsUIState();
        }
    });
}
if (toggleNearbyOnlyBtn) {
    toggleNearbyOnlyBtn.addEventListener('click', () => {
        notificationDistanceEnabled = !notificationDistanceEnabled;
        // toggleNearbyOnlyBtn.classList.toggle('active', notificationDistanceEnabled); // -> Bu satır kaldırıldı, updateUI yönetecek
        saveSettings();
        updateNotificationSettingsUIState(); // Mesafe slider'ını göster/gizle
    });
}
if (notificationMagnitudeInput) {
    notificationMagnitudeInput.addEventListener('input', (e) => {
        minNotificationMagnitude = parseFloat(e.target.value);
        if(notificationMagnitudeValueSpan) notificationMagnitudeValueSpan.textContent = minNotificationMagnitude.toFixed(1);
        saveSettings();
        // Yeniden filtrelemeye gerek yok, sadece bildirimleri etkiler
    });
}
if (notificationDistanceInput) {
    notificationDistanceInput.addEventListener('input', (e) => {
        maxNotificationDistance = parseFloat(e.target.value);
        if(notificationDistanceValueSpan) notificationDistanceValueSpan.textContent = maxNotificationDistance.toFixed(0);
        saveSettings();
        // Yeniden filtrelemeye gerek yok, sadece bildirimleri etkiler
    });
}
// -------

// 4. Arayüz Hazır Olduktan Sonra Konumu Al ve Veri Çek
handleSortChange();
toggleDatePickerVisibility();
fetchEarthquakes(); 