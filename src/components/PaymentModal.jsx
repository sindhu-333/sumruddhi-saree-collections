import React, { useState } from 'react';
import './PaymentModal.css';
import upiQrImage from '../../qr_upi.png';

const PaymentModal = ({ isOpen, onClose, onCancel, totalAmount, cartItems, onPaymentComplete, currentUser }) => {
    const [step, setStep] = useState('upi'); // 'upi' -> 'screenshot' -> 'success'

    const sanitizeDataUrl = (value) => {
        if (typeof value !== 'string') return '';

        const normalized = value.trim().replace(/\s+/g, '');
        if (!/^data:image\//i.test(normalized) || !normalized.includes(',')) {
            return '';
        }

        const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
        if (!match) return '';

        const payload = match[2];
        if (!payload || payload.length % 4 !== 0) return '';

        try {
            const decoded = window.atob(payload);
            return decoded.length > 0 && window.btoa(decoded) === payload ? normalized : '';
        } catch (error) {
            return '';
        }
    };

    const resolveScreenshotSource = (value) => {
        if (typeof value !== 'string') return upiQrImage;

        const normalized = value.trim();
        if (!normalized) return upiQrImage;

        if (normalized.startsWith('data:image/')) {
            const commaIndex = normalized.indexOf(',');
            if (commaIndex < 0) return upiQrImage;

            const header = normalized.slice(0, commaIndex);
            const payload = normalized.slice(commaIndex + 1).replace(/\s+/g, '');
            if (!payload) return upiQrImage;

            const cleaned = `${header},${payload}`;
            return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(cleaned)
                ? cleaned
                : upiQrImage;
        }

        return normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('blob:')
            ? normalized
            : upiQrImage;
    };
    const [screenshot, setScreenshot] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const UPI_ID = '6360345856@ibl';
    const DUMMY_QR_CODE = upiQrImage;

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const nextValue = sanitizeDataUrl(String(e.target?.result || '')) || String(e.target?.result || '');
                    setScreenshot(nextValue);
                    setError('');
                };
                reader.readAsDataURL(file);
            } else {
                setError('Please select an image file');
            }
        }
    };

    const handleRemoveScreenshot = () => {
        setScreenshot(null);
        setError('');
    };

    const handleSubmitPayment = async () => {
        if (!screenshot) {
            setError('Please upload payment screenshot');
            return;
        }

        setUploading(true);
        try {
            // Simulate upload delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            const paymentTime = new Date().toLocaleString();
            const paymentId = `PAY-${Date.now()}`;
            
            const sanitizedScreenshot = resolveScreenshotSource(screenshot);

            const paymentData = {
                userId: currentUser?.id,
                userEmail: currentUser?.email,
                userName: currentUser?.name,
                cartItems,
                totalAmount,
                screenshot: sanitizedScreenshot,
                upiId: UPI_ID,
                paymentId,
                paymentTime,
                submittedAt: new Date().toISOString(),
                status: 'verification_in_process'
            };

            onPaymentComplete(paymentData);
            setStep('success');
        } catch (err) {
            setError('Failed to upload payment proof. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (step === 'success') {
            onClose();
            // Reset for next time
            setStep('upi');
            setScreenshot(null);
            setError('');
        } else {
            onCancel?.();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="payment-modal-overlay" onClick={handleClose}>
            <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                {step === 'upi' && (
                    <>
                        <div className="payment-modal-header">
                            <h2>Payment via UPI</h2>
                            <button className="modal-close-btn" onClick={handleClose}>×</button>
                        </div>
                        <div className="payment-modal-content">
                            <div className="payment-section">
                                <p className="payment-instruction">Scan the QR code with any UPI app to make payment</p>
                                
                                <div className="qr-container">
                                    <img src={DUMMY_QR_CODE} alt="UPI QR Code" className="qr-code" />
                                </div>

                                <div className="upi-details">
                                    <p className="upi-label">Or pay to:</p>
                                    <p className="upi-id">{UPI_ID}</p>
                                    <p className="amount-label">Amount: ₹{totalAmount.toLocaleString()}</p>
                                </div>

                                <button 
                                    className="payment-next-btn" 
                                    onClick={() => setStep('screenshot')}
                                >
                                    I've Made the Payment →
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {step === 'screenshot' && (
                    <>
                        <div className="payment-modal-header">
                            <h2>Payment Confirmation</h2>
                            <button className="modal-close-btn" onClick={handleClose}>×</button>
                        </div>
                        <div className="payment-modal-content">
                            <div className="screenshot-section">
                                <p className="screenshot-instruction">Upload the payment confirmation screenshot to verify your transaction</p>
                                
                                {!screenshot ? (
                                    <div className="file-upload-area">
                                        <input
                                            type="file"
                                            id="screenshot-input"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                            className="file-input"
                                        />
                                        <label htmlFor="screenshot-input" className="file-upload-label">
                                            <div className="upload-icon">📸</div>
                                            <p>Click to upload screenshot</p>
                                            <p className="upload-hint">or drag and drop</p>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="screenshot-preview">
                                        <img
                                            src={resolveScreenshotSource(screenshot)}
                                            alt="Payment screenshot"
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                event.currentTarget.src = upiQrImage;
                                            }}
                                        />
                                        <button 
                                            className="remove-screenshot-btn" 
                                            onClick={handleRemoveScreenshot}
                                            type="button"
                                        >
                                            ✕ Remove
                                        </button>
                                    </div>
                                )}

                                {error && <p className="error-message">{error}</p>}

                                <div className="screenshot-actions">
                                    <button 
                                        className="secondary-btn" 
                                        onClick={() => setStep('upi')}
                                        disabled={uploading}
                                    >
                                        ← Back
                                    </button>
                                    <button 
                                        className="payment-confirm-btn" 
                                        onClick={handleSubmitPayment}
                                        disabled={!screenshot || uploading}
                                    >
                                        {uploading ? 'Submitting...' : 'Submit for Verification'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {step === 'success' && (
                    <>
                        <div className="payment-modal-header">
                            <h2>Verification in Process</h2>
                        </div>
                        <div className="payment-modal-content">
                            <div className="success-section">
                                <div className="success-icon">✓</div>
                                <h3>Payment Screenshot Received!</h3>
                                <p className="success-message">Your payment screenshot has been submitted successfully.</p>
                                <p className="verification-message">The owner will verify your payment and confirm your order within a few hours.</p>
                                
                                <div className="order-details">
                                    <h4>Order Summary</h4>
                                    <div className="order-items">
                                        {cartItems.map(item => (
                                            <div key={item.id} className="order-item">
                                                <span>{item.name} x {item.qty}</span>
                                                <span>₹{(item.price * item.qty).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="order-total">
                                        <strong>Total:</strong>
                                        <strong>₹{totalAmount.toLocaleString()}</strong>
                                    </div>
                                </div>

                                <button 
                                    className="success-close-btn" 
                                    onClick={handleClose}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;
