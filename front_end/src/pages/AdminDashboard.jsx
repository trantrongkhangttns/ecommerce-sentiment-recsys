import React, { useEffect, useState } from 'react';
import './AdminDashboard.css'; 
import Recommendation from './Recommendation';
import ProductSearch from './ProductSearch';
import AbsaAnalytics from './AbsaAnalytics';
import ABSADemo from './AbsaDemo';

import { 
  Grid, Card, CardContent, Typography, CircularProgress, 
  Box, List, ListItem, ListItemButton, ListItemText 
} from '@mui/material';

import { 
  ShoppingCart, RateReview, Group, Hub 
  // Đã xóa import DataObject vì không còn dùng card ma trận ALS nữa
} from '@mui/icons-material';

import axios from 'axios';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setLoading(true);
    axios.get('http://127.0.0.1:5000/api/dashboard')
      .then(response => {
        if (response.data.status === 'success') {
          setData(response.data.data);
        } else {
          setError('Không thể lấy dữ liệu thống kê.');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Lỗi kết nối đến Server.');
        setLoading(false);
      });
  }, []); 

  const menuItems = [
    { id: 'dashboard', label: '📊 System Overview' },
    { id: 'absa_analytics', label: '🧠 ABSA Analytics' }, 
    { id: 'absa_demo', label: '🧪 ABSA Demo (Test)' }, 
    { id: 'recommendation', label: '🎯 Gợi Ý (ALS)' },
    { id: 'search', label: '🔎 Tìm Kiếm & Shopping' }
  ];

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#f8fafc' }}>
      
      {/* ================= SIDEBAR ================= */}
      <Box sx={{ width: 280, bgcolor: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="h5" sx={{ fontWeight: '900', color: '#fff', letterSpacing: '-0.5px' }}>
            Dashboard
          </Typography>
        </Box>

        <List sx={{ px: 2, pt: 3, flexGrow: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  borderRadius: 2, px: 3, py: 1.5, transition: 'all 0.2s',
                  '&.Mui-selected': { bgcolor: '#38bdf8', color: '#0f172a', '&:hover': { bgcolor: '#7dd3fc' } },
                  '&:hover:not(.Mui-selected)': { bgcolor: 'rgba(255,255,255,0.08)' }
                }}
              >
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: activeTab === item.id ? 'bold' : '500' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* ================= NỘI DUNG CHÍNH ================= */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={60} />
          </Box>
        ) : error ? (
          <Box p={4}><Typography color="error" variant="h6">❌ {error}</Typography></Box>
        ) : !data ? null : (
          <>
            {/* ================= TAB 1: SYSTEM OVERVIEW ================= */}
            {activeTab === 'dashboard' && (
              <Box sx={{ flexGrow: 1, p: 4, maxWidth: '1200px' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1e293b', mb: 1 }}>
                  System Overview
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b', mb: 4 }}>
                  Tổng quan quy mô dữ liệu hệ thống
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#334155' }}>Dữ liệu cốt lõi</Typography>
                
                <Grid container spacing={3}>
                  
                  {/* Card 1: Tổng sản phẩm */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ p: 1, bgcolor: '#e0f2fe', borderRadius: 2, color: '#0284c7', display: 'flex' }}><ShoppingCart fontSize="small" /></Box>
                          <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>TỔNG SẢN PHẨM</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 0.5 }}>
                          {data.overview.total_products.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>Product Catalog</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Card 2: Người dùng có tương tác */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ p: 1, bgcolor: '#dcfce7', borderRadius: 2, color: '#16a34a', display: 'flex' }}><Group fontSize="small" /></Box>
                          <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>NGƯỜI DÙNG</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 0.5 }}>
                          {data.recommendation_metrics.total_users.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>Interaction data</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Card 3: Tổng tương tác */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ p: 1, bgcolor: '#f3e8ff', borderRadius: 2, color: '#9333ea', display: 'flex' }}><Hub fontSize="small" /></Box>
                          <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>TỔNG TƯƠNG TÁC</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 0.5 }}>
                          {data.recommendation_metrics.total_interactions.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>Recommendation input</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Card 4: Tổng đánh giá */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderRadius: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ p: 1, bgcolor: '#fef3c7', borderRadius: 2, color: '#d97706', display: 'flex' }}><RateReview fontSize="small" /></Box>
                          <Typography variant="subtitle2" sx={{ color: '#64748b', fontWeight: 600 }}>TỔNG ĐÁNH GIÁ</Typography>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#0f172a', mb: 0.5 }}>
                          {data.overview.total_reviews.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>Review data</Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                </Grid>
              </Box>
            )}

            {/* TAB 2: ABSA ANALYTICS */}
            {activeTab === 'absa_analytics' && (
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <AbsaAnalytics data={data} />
              </Box>
            )}

            {/* TAB 3: ABSA DEMO */}
            {activeTab === 'absa_demo' && (
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                <ABSADemo />
              </Box>
            )}

            {/* CÁC TAB CÒN LẠI */}
            {activeTab === 'search' && <Box sx={{ flexGrow: 1, overflow: 'auto' }}><ProductSearch /></Box>}
            {activeTab === 'recommendation' && <Box sx={{ flexGrow: 1, overflow: 'auto' }}><Recommendation /></Box>}
          </>
        )}
      </Box>
    </Box>
  );
}