import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, Grid, Button, 
  Chip, CircularProgress, Divider, Alert, Autocomplete, TextField
} from '@mui/material';
import { AutoAwesome, Search } from '@mui/icons-material';
import axios from 'axios';

export default function ProductClustering() {
  const [products, setProducts] = useState([]); // Khai báo đúng tên state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [clusterData, setClusterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch danh sách sản phẩm đổ vào Dropdown
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/products')
      .then(res => {
          if (res.data.status === 'success') {
            // Lấy đúng mảng 'products' từ API và dùng hàm setProducts
            setProducts(res.data.products || []); 
          }
        })
      .catch(err => console.error("Lỗi lấy danh sách sản phẩm:", err));
  }, []);

  // 2. Xử lý khi bấm nút Phân tích
  const handleAnalyze = async () => {
    if (!selectedProductId) {
      setError("Vui lòng chọn một sản phẩm!");
      return;
    }

    setLoading(true);
    setError(null);
    setClusterData(null);

    try {
      const response = await axios.get(`http://127.0.0.1:5000/api/clustering/${selectedProductId}`);
      
      if (response.data.status === 'success') {
        setClusterData(response.data);
      } else {
        setError(response.data.message || "Có lỗi xảy ra khi phân tích.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Không thể kết nối đến server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
        Phân Tích Vấn Đề Theo Sản Phẩm
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b', mb: 4 }}>
        Sử dụng AI (PhoBERT & K-Means) để tự động gom nhóm các đánh giá tiêu cực của một sản phẩm cụ thể.
      </Typography>

      {/* THANH TÌM KIẾM & CHỌN SẢN PHẨM */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 3 }}>
          
          <Autocomplete
            fullWidth
            options={products} // Gọi đúng biến products đã khai báo ở trên
            getOptionLabel={(option) => `[${option.id}] - ${option.name}`}
            onChange={(event, newValue) => {
              setSelectedProductId(newValue ? newValue.id : '');
            }}
            renderInput={(params) => (
              <TextField {...params} label="Gõ tên hoặc chọn sản phẩm..." variant="outlined" />
            )}
            ListboxProps={{ style: { maxHeight: 300 } }} 
          />
          
          <Button 
            variant="contained" 
            size="large"
            onClick={handleAnalyze}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Search />}
            sx={{ 
              minWidth: 160, 
              height: 56, 
              bgcolor: '#0ea5e9', 
              '&:hover': { bgcolor: '#0284c7' },
              fontWeight: 'bold'
            }}
          >
            {loading ? "Đang xử lý..." : "Phân Tích"}
          </Button>
        </CardContent>
      </Card>

      {/* HIỂN THỊ LỖI */}
      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* KẾT QUẢ CLUSTERING */}
      {clusterData && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Kết quả cho: <span style={{ color: '#0ea5e9' }}>{clusterData.product_name}</span>
            </Typography>
            <Chip label={`Tổng: ${clusterData.total_reviews} reviews`} size="small" />
            <Chip label={`Đưa vào AI: ${clusterData.analyzed_reviews} reviews`} size="small" color="primary" variant="outlined" />
          </Box>

          <Grid container spacing={3}>
            {clusterData.clusters.map((cluster) => (
              <Grid item xs={12} md={6} lg={6} key={cluster.id}>
                <Card sx={{ 
                  height: '100%', 
                  borderRadius: 3, 
                  border: '1px solid #e2e8f0',
                  boxShadow: 'none',
                  transition: '0.2s',
                  '&:hover': { boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderColor: '#cbd5e1' }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                        <AutoAwesome sx={{ color: '#f59e0b', fontSize: 20, mr: 1, verticalAlign: 'middle' }}/> 
                        {cluster.name}
                      </Typography>
                      <Chip label={`${cluster.size} bình luận`} size="small" sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold' }} />
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                      {cluster.keywords.map((kw, i) => (
                        <Chip key={i} label={kw} size="small" variant="outlined" sx={{ color: '#475569' }} />
                      ))}
                    </Box>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    <Typography variant="subtitle2" sx={{ color: '#64748b', mb: 1, textTransform: 'uppercase', fontSize: 12 }}>
                      Review mẫu thực tế:
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {cluster.sample_reviews.map((review, idx) => (
                        <Typography key={idx} variant="body2" sx={{ 
                          bgcolor: '#f8fafc', 
                          p: 1.5, 
                          borderRadius: 2, 
                          fontStyle: 'italic',
                          color: '#334155',
                          borderLeft: '3px solid #cbd5e1'
                        }}>
                          "{review}"
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}