import React, { useState } from 'react';
import './SareeCard.css';

const SareeCard = ({ saree, onAdd, onOpenDetails, isNew = false, getAverageRating, getRatingCount }) => {
    const [isAdded, setIsAdded] = useState(false);

    const handleImageError = (event) => {
        event.currentTarget.src = `https://picsum.photos/seed/saree-${saree.id}/600/800`;
    };

    const handleAddClick = () => {
        onAdd?.(saree);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 600);
    };

    const averageRating = getAverageRating ? getAverageRating(saree.id) : 0;
    const ratingCount = getRatingCount ? getRatingCount(saree.id) : 0;

    return (
        <div className="saree-card" role="button" tabIndex={0} onClick={() => onOpenDetails?.(saree)} onKeyDown={(event) => event.key === 'Enter' && onOpenDetails?.(saree)}>
            {isNew && <span className="new-badge"><i className="fas fa-star"></i> New</span>}
            <div className="saree-image-container">
                <img src={saree.image} alt={saree.name} className="saree-image" onError={handleImageError} />
                <div className="image-overlay"></div>
                <button className="quick-view-btn" type="button" title="Quick view">
                    <i className="fas fa-eye"></i>
                </button>
            </div>
            <div className="saree-info">
                <h3 className="saree-name">{saree.name}</h3>
                <p className="saree-description">{saree.description}</p>
                <p className="saree-category">
                    <i className="fas fa-tag"></i> {saree.category}
                </p>
                {averageRating > 0 && (
                    <div className="saree-rating">
                        <span className="rating-stars">★ {averageRating.toFixed(1)}</span>
                        <span className="rating-count">({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})</span>
                    </div>
                )}
                <div className="saree-footer">
                    <span className="saree-price">₹{saree.price.toLocaleString()}</span>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleAddClick();
                        }}
                        className={`add-to-cart-button ${isAdded ? 'added' : ''}`}
                        title={isAdded ? 'Added to cart' : 'Add to cart'}
                    >
                        {isAdded ? (
                            <>
                                <i className="fas fa-check"></i> Added
                            </>
                        ) : (
                            <>
                                <i className="fas fa-shopping-bag"></i> Add
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SareeCard;