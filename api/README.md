# Rota API Kullanım Dokümanı

## Rota Oluşturma API'leri

Rota oluşturmak için aşağıdaki API endpoint'leri kullanılabilir:

### 1. Koordinatlar ile Rota Oluşturma

**Endpoint:** `POST /api/v1/rota-bilgisi/`

**Payload:**
```json
{
  "origin_lat": 38.6748,
  "origin_lng": 39.2225,
  "destination_lat": 39.9208,
  "destination_lng": 32.8541,
  "mode": "driving"
}
```

### 2. Adres ile Rota Oluşturma

**Endpoint:** `POST /api/v1/rota-bilgisi/`

**Payload:**
```json
{
  "origin_address": "Elazığ, Türkiye",
  "destination_address": "Ankara, Türkiye",
  "mode": "driving"
}
```

### 3. Ara Noktalarla (Waypoints) Rota Oluşturma

**Endpoint:** `POST /api/v1/rota-bilgisi/`

**Payload:**
```json
{
  "origin_lat": 38.6748,
  "origin_lng": 39.2225,
  "destination_lat": 39.9208,
  "destination_lng": 32.8541,
  "mode": "driving",
  "waypoints": [
    {
      "location_lat": 39.1,
      "location_lng": 40.1,
      "stopover": true
    }
  ],
  "optimize_waypoints": false
}
```

### 4. Adres ve Ara Noktalarla Rota Oluşturma

**Endpoint:** `POST /api/v1/rota-bilgisi/`

**Payload:**
```json
{
  "origin_address": "Elazığ, Türkiye",
  "destination_address": "Ankara, Türkiye",
  "mode": "driving",
  "waypoints": [
    {
      "location_lat": 39.1,
      "location_lng": 40.1,
      "stopover": true
    }
  ],
  "optimize_waypoints": false
}
```

## Diğer Parametreler

- **mode**: Seyahat modu. Olası değerler: `driving`, `walking`, `bicycling`, `transit`. Varsayılan: `driving`.
- **alternatives**: Alternatif rotaları döndürmek için `true` veya `false`. Varsayılan: `false`.
- **optimize_waypoints**: Ara noktaları optimize etmek için `true` veya `false`. Varsayılan: `false`.

## Örnek Cevaplar

API'nin döndürdüğü cevap, Google Directions API'sinin döndürdüğü cevapla aynı formatta olacaktır. Buna ek olarak, eğer kullanıcı giriş yapmışsa, kaydedilen rota bilgisi de dönüş değerine eklenir.

```json
{
  "routes": [...],
  "status": "OK",
  "saved_route": {
    "id": 123,
    "saved_at": "2023-09-01T12:00:00Z"
  }
}
```

## Hata Durumları

- **400 Bad Request**: Gerekli parametreler eksikse veya geçersiz değerler içeriyorsa.
- **500 Internal Server Error**: API isteği sırasında bir hata oluştuğunda.

## Not

Mobil uygulamalar için, hem koordinat tabanlı hem de adres tabanlı rota oluşturma seçenekleri mevcuttur. Backend tarafında, adresler ilk olarak Google Geocoding API kullanılarak koordinatlara dönüştürülür, ardından rota hesaplanır. 