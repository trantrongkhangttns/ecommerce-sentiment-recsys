import React, { useState } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  CircularProgress, Chip, Rating, Divider, Alert 
} from '@mui/material';
import { Search, ShoppingBag, Star, History, AutoAwesome } from '@mui/icons-material';
import axios from 'axios';

export default function Recommendation() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]); 
  const [isColdStart, setIsColdStart] = useState(null);
  const [error, setError] = useState(null);

  const handleRecommend = async () => {
    if (!userId.trim()) return;
    
    setLoading(true);
    setError(null);
    setProducts([]);
    setHistory([]);
    setIsColdStart(null);

    try {
      const response = await axios.get('http://127.0.0.1:5000/api/recommend', {
        params: { user_id: userId.trim(), top_n: 10 }
      });

      if (response.data.status === 'success') {
        setProducts(response.data.data);
        setHistory(response.data.history || []); 
        setIsColdStart(response.data.is_cold_start);
      } else {
        setError(response.data.message || 'Lỗi không xác định từ Backend');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể kết nối đến máy chủ Gợi ý.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
  };

  
  const ProductCard = ({ product, isHistory }) => (
    <Card sx={{ 
      display: 'flex', flexDirection: 'column', borderRadius: 3,
      boxShadow: '0 4px 15px rgba(0,0,0,0.04)', 
      border: '1px solid', borderColor: isHistory ? '#cbd5e1' : '#e2e8f0',
      transition: 'all 0.3s ease', 
      '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 12px 25px rgba(0,0,0,0.1)' },
      bgcolor: isHistory ? '#f8fafc' : '#ffffff',
      height: '100%', // Đảm bảo thẻ giãn đều theo chiều cao
      overflow: 'hidden'
    }}>
      {/* Khu vực ảnh giả lập (Image Placeholder) */}
      <Box sx={{ 
        height: 180, 
        bgcolor: isHistory ? '#e2e8f0' : '#f1f5f9', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#94a3b8' 
      }}>
        <ShoppingBag sx={{ fontSize: 50, opacity: 0.5 }} />
      </Box>
      
      {/* Khu vực nội dung */}
      <CardContent sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle2" sx={{ 
          fontWeight: 600, color: '#1e293b', mb: 1, lineHeight: 1.5, 
          // Fix chiều cao tối thiểu cho text để các thẻ bằng nhau dù tên ngắn hay dài
          minHeight: 44, 
          display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 
        }}>
          {product.name}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Rating value={product.rating_average || 0} precision={0.5} size="small" readOnly />
          <Typography variant="body2" sx={{ color: '#64748b', ml: 1, fontWeight: 500 }}>
            ({product.review_count || 0})
          </Typography>
        </Box>
        
        {/* Box này sẽ luôn bị đẩy xuống đáy nhờ flexGrow: 1 ở CardContent */}
        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {formatPrice(product.price)}
            </Typography>
            {!isHistory && product.final_score && (
              <Chip 
                icon={<Star sx={{ fontSize: 16 }} />} 
                label={product.final_score.toFixed(1)} 
                size="small" 
                sx={{ 
                  bgcolor: '#fffbeb', color: '#d97706', fontWeight: 'bold', 
                  border: '1px solid #fde68a' 
                }} 
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box p={4} sx={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 1, color: '#1e293b' }}>
        Gợi Ý Sản Phẩm
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b', mb: 4 }}>
        Nhập ID Khách hàng để nhận danh sách sản phẩm dựa trên lịch sử
      </Typography>

      {/* THANH TÌM KIẾM */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', mb: 4 }}>
        <CardContent sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField 
            fullWidth 
            variant="outlined" 
            placeholder="Nhập User ID (Ví dụ: USR_0001)..." 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleRecommend()} 
            sx={{ backgroundColor: '#fff' }} 
          />
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleRecommend} 
            disabled={loading || !userId.trim()} 
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />} 
            sx={{ py: 1.8, px: 4, borderRadius: 2, fontWeight: 'bold', minWidth: 200 }}
          >
            {loading ? 'Đang Xử Lý...' : 'Lấy Gợi Ý'}
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}
      {!loading && products.length > 0 && isColdStart && (
        <Alert severity="info" sx={{ mb: 4, borderRadius: 2, fontWeight: '500' }}>
          Khách hàng mới chưa có lịch sử. Hệ thống hiển thị Top 10 sản phẩm bán chạy nhất
        </Alert>
      )}

      {/* KHU VỰC 1: LỊCH SỬ TƯƠNG TÁC */}
      {!loading && history.length > 0 && !isColdStart && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#475569', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <History color="action" /> Dựa trên lịch sử khách hàng đã quan tâm:
          </Typography>
          
          {/* SỬ DỤNG CSS GRID thay vì MUI Grid để chia đúng 5 cột hoàn hảo */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, 
            gap: 3 
          }}>
            {history.map((product) => (
              <ProductCard key={`hist-${product.id}`} product={product} isHistory={true} />
            ))}
          </Box>
        </Box>
      )}

      {/* KHU VỰC 2: KẾT QUẢ GỢI Ý */}
      {!loading && products.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome color="success" /> Đề xuất riêng cho bạn:
          </Typography>
          
          {/* SỬ DỤNG CSS GRID */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, 
            gap: 3 
          }}>
            {products.map((product) => (
              <ProductCard key={`rec-${product.id}`} product={product} isHistory={false} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}