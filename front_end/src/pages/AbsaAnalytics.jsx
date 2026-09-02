import React, { useState } from 'react';
import { 
  Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Chip, Button, Divider,
  Dialog, DialogTitle, DialogContent, CircularProgress, Alert, List, ListItem
} from '@mui/material';
import { Assessment, Feedback, WarningAmber, FormatQuote } from '@mui/icons-material';
import axios from 'axios';

const ASPECT_NAMES = {
  quality: 'Chất Lượng (Quality)',
  price: 'Giá Cả (Price)',
  delivery: 'Vận Chuyển (Delivery)',
  packaging: 'Đóng Gói (Packaging)',
  service: 'Dịch Vụ (Service)'
};

export default function AbsaAnalytics({ data }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceData, setEvidenceData] = useState(null);
  const [selectedAspect, setSelectedAspect] = useState('');

  // Hàm gọi API lấy Raw Evidence
  const handleOpenEvidence = async (aspectKey) => {
    setEvidenceOpen(true);
    setSelectedAspect(aspectKey);
    setEvidenceLoading(true);
    setEvidenceData(null);

    try {
      // Đã đổi endpoint gọi API sang /api/evidence/
      const res = await axios.get(`http://127.0.0.1:5000/api/evidence/${aspectKey}`);
      if (res.data.status === 'success') {
        setEvidenceData(res.data.data);
      } else {
        setEvidenceData({ error: 'Lỗi trích xuất: ' + res.data.message });
      }
    } catch (err) {
      setEvidenceData({ error: 'Không thể lấy dữ liệu. Hãy kiểm tra lại backend.' });
    } finally {
      setEvidenceLoading(false);
    }
  };

  if (!data || !data.overall) return <Typography>Đang tải dữ liệu ABSA...</Typography>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
        Phân Tích Cảm Xúc (ABSA Analytics)
      </Typography>
      <Typography variant="body1" sx={{ color: '#64748b', mb: 4 }}>
        Thống kê tỷ lệ đánh giá và hệ thống trích xuất vấn đề tiêu cực (System-wide).
      </Typography>

      {/* ================= PHẦN 1: BẢNG THỐNG KÊ ABSA ================= */}
      <Card sx={{ borderRadius: 3, mb: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment sx={{ color: '#3b82f6' }} /> Phân Bố Kết Quả ABSA Toàn Hệ Thống
            </Typography>
            
          </Box>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Khía Cạnh (Aspect)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#16a34a' }}>Tích Cực (Positive)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#d97706' }}>Trung Lập (Neutral)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#dc2626' }}>Tiêu Cực (Negative)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Không Đề Cập (None)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(data.overall).map((aspect) => {
                  const stat = data.overall[aspect];
                  return (
                    <TableRow hover key={aspect}>
                      <TableCell sx={{ fontWeight: 'bold', color: '#334155' }}>
                        {ASPECT_NAMES[aspect] || aspect.toUpperCase()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={`${stat.positive?.percentage || 0}%`} sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 'bold' }} />
                        <Typography variant="caption" display="block" color="textSecondary">{stat.positive?.count || 0} reviews</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={`${stat.neutral?.percentage || 0}%`} sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 'bold' }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={`${stat.negative?.percentage || 0}%`} sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 'bold' }} />
                        <Typography variant="caption" display="block" color="textSecondary">{stat.negative?.count || 0} reviews</Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#94a3b8' }}>
                        {stat.none?.percentage || 0}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ================= PHẦN 2: TRÍCH XUẤT VẤN ĐỀ TIÊU CỰC ================= */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#334155', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Feedback sx={{ color: '#ef4444' }} /> Các Vấn Đề Tiêu Cực
      </Typography>
      
      <Grid container spacing={3}>
        {Object.keys(data.overall).map((aspect) => (
          <Grid item xs={12} md={6} lg={4} key={`negative-card-${aspect}`}>
            <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  {/* ĐÃ FIX LỖI CẮT CHỮ Ở ĐÂY */}
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                    {ASPECT_NAMES[aspect] || aspect.toUpperCase()}
                  </Typography>
                  <Chip label={`${data.overall[aspect].negative?.percentage || 0}% Negative`} size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 'bold' }} />
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                  Hệ thống ghi nhận <strong>{data.overall[aspect].negative?.count || 0}</strong> review tiêu cực về mảng này.
                </Typography>
              </CardContent>
              <Box sx={{ p: 2, pt: 0 }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<FormatQuote />}
                  onClick={() => handleOpenEvidence(aspect)}
                  sx={{ 
                    borderColor: '#cbd5e1', color: '#475569', textTransform: 'none', fontWeight: 'bold',
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                  }}
                >
                  Xem Phản Hồi
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ================= MODAL EVIDENCE (KHÔNG CÓ AI) ================= */}
      <Dialog open={evidenceOpen} onClose={() => setEvidenceOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, height: '80vh' } }}>
        <DialogTitle sx={{ m: 0, p: 2.5, bgcolor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormatQuote sx={{ color: '#38bdf8' }} /> 
            Bằng Chứng Mô Hình: Nhãn Negative - {ASPECT_NAMES[selectedAspect]}
          </Box>
          <Button onClick={() => setEvidenceOpen(false)} sx={{ color: 'white', minWidth: 'auto', p: 1 }}>ĐÓNG</Button>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 0, backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          
          {/* LỜI CẢNH BÁO */}
          <Alert severity="warning" icon={<WarningAmber />} sx={{ borderRadius: 0, borderBottom: '1px solid #fbbf24' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Lưu ý về dữ liệu:</Typography>
            <Typography variant="body2">
              Dưới đây là các review được <strong>mô hình PhoBERT gán nhãn Tiêu Cực</strong> cho khía cạnh này. Một review có thể đề cập đến nhiều khía cạnh cùng lúc (VD: Vừa chê giao hàng, vừa khen chất lượng); văn bản hiển thị là <strong>nguyên bản toàn bộ review gốc</strong>.
            </Typography>
          </Alert>

          {evidenceLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, py: 10 }}>
              <CircularProgress sx={{ color: '#6366f1', mb: 2 }} />
              <Typography color="textSecondary">Đang tải dữ liệu phản hồi...</Typography>
            </Box>
          ) : evidenceData?.error ? (
             <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="error">{evidenceData.error}</Typography></Box>
          ) : evidenceData ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ p: 2, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 2 }}>
                <Chip label={`Tổng review tiêu cực: ${evidenceData.total_count}`} sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 'bold' }} />
                <Chip label={`Hiển thị mẫu: ${evidenceData.sample_count} review`} variant="outlined" />
              </Box>
              
              <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1, bgcolor: '#fff' }}>
                <List disablePadding>
                  {(evidenceData.sample_reviews || []).map((review, idx) => (
                    <ListItem key={idx} alignItems="flex-start" sx={{ py: 2, px: 1, borderBottom: '1px dashed #e2e8f0' }}>
                      <Box sx={{ px: 1.5, py: 0.5, mr: 2, mt: 0.5, bgcolor: '#f1f5f9', color: '#475569', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>#{idx+1}</Typography>
                      </Box>
                      <Typography variant="body1" sx={{ color: '#1e293b', fontStyle: 'italic', lineHeight: 1.6 }}>
                        "{review}"
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}