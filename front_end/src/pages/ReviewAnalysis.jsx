import React, { useState } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  Grid, CircularProgress, Chip, Paper 
} from '@mui/material';
import { Send, LocalShipping, AttachMoney } from '@mui/icons-material';
import axios from 'axios';

export default function ReviewAnalysis() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/analyze', { 
        review: text 
      });
      
      if (response.data.status === 'success') {
        setResult(response.data.data.aspects);
      } else {
        setError(response.data.message || 'Lỗi từ Backend');
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại Backend.');
    } finally {
      setLoading(false);
    }
  };

  // Hàm helper để render màu sắc theo cảm xúc
  const getSentimentColor = (sentiment) => {
    switch(sentiment?.toLowerCase()) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box p={4} sx={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ fontWeight: '800', mb: 1, color: '#1e293b' }}>
        Phân Tích Đánh Giá Trực Tiếp
      </Typography>

      <Grid container spacing={4}>
        {/* CỘT TRÁI: Ô NHẬP LIỆU */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={6}
                variant="outlined"
                placeholder="Ví dụ: Sản phẩm giao hơi chậm nhưng chất lượng tuyệt vời, giá cả hợp lý..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                sx={{ mb: 3, backgroundColor: '#fff' }}
              />
              <Button 
                variant="contained" 
                size="large" 
                fullWidth
                onClick={handleAnalyze}
                disabled={loading || !text.trim()}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
                sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
              >
                {loading ? 'AI Đang Phân Tích...' : 'Phân Tích Ngay'}
              </Button>

              {error && (
                <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>
                  {error}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* CỘT PHẢI: KẾT QUẢ AI */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', backgroundColor: result ? '#fff' : '#f8fafc' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              {!result && !loading && (
                <Typography variant="body1" color="text.secondary" align="center">
                  Kết quả phân tích 3 khía cạnh (Chất lượng, Giá cả, Vận chuyển) sẽ hiển thị tại đây.
                </Typography>
              )}

              {loading && (
                <Box display="flex" justifyContent="center">
                  <CircularProgress />
                </Box>
              )}

              {result && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: '#0f172a', textAlign: 'center' }}>
                    Kết quả từ mô hình PhoBERT
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography fontWeight="bold">Chất lượng (Quality)</Typography>
                        </Box>
                        <Chip label={(result.quality || 'NONE').toUpperCase()} color={getSentimentColor(result.quality)} sx={{ fontWeight: 'bold' }} />
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <AttachMoney color="success" />
                          <Typography fontWeight="bold">Giá cả (Price)</Typography>
                        </Box>
                        <Chip label={(result.price || 'NONE').toUpperCase()} color={getSentimentColor(result.price)} sx={{ fontWeight: 'bold' }} />
                      </Paper>
                    </Grid>
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <LocalShipping color="warning" />
                          <Typography fontWeight="bold">Vận chuyển (Delivery)</Typography>
                        </Box>
                        <Chip label={(result.delivery || 'NONE').toUpperCase()} color={getSentimentColor(result.delivery)} sx={{ fontWeight: 'bold' }} />
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}