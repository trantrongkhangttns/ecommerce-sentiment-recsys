import React, { useState } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  CircularProgress, Chip, Rating, Alert, Snackbar
} from '@mui/material';
import { Search, Visibility, ShoppingCart } from '@mui/icons-material';
import axios from 'axios';

export default function ProductSearch() {
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('USR_0001'); // Mặc định để test
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/products/search', {
        params: { q: query, limit: 12 }
      });
      if (response.data.status === 'success') {
        setProducts(response.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduct = async (productId, productName) => {
    try {
      await axios.post('http://127.0.0.1:5000/api/log', {
        user_id: userId,
        product_id: productId,
        action: 'click_view'
      });
      setToastMessage(`Đã lưu lịch sử: Bạn vừa xem "${productName}"`);
    } catch (err) {
      console.error("Lỗi khi lưu log", err);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
  };

  return (
    <Box p={4} sx={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 1, color: '#1e293b' }}>
        Cửa Hàng
      </Typography>

      {/* THANH TÌM KIẾM & GIẢ LẬP ĐĂNG NHẬP */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', mb: 4 }}>
        <CardContent sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField 
            label="User_ID" 
            variant="outlined" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)} 
            sx={{ width: 200, backgroundColor: '#fff' }} 
          />
          <TextField 
            fullWidth 
            variant="outlined" 
            placeholder="Tìm áo thun, balo, giày..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
            sx={{ backgroundColor: '#fff' }} 
          />
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleSearch} 
            disabled={loading || !query.trim()} 
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />} 
            sx={{ py: 1.8, px: 4, borderRadius: 2, fontWeight: 'bold', minWidth: 150 }}
          >
            Tìm Kiếm
          </Button>
        </CardContent>
      </Card>

      {/* ================= KẾT QUẢ TÌM KIẾM (ĐÃ CHUYỂN SANG CSS GRID) ================= */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, 
        gap: 3 
      }}>
        {products.map((product) => (
          <Card key={product.id} sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            borderRadius: 3,
            boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
            transition: 'all 0.3s ease', 
            '&:hover': { 
              transform: 'translateY(-6px)', 
              boxShadow: '0 12px 25px rgba(0,0,0,0.1)' 
            },
            '&:hover .product-placeholder-icon': {
              transform: 'scale(1.15)',
              color: '#94a3b8'
            },
            height: '100%' // Quan trọng: Ép các thẻ trong cùng một hàng cao bằng nhau
          }}>
            
            {/* Ảnh Placeholder */}
            <Box sx={{ 
              height: 180, 
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {product.image_url ? (
                <Box 
                  component="img" 
                  src={product.image_url} 
                  alt={product.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <ShoppingCart 
                  className="product-placeholder-icon"
                  sx={{ fontSize: 64, color: '#cbd5e1', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} 
                />
              )}
            </Box>

            {/* Nội dung thông tin */}
            <CardContent sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ 
                  fontWeight: 600, 
                  color: '#1e293b',
                  mb: 1.5, 
                  display: '-webkit-box', 
                  overflow: 'hidden', 
                  WebkitBoxOrient: 'vertical', 
                  WebkitLineClamp: 2, 
                  height: 48, // CHÌA KHÓA: Fix cứng chiều cao của text thành 48px (cho 2 dòng chữ)
                  lineHeight: '24px' // Mỗi dòng cao 24px, 2 dòng = 48px
                }}>
                  {product.name}
                </Typography>
                <Rating value={product.rating_average || 0} precision={0.5} size="small" readOnly />
              </Box>
              
              {/* Box chứa Giá tiền & Nút xem */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                mt: 'auto', // CHÌA KHÓA: Đẩy cục này xuống sát đáy thẻ
                pt: 2 // Tạo khoảng cách một chút với phần Rating ở trên
              }}>
                <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 'bold' }}>
                  {formatPrice(product.price)}
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small" 
                  startIcon={<Visibility />}
                  onClick={() => handleViewProduct(product.id, product.name)}
                  sx={{ 
                    borderRadius: 2, 
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderWidth: '2px',
                    '&:hover': { borderWidth: '2px' }
                  }}
                >
                  Xem
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* THÔNG BÁO POPUP */}
      <Snackbar open={!!toastMessage} autoHideDuration={3000} onClose={() => setToastMessage('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}