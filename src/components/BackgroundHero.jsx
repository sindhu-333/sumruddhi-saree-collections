import React, { useEffect, useRef, useState } from 'react';
import './BackgroundHero.css';

const TRANSITION_MS = 420;

const HERO_BACKGROUND_IMAGES = ['/b3.jpeg'];

const DEFAULT_HERO = HERO_BACKGROUND_IMAGES;

// Floating image stack (the right-side card) should use these local images only
const FLOATING_IMAGES = ['/b1.jpeg', '/b2.jpeg'];

const BackgroundHero = ({ images = DEFAULT_HERO, onShopNow }) => {
    const handleImageError = (event) => {
        event.currentTarget.src = '/b3.jpeg';
    };

    const [index, setIndex] = useState(0);
    const [prevSrc, setPrevSrc] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const mounted = useRef(true);
    const timerRef = useRef(null);

    useEffect(() => {
        mounted.current = true;
        // reset on images change so the hero background and floating stack stay in sync
        setIndex(0);
        setPrevSrc(null);
        setIsTransitioning(false);
        return () => { mounted.current = false; clearTimeout(timerRef.current); };
    }, [images]);

    useEffect(() => {
            // Use the fixed floating images list for the floating card rotation
            if (!FLOATING_IMAGES || FLOATING_IMAGES.length <= 1) return undefined;
            const id = setInterval(() => {
                if (!mounted.current) return;
                const next = (index + 1) % FLOATING_IMAGES.length;
                // capture previous src to crossfade
                setPrevSrc(FLOATING_IMAGES[index]);
                setIndex(next);
            // start transition a tick later so initial render has prev visible and new hidden
            setIsTransitioning(false);
            // small delay to allow DOM to paint
            setTimeout(() => setIsTransitioning(true), 20);
            // after transition, clear prevSrc
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setPrevSrc(null);
                setIsTransitioning(false);
            }, TRANSITION_MS + 40);
        }, 2000);
        return () => { clearInterval(id); clearTimeout(timerRef.current); };
    }, [index]);

    return (
        <div className="background-hero">
            <div className="hero-overlay"></div>
            <div className="hero-content">
                <div className="hero-text-wrapper">
                    <p className="hero-pill">Festive 2026 Edit</p>
                    <h1 className="hero-title">Sarees Curated Like A Luxury Boutique</h1>
                    <p className="hero-subtitle">From silk classics to modern drapes, discover premium sarees designed for weddings, festivals, and statement evenings.</p>
                    <button type="button" className="hero-button" onClick={onShopNow}>Shop Collection</button>
                </div>

                <div className="hero-image-wrapper">
                    <div className="hero-image-stack">
                        {prevSrc ? (
                            <img
                                key={`prev-${prevSrc}`}
                                src={prevSrc}
                                alt="previous featured saree"
                                className={`hero-image hero-image-prev ${isTransitioning ? 'fade-out' : 'visible'}`}
                                onError={handleImageError}
                            />
                        ) : null}

                        <img
                            key={`cur-${index}`}
                            src={FLOATING_IMAGES[index]}
                            alt={`Featured Saree ${index + 1}`}
                            className={`hero-image hero-image-current ${isTransitioning ? 'fade-in' : prevSrc ? 'hidden' : 'visible'}`}
                            onError={handleImageError}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackgroundHero;