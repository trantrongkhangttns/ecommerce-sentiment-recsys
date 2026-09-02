import React, { useState } from 'react';

const AbsaDemo = () => {
    const [review, setReview] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!review.trim()) return;
        
        setLoading(true);
        setError('');
        setResults(null);

        try {
            const response = await fetch('http://localhost:5000/api/analyze-absa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review })
            });

            const data = await response.json();

            if (data.status === 'success') {
                setResults(data.data.aspects);
            } else {
                setError(data.message || 'Có lỗi xảy ra từ server');
            }
        } catch (err) {
            setError('Không thể kết nối đến Backend Flask.');
        } finally {
            setLoading(false);
        }
    };

    const getAspectNameVN = (aspect) => {
        switch (aspect) {
            case 'price': return 'Giá cả';
            case 'quality': return 'Chất lượng';
            case 'delivery': return 'Vận chuyển';
            case 'packaging': return 'Đóng gói';
            case 'service': return 'Dịch vụ';
            default: return aspect;
        }
    };

    const getSentimentColor = (sentiment) => {
        if (sentiment === 'positive') return { color: '#16a34a', text: '🟢 Hài lòng' };
        if (sentiment === 'negative') return { color: '#dc2626', text: '🔴 Không hài lòng' };
        if (sentiment === 'neutral') return { color: '#ca8a04', text: '🟡 Bình thường' };
        return { color: '#6b7280', text: '⚪ Không xác định' }; 
    };

    return (
        <div style={{ maxWidth: '900px', margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#1f2937' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Demo Kiến Trúc Hệ Thống ABSA
                </h2>
                {/* <p style={{ color: '#4b5563' }}>Hybrid Model: LLM (Google Gemini) + Deep Learning (PhoBERT)</p> */}
            </div>

            {/* BƯỚC 1: NHẬP LIỆU */}
            <div style={{ padding: '24px', border: '2px dashed #94a3b8', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#334155' }}>BƯỚC 1: NHẬP ĐÁNH GIÁ</h3>
                <textarea
                    rows="3"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="VD: Giá hơi cao nhưng chất lượng tốt, giao hàng nhanh, đóng gói cẩn thận và shop tư vấn nhiệt tình."
                    style={{ width: '100%', padding: '12px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', marginBottom: '16px' }}
                />
                <button 
                    onClick={handleAnalyze} 
                    disabled={loading || !review.trim()}
                    style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#94a3b8' : '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}
                >
                    {loading ? 'HỆ THỐNG ĐANG XỬ LÝ...' : 'CHẠY PHÂN TÍCH'}
                </button>
                {error && <p style={{ color: '#dc2626', marginTop: '12px', fontWeight: 'bold' }}>{error}</p>}
            </div>

            {/* KẾT QUẢ XỬ LÝ DÂY CHUYỀN */}
            {results && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    
                    <div style={{ padding: '10px 0', color: '#64748b', fontWeight: 'bold', fontSize: '20px' }}>
                        ⬇ <i>Đẩy text qua API Gateway vào Flask</i>
                    </div>

                    {/* BƯỚC 2: GEMINI */}
                    <div style={{ width: '100%', padding: '20px', border: '2px solid', borderRadius: '12px', backgroundColor: '#eff6ff', boxSizing: 'border-box' }}>
                        <h3 style={{ marginTop: 0, fontSize: '16px'}}>BƯỚC 2: TRÍCH XUẤT ĐẶC TRƯNG</h3>
                        {/* <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '16px' }}>* LLM phân tích câu và bóc tách thành các cặp (Aspect, Text):</p> */}
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {results.map((item, idx) => (
                                <div key={idx} style={{ flex: '1', minWidth: '180px', backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Aspect: {item.aspect}</div>
                                    <div style={{ marginTop: '8px', fontWeight: '500' }}>"{item.text}"</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: '10px 0', color: '#64748b', fontWeight: 'bold', fontSize: '20px' }}>
                        ⬇ <i>Đưa từng đoạn text vào mô hình chuyên biệt</i>
                    </div>

                    {/* BƯỚC 3: PHOBERT */}
                    <div style={{ width: '100%', padding: '20px', border: '2px solid', borderRadius: '12px', backgroundColor: '#f5f3ff', boxSizing: 'border-box' }}>
                        <h3 style={{ marginTop: 0, fontSize: '16px'}}>BƯỚC 3: PHÂN LOẠI CẢM XÚC</h3>
                        {/* <p style={{ fontSize: '14px', color: '#8b5cf6', marginBottom: '16px' }}>* Mỗi text được phân loại song song qua PhoBERT tương ứng:</p> */}
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {results.map((item, idx) => {
                                const sentimentUI = getSentimentColor(item.sentiment);
                                return (
                                    <div key={idx} style={{ flex: '1', minWidth: '180px', backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                        <div style={{ fontSize: '13px', color: '#4b5563' }}>Model <b>{item.aspect}</b> xử lý:</div>
                                        <div style={{ fontStyle: 'italic', margin: '8px 0', color: '#64748b' }}>"{item.text}"</div>
                                        {/* <div style={{ fontSize: '20px', textAlign: 'center' }}>⬇️</div> */}
                                        <div style={{ textAlign: 'center', fontWeight: 'bold', color: sentimentUI.color, textTransform: 'capitalize', marginTop: '8px' }}>
                                            {item.sentiment}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div style={{ padding: '10px 0', color: '#64748b', fontWeight: 'bold', fontSize: '20px' }}>
                        ⬇ <i>Tổng hợp kết quả cuối cùng</i>
                    </div>

                    {/* BƯỚC 4: KẾT QUẢ */}
                    <div style={{ width: '100%', padding: '20px', border: '2px solid', borderRadius: '12px', backgroundColor: '#ecfdf5', boxSizing: 'border-box' }}>
                        <h3 style={{ marginTop: 0, fontSize: '16px'}}>BƯỚC 4: BÁO CÁO MỨC ĐỘ HÀI LÒNG CỦA KHÁCH HÀNG</h3>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <tbody>
                                {results.map((item, index) => {
                                    const sentimentUI = getSentimentColor(item.sentiment);
                                    return (
                                        <tr key={index} style={{ borderBottom: index !== results.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                                            <td style={{ padding: '16px', fontWeight: 'bold', color: '#374151', width: '30%' }}>
                                                {getAspectNameVN(item.aspect)}
                                            </td>
                                            <td style={{ padding: '16px', width: '40%', color: '#6b7280', fontStyle: 'italic' }}>
                                                "{item.text}"
                                            </td>
                                            <td style={{ padding: '16px', fontWeight: 'bold', textAlign: 'right', color: sentimentUI.color }}>
                                                {sentimentUI.text}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
};

export default AbsaDemo;