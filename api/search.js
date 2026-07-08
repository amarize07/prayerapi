// api/search.js - خادم البحث على Vercel

export default async function handler(req, res) {
    // ===== إعدادات CORS للسماح لأي موقع باستدعاء الـ API =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // ===== معالجة طلب OPTIONS (مطلوب لـ CORS) =====
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    // ===== التحقق من طريقة الطلب =====
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'الطريقة غير مدعومة. استخدم GET أو POST'
        });
    }
    
    // ===== استخراج معلمات البحث =====
    let query = '';
    let limit = 8;
    
    if (req.method === 'GET') {
        query = req.query.q || '';
        limit = parseInt(req.query.limit) || 8;
    } else {
        query = req.body.q || '';
        limit = parseInt(req.body.limit) || 8;
    }
    
    // ===== التحقق من صحة المعلمات =====
    if (!query || query.length < 2) {
        return res.status(400).json({
            success: false,
            error: 'يرجى إدخال كلمة بحث (مطلوب حرفين على الأقل)',
            cities: []
        });
    }
    
    // تحديد الحد الأقصى للنتائج
    if (limit > 20) limit = 20;
    
    try {
        console.log(`🔍 جاري البحث عن: "${query}" (الحد: ${limit})`);
        
        // ===== ترميز النص للبحث =====
        const encodedQuery = encodeURIComponent(query);
        
        // ===== البحث من OpenStreetMap Nominatim API =====
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limit}&countrycodes=YE&addressdetails=1&featuretype=city`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PrayerTimesApp/1.0 (contact@example.com)'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // ===== تحويل النتائج إلى الصيغة المطلوبة =====
        const cities = data.map((item) => {
            const address = item.address || {};
            
            // استخراج اسم المدينة
            let cityName = address.city || address.town || address.village || address.municipality || '';
            if (!cityName) {
                const parts = item.display_name.split(',');
                cityName = parts[0]?.trim() || '';
            }
            
            // استخراج district (المديرية/المنطقة)
            let district = address.suburb || address.city_district || address.district || address.county || '';
            
            // استخراج governorate (المحافظة)
            let governorate = address.state || address.region || address.province || '';
            
            // إذا لم يتم العثور على district، حاول استخراجه من display_name
            if (!district) {
                const parts = item.display_name.split(',');
                if (parts.length >= 2) {
                    district = parts[1]?.trim() || '';
                }
            }
            
            // إذا لم يتم العثور على governorate، حاول استخراجه من display_name
            if (!governorate) {
                const parts = item.display_name.split(',');
                if (parts.length >= 3) {
                    governorate = parts[2]?.trim() || '';
                }
            }
            
            // تنظيف البيانات
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
        
        // ===== الرد بالنتائج =====
        return res.status(200).json({
            success: true,
            cities: cities,
            total: cities.length,
            query: query,
            limit: limit
        });
        
    } catch (error) {
        console.error('❌ فشل البحث:', error);
        
        return res.status(500).json({
            success: false,
            error: 'حدث خطأ أثناء البحث',
            cities: [],
            message: error.message
        });
    }
        }
