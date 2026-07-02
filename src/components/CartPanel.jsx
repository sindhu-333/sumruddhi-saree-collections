import React from 'react';
import './CartPanel.css';

const CartPanel = ({ cart = {}, onCheckout, onRemove, isOpen = false, onClose }) => {
    const items = Object.values(cart || {});
    const handleImageError = (event, seed) => {
        event.currentTarget.src = `https://picsum.photos/seed/cart-${seed}/200/200`;
    };

    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
    const totalPrice = items.reduce((s, i) => s + ((i.qty || 0) * (i.price || 0)), 0);

    return (
        <aside className={`cart-panel ${isOpen ? 'open' : ''}`}>
            <div className="cart-panel-head">
                <h3 className="cart-title">
                    <i className="fas fa-shopping-bag"></i> Cart ({totalQty})
                </h3>
                <button type="button" className="cart-close-btn" onClick={onClose} title="Close cart">
                    <i className="fas fa-times"></i>
                </button>
            </div>
            {items.length === 0 ? (
                <div className="cart-empty">
                    <i className="fas fa-inbox"></i>
                    <p>Your cart is empty</p>
                    <p className="cart-empty-hint">Add sarees to get started</p>
                </div>
            ) : (
                <div className="cart-list">
                    {items.map(item => (
                        <div key={item.id} className="cart-item">
                            <img src={item.image} alt={item.name} className="cart-item-img" onError={(event) => handleImageError(event, item.id)} />
                            <div className="cart-item-info">
                                <div className="cart-item-name">{item.name}</div>
                                <div className="cart-item-qty">
                                    <i className="fas fa-cube"></i> Qty: {item.qty}
                                </div>
                                <div className="cart-item-price">₹{(item.price * item.qty).toLocaleString()}</div>
                                <button type="button" className="cart-remove-btn" onClick={() => onRemove?.(item)} title="Remove item">
                                    <i className="fas fa-trash-alt"></i> Remove
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="cart-footer">
                        <div className="cart-total">
                            <span className="total-label">Total:</span>
                            <span className="total-amount">₹{totalPrice.toLocaleString()}</span>
                        </div>
                        <button type="button" className="checkout-btn" onClick={onCheckout}>
                            <i className="fas fa-credit-card"></i> Book Now
                        </button>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default CartPanel;