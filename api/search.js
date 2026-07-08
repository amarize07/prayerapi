// api/search.js - خادم البحث على Vercel

export default async function handler(req, res) {
    // إعدادات CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // معالجة طلب OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    // استخراج معلمات البحث
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
        
        // استخدام OpenStreetMap مع User-Agent صحيح
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limit}&countrycodes=YE&addressdetails=1&featuretype=city`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0 (https://prayerapi-xi.vercel.app)',
                'Accept': 'application/json',
                'Referer': 'https://prayerapi-xi.vercel.app'
            }
        });
        
        if (!response.ok) {
            // إذا كان 403، جرب بدون countrycodes
            if (response.status === 403) {
                console.warn('⚠️ 403 Forbidden، جاري المحاولة بدون countrycodes...');
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
                const cities = data.map((item) => {
                    const address = item.address || {};
                    let cityName = address.city || address.town || address.village || item.display_name.split(',')[0] || '';
                    return {
                        name: cityName,
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon),
                        elevation: 0,
                        district: address.suburb || address.city_district || address.district || address.county || '',
                        governorate: address.state || address.region || address.province || '',
                        street: address.road || '',
                        display_name: item.display_name || ''
                    };
                });
                
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
        
        const cities = data.map((item) => {
            const address = item.address || {};
            
            let cityName = address.city || address.town || address.village || address.municipality || '';
            if (!cityName) {
                const parts = item.display_name.split(',');
                cityName = parts[0]?.trim() || '';
            }
            
            let district = address.suburb || address.city_district || address.district || address.county || '';
            let governorate = address.state || address.region || address.province || '';
            
            if (!district) {
                const parts = item.display_name.split(',');
                if (parts.length >= 2) {
                    district = parts[1]?.trim() || '';
                }
            }
            
            if (!governorate) {
                const parts = item.display_name.split(',');
                if (parts.length >= 3) {
                    governorate = parts[2]?.trim() || '';
                }
            }
            
            if (governorate === 'اليمن' && district) {
                governorate = district;
                district = '';
            }
            
            return {
                name: cityName,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                elevation: 0,
                district: district,
                governorate: governorate,
                street: address.road || address.street || '',
                display_name: item.display_name || '',
                type: item.type || '',
                class: item.class || ''
            };
        });
        
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
        
        // محاولة استخدام وكيل مجاني
        try {
            console.log('🔄 محاولة استخدام وكيل...');
            const proxyUrl = `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
            
            const proxyResponse = await fetch(proxyUrl, {
                headers: {
                    'User-Agent': 'PrayerTimesApp/1.0'
                }
            });
            
            if (proxyResponse.ok) {
                const data = await proxyResponse.json();
                const cities = data.map((item) => ({
                    name: item.display_name?.split(',')[0] || '',
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    elevation: 0,
                    district: '',
                    governorate: '',
                    street: '',
                    display_name: item.display_name || ''
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
