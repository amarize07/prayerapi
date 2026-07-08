// api/search.js - خادم البحث على Vercel مع نظام ارتفاع متعدد الطبقات (بدون بيانات يدوية)

// ===== جلب الارتفاع من Open-Elevation API (الطبقة الأولى) =====
async function getElevationFromOpenElevation(lat, lng) {
    try {
        const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const elevation = data.results[0].elevation;
            if (elevation !== null && elevation !== undefined) {
                return Math.round(elevation);
            }
        }
        return null;
    } catch (error) {
        console.warn('⚠️ فشل Open-Elevation:', error.message);
        return null;
    }
}

// ===== جلب الارتفاع من OpenTopoData API (الطبقة الثانية - بديل) =====
async function getElevationFromOpenTopo(lat, lng) {
    try {
        const url = `https://api.opentopodata.org/v1/srtm30m?locations=${lat},${lng}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const elevation = data.results[0].elevation;
            if (elevation !== null && elevation !== undefined) {
                return Math.round(elevation);
            }
        }
        return null;
    } catch (error) {
        console.warn('⚠️ فشل OpenTopoData:', error.message);
        return null;
    }
}

// ===== جلب الارتفاع من Open-Meteo API (الطبقة الثالثة - بديل إضافي) =====
async function getElevationFromOpenMeteo(lat, lng) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lng}&count=1`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const elevation = data.results[0].elevation;
            if (elevation !== null && elevation !== undefined) {
                return Math.round(elevation);
            }
        }
        return null;
    } catch (error) {
        console.warn('⚠️ فشل Open-Meteo:', error.message);
        return null;
    }
}

// ===== جلب الارتفاع من جميع المصادر (نظام متعدد الطبقات) =====
async function getElevation(lat, lng) {
    // ===== الطبقة 1: Open-Elevation API =====
    try {
        const elevation = await getElevationFromOpenElevation(lat, lng);
        if (elevation !== null && elevation > 0) {
            console.log(`✅ الارتفاع من Open-Elevation: ${elevation}م`);
            return elevation;
        }
    } catch (error) {
        console.warn('⚠️ فشل Open-Elevation، جاري الانتقال للطبقة التالية');
    }
    
    // ===== الطبقة 2: OpenTopoData API =====
    try {
        const elevation = await getElevationFromOpenTopo(lat, lng);
        if (elevation !== null && elevation > 0) {
            console.log(`✅ الارتفاع من OpenTopoData: ${elevation}م`);
            return elevation;
        }
    } catch (error) {
        console.warn('⚠️ فشل OpenTopoData، جاري الانتقال للطبقة التالية');
    }
    
    // ===== الطبقة 3: Open-Meteo API =====
    try {
        const elevation = await getElevationFromOpenMeteo(lat, lng);
        if (elevation !== null && elevation > 0) {
            console.log(`✅ الارتفاع من Open-Meteo: ${elevation}م`);
            return elevation;
        }
    } catch (error) {
        console.warn('⚠️ فشل Open-Meteo، جاري الانتقال للطبقة التالية');
    }
    
    // ===== إذا فشل كل شيء، أرجع 0 =====
    console.warn('⚠️ لم يتم العثور على ارتفاع من جميع المصادر، استخدام 0');
    return 0;
}

export default async function handler(req, res) {
    // إعدادات CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    let query = '';
    let limit = 8;
    
    if (req.method === 'GET') {
        query = req.query.q || '';
        limit = parseInt(req.query.limit) || 8;
    } else {
        query = req.body.q || '';
        limit = parseInt(req.body.limit) || 8;
    }
    
    if (!query || query.length < 2) {
        return res.status(400).json({
            success: false,
            error: 'يرجى إدخال كلمة بحث (مطلوب حرفين على الأقل)',
            cities: []
        });
    }
    
    if (limit > 20) limit = 20;
    
    try {
        console.log(`🔍 جاري البحث عن: "${query}"`);
        
        const encodedQuery = encodeURIComponent(query);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limit}&countrycodes=YE&addressdetails=1&featuretype=city`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0 (https://prayerapi-xi.vercel.app)',
                'Accept': 'application/json',
                'Referer': 'https://prayerapi-xi.vercel.app'
            }
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limit}&addressdetails=1`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    headers: {
                        'User-Agent': 'PrayerTimesApp/1.0 (https://prayerapi-xi.vercel.app)',
                        'Accept': 'application/json'
                    }
                });
                
                if (!fallbackResponse.ok) {
                    throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
                }
                
                const data = await fallbackResponse.json();
                
                // معالجة النتائج مع جلب الارتفاع
                const cities = await Promise.all(data.map(async (item) => {
                    const address = item.address || {};
                    let cityName = address.city || address.town || address.village || item.display_name.split(',')[0] || '';
                    let governorate = address.state || address.region || address.province || '';
                    
                    if (!governorate) {
                        const parts = item.display_name.split(',');
                        if (parts.length >= 3) {
                            governorate = parts[2]?.trim() || '';
                        }
                    }
                    
                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    
                    // جلب الارتفاع من النظام المتعدد الطبقات
                    const elevation = await getElevation(lat, lng);
                    
                    return {
                        name: cityName,
                        lat: lat,
                        lng: lng,
                        elevation: elevation,
                        district: address.suburb || address.city_district || address.district || address.county || '',
                        governorate: governorate,
                        street: address.road || '',
                        display_name: item.display_name || ''
                    };
                }));
                
                return res.status(200).json({
                    success: true,
                    cities: cities,
                    total: cities.length,
                    query: query,
                    limit: limit
                });
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // معالجة النتائج مع جلب الارتفاع
        const cities = await Promise.all(data.map(async (item) => {
            const address = item.address || {};
            
            let cityName = address.city || address.town || address.village || address.municipality || '';
            if (!cityName) {
                const parts = item.display_name.split(',');
                cityName = parts[0]?.trim() || '';
            }
            
            let district = address.suburb || address.city_district || address.district || address.county || '';
            if (!district) {
                const parts = item.display_name.split(',');
                if (parts.length >= 2) {
                    district = parts[1]?.trim() || '';
                }
            }
            
            let governorate = address.state || address.region || address.province || '';
            if (!governorate) {
                const parts = item.display_name.split(',');
                if (parts.length >= 3) {
                    governorate = parts[2]?.trim() || '';
                }
                if (parts.length >= 4 && !governorate) {
                    governorate = parts[3]?.trim() || '';
                }
            }
            
            if (governorate === 'اليمن' && district && district !== 'اليمن') {
                governorate = district;
                district = '';
            }
            
            if (governorate === cityName) {
                const parts = item.display_name.split(',');
                if (parts.length >= 3) {
                    const possibleGov = parts[2]?.trim() || '';
                    if (possibleGov && possibleGov !== cityName && possibleGov !== 'اليمن') {
                        governorate = possibleGov;
                    }
                }
            }
            
            if (governorate.startsWith('محافظة ')) {
                governorate = governorate.replace('محافظة ', '');
            }
            
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            
            // ===== جلب الارتفاع من النظام المتعدد الطبقات =====
            const elevation = await getElevation(lat, lng);
            
            return {
                name: cityName,
                lat: lat,
                lng: lng,
                elevation: elevation,
                district: district,
                governorate: governorate,
                street: address.road || address.street || '',
                display_name: item.display_name || '',
                type: item.type || '',
                class: item.class || ''
            };
        }));
        
        console.log(`✅ تم العثور على ${cities.length} نتيجة`);
        
        return res.status(200).json({
            success: true,
            cities: cities,
            total: cities.length,
            query: query,
            limit: limit
        });
        
    } catch (error) {
        console.error('❌ فشل البحث:', error);
        
        // محاولة استخدام وكيل كملاذ أخير
        try {
            const proxyUrl = `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
            
            const proxyResponse = await fetch(proxyUrl, {
                headers: {
                    'User-Agent': 'PrayerTimesApp/1.0'
                }
            });
            
            if (proxyResponse.ok) {
                const data = await proxyResponse.json();
                const cities = await Promise.all(data.map(async (item) => {
                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    const cityName = item.display_name?.split(',')[0] || '';
                    const elevation = await getElevation(lat, lng);
                    
                    return {
                        name: cityName,
                        lat: lat,
                        lng: lng,
                        elevation: elevation,
                        district: '',
                        governorate: item.address?.state || item.address?.region || '',
                        street: '',
                        display_name: item.display_name || ''
                    };
                }));
                
                return res.status(200).json({
                    success: true,
                    cities: cities,
                    total: cities.length,
                    query: query,
                    limit: limit
                });
            }
        } catch (proxyError) {
            console.error('❌ فشل الوكيل:', proxyError);
        }
        
        return res.status(500).json({
            success: false,
            error: 'حدث خطأ أثناء البحث',
            cities: [],
            message: error.message
        });
    }
                                                      }
