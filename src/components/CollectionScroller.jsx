import React, { useRef, useState } from 'react';
import './CollectionScroller.css';

const CollectionScroller = ({ collections, title = "Saree Categories", onSelectCategory, activeCategory }) => {
    const scrollContainerRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const handleImageError = (event, key) => {
        event.currentTarget.src = `https://picsum.photos/seed/category-${key}/520/700`;
    };

    const scroll = (direction) => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300;
            const element = scrollContainerRef.current;
            
            if (direction === 'left') {
                element.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                element.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
            
            setTimeout(checkScroll, 600);
        }
    };

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const element = scrollContainerRef.current;
            setShowLeftArrow(element.scrollLeft > 0);
            setShowRightArrow(
                element.scrollLeft < element.scrollWidth - element.clientWidth - 10
            );
        }
    };

    const handleScroll = () => {
        checkScroll();
    };

    return (
        <section className="collection-scroller-section">
            <div className="scroller-header">
                <h2 className="scroller-title">
                    <i className="fas fa-th"></i> {title}
                </h2>
                <p className="scroller-subtitle">
                    <i className="fas fa-sparkles"></i> Explore our exclusive saree categories
                </p>
            </div>

            <div className="scroller-wrapper">
                {showLeftArrow && (
                    <button 
                        className="scroll-arrow left-arrow" 
                        onClick={() => scroll('left')}
                        aria-label="Scroll left"
                        title="Scroll left"
                    >
                        <i className="fas fa-chevron-left"></i>
                    </button>
                )}

                <div 
                    className="collection-container" 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                >
                    {collections && collections.map((collection, index) => (
                        <div 
                            key={collection.id || index} 
                            className={`collection-item ${activeCategory === collection.name ? 'active' : ''}`}
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="collection-image-wrapper">
                                <img 
                                    src={collection.image} 
                                    alt={collection.name} 
                                    className="collection-image"
                                    onError={(event) => handleImageError(event, collection.id || index)}
                                />
                                <div className="collection-overlay">
                                    <button className="view-btn" type="button" onClick={() => onSelectCategory?.(collection.name)} title={`View ${collection.name}`}>
                                        <i className={`fas fa-${activeCategory === collection.name ? 'eye-slash' : 'eye'}`}></i>
                                        {activeCategory === collection.name ? 'Hide' : 'View'}
                                    </button>
                                </div>
                            </div>
                            <h3 className="collection-name">{collection.name}</h3>
                            <p className="collection-desc">
                                {collection.description || "Explore collection"}
                            </p>
                        </div>
                    ))}
                </div>

                {showRightArrow && (
                    <button 
                        className="scroll-arrow right-arrow" 
                        onClick={() => scroll('right')}
                        aria-label="Scroll right"
                        title="Scroll right"
                    >
                        <i className="fas fa-chevron-right"></i>
                    </button>
                )}
            </div>
        </section>
    );
};

export default CollectionScroller;