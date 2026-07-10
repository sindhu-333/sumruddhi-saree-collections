import React, { useState } from 'react';
import './SareeCard.css';

const SareeCard = ({ saree, onAdd, onOpenDetails, onToggleFavorite, isFavorite = false, isNew = false, isOffer = false, offerPrice = 0, offerEndsInDays = 0, offerLabel = '', getAverageRating, getRatingCount }) => {
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
                        {isOffer ? (
                            <span className="offer-flag" aria-hidden="true">Offer</span>
                        ) : null}
                        {isNew ? (
                            <span className={`new-badge ${isOffer ? 'offer-shift' : ''}`}><i className="fas fa-star"></i> New</span>
                        ) : null}
            <div className="saree-image-container">
                <img src={saree.image} alt={saree.name} className="saree-image" onError={handleImageError} />
                <div className="image-overlay"></div>
                <button className="favorite-button" type="button" title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite?.(saree.id);
                }}>
                    <i className={isFavorite ? 'fas fa-heart' : 'far fa-heart'} aria-hidden="true" />
                </button>
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
                <div className="saree-tags">
                    {saree.fabric ? <span className="tag">{saree.fabric}</span> : null}
                    {isOffer && offerLabel ? <span className="tag offer-label">{offerLabel}</span> : null}
                </div>
                {averageRating > 0 && (
                    <div className="saree-rating">
                        <span className="rating-stars">★ {averageRating.toFixed(1)}</span>
                        <span className="rating-count">({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})</span>
                    </div>
                )}
                <div className="saree-footer">
                                        {isOffer ? (
                                            <div className="offer-price-block">
                                                <div className="offer-price">₹{(Number(offerPrice) || 0).toLocaleString()}</div>
                                                <div className="mrp">M.R.P.: <span className="original-price">₹{saree.price.toLocaleString()}</span></div>
                                            </div>
                                        ) : (
                                            <span className="saree-price">₹{saree.price.toLocaleString()}</span>
                                        )}
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